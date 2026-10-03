import type { ForecastSite, StrategicQuestion } from '../types/strategy'
import { DEMAND_THRESHOLD } from './nudges'
import { weekdayNormal } from './normal'

/** The parts of public/data/real_data.json this uses (raw, as published). */
export interface RealDailyFile {
  shared_date: string | null
  nodes: Record<
    string,
    {
      daily: { date: string; signal: number | null; visitors_est: number | null }[]
      forecast?: {
        model: string
        backtest_wape: number | null
        days: { date: string; signal: number | null; signal_lo: number | null; signal_hi: number | null; visitors_est: number | null; visitors_lo: number | null; visitors_hi: number | null }[]
      }
    }
  >
}

// The sites the 7-day model forecasts, in map order. Fukui Station has no visitor count, only camera detections.
const SITES: { id: string; en: string; ja: string; signalOnly?: boolean }[] = [
  { id: 'tojinbo', en: 'Tojinbo', ja: '東尋坊' },
  { id: 'fukui_station', en: 'Fukui Station (camera detections)', ja: '福井駅（カメラ検知数）', signalOnly: true },
  { id: 'katsuyama', en: 'Katsuyama', ja: '勝山' },
  { id: 'rainbow_line', en: 'Rainbow Line', ja: 'レインボーライン' },
  { id: 'awara_onsen', en: 'Awara Onsen', ja: 'あわら温泉' },
]

const HISTORY_DAYS = 56
// "Extend hours" uses the demand alerts' own rule (nudges.ts, loop #1), so the Strategy card and the
// map's alerts never disagree about the same day: the forecast at least DEMAND_THRESHOLD (35%) above
// that day's normal, the median of recent same weekdays with holidays left out (lib/normal.ts).
const BUSY = 1 + DEMAND_THRESHOLD

const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_JA = ['日', '月', '火', '水', '木', '金', '土']
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayLabel(date: string, lang: 'en' | 'ja'): string {
  const d = new Date(`${date}T00:00:00Z`)
  return lang === 'ja'
    ? `${d.getUTCMonth() + 1}月${d.getUTCDate()}日(${DOW_JA[d.getUTCDay()]})`
    : `${DOW_EN[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')} ${MON_EN[d.getUTCMonth()]}`
}

const ACTION = {
  busy: { en: 'Extend hours', ja: '営業時間を延長' },
  normal: { en: 'Normal', ja: '通常' },
  none: { en: 'No visitor count', ja: '来訪者数なし' },
}

/** One site's last 8 weeks and next 7 days from the real data, or null if it has no forecast. */
function site(file: RealDailyFile, s: (typeof SITES)[number], lang: 'en' | 'ja'): ForecastSite | null {
  const n = file.nodes[s.id]
  const fc = n?.forecast
  if (!n || !fc || fc.days.length === 0) return null
  const val = (r: { signal: number | null; visitors_est: number | null }) => (s.signalOnly ? r.signal : r.visitors_est)
  const history = n.daily.filter((r) => val(r) !== null && (!file.shared_date || r.date <= file.shared_date)).slice(-HISTORY_DAYS)
  // The demand alerts' normal for each day (see BUSY). Fukui Station has no visitor count,
  // and the alerts skip it, so it gets no action either.
  const byDate = new Map(n.daily.map((r) => [r.date, r.visitors_est]))
  const normalOn = (date: string) => (s.signalOnly ? null : weekdayNormal((day) => byDate.get(day), date))
  const days = fc.days.map((d) => ({
    date: d.date,
    v: s.signalOnly ? d.signal : d.visitors_est,
    lo: s.signalOnly ? d.signal_lo : d.visitors_lo,
    hi: s.signalOnly ? d.signal_hi : d.visitors_hi,
  }))
  const points = [
    ...history.map((r) => ({ date: r.date, actual: val(r), forecast: null, lo: null, hi: null, severe_weather: false })),
    ...days.map((d) => ({ date: d.date, actual: null, forecast: d.v, lo: d.lo, hi: d.hi, severe_weather: false })),
  ]
  // Join the dashed forecast to the last measured day.
  const lastActual = points[history.length - 1]
  if (lastActual) lastActual.forecast = lastActual.actual
  const fmt = (v: number | null) => (v === null ? '–' : Math.round(v).toLocaleString('en-US'))
  const next7 = days.slice(0, 7).map((d) => {
    const normal = normalOn(d.date)
    const a = s.signalOnly ? ACTION.none : normal !== null && d.v !== null && d.v >= normal * BUSY ? ACTION.busy : ACTION.normal
    return { day: dayLabel(d.date, lang), range: `${fmt(d.lo)}–${fmt(d.hi)}`, action: a[lang] }
  })
  return { id: s.id, label: s[lang], points, next7 }
}

/**
 * Forecast cards marked `live` get their sites from the real 7-day forecast
 * (Dina's model in dhde-preprocessing-model, published in real_data.json) and
 * become modelled; without the file they keep their placeholder.
 */
export function withRealForecast(questions: StrategicQuestion[], file: RealDailyFile | null, lang: 'en' | 'ja'): StrategicQuestion[] {
  if (!file) return questions
  const sites = SITES.map((s) => site(file, s, lang)).filter((x): x is ForecastSite => x !== null)
  if (sites.length === 0) return questions
  const errors = SITES.map((s) => file.nodes[s.id]?.forecast?.backtest_wape).filter((w): w is number => typeof w === 'number')
  const range = errors.length ? `${Math.round(Math.min(...errors) * 100)}–${Math.round(Math.max(...errors) * 100)}%` : null
  const pct = Math.round(DEMAND_THRESHOLD * 100)
  return questions.map((q) => ({
    ...q,
    cards: q.cards.map((c) =>
      c.type === 'forecast' && c.live
        ? {
            ...c,
            sites,
            status: 'modelled' as const,
            note:
              lang === 'ja'
                ? `直近8週間の実績（実線）と7日間予測（破線、約80%の範囲）。予測は dhde-preprocessing-model の日次モデルで毎日更新。${range ? `検証誤差は地点により${range}。` : ''}対応：その曜日の平常（最近の同じ曜日の中央値、祝日を除く）より${pct}%以上多い日＝営業時間を延長（地図の需要アラートと同じ基準）。福井駅は公式の来訪者数がないためカメラ検知数で、対応は表示しない。`
                : `Last 8 weeks measured (line) and the 7-day forecast (dashed) with its roughly 80% range, from the daily model in dhde-preprocessing-model, refreshed daily. ${range ? `Typical error in tests: ${range} depending on the site. ` : ''}Action: ${pct}% or more above that weekday's normal (the median of the same weekday over recent weeks, holidays left out) = extend hours, the same rule as the map's demand alerts. Fukui Station has no official visitor count, so it shows camera detections and no action.`,
          }
        : c,
    ),
  }))
}
