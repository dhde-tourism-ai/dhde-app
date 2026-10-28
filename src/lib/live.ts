/**
 * Pure helpers over live_demo.json: the state of every node, route and alert at
 * one hour index. Views call frameAt() and never touch the raw arrays.
 */
import type { LiveData, LiveWeatherAlert, RealSentiment, WeatherCondition } from '../types/live'
import { DOW_AR, MON_AR } from './arFormat'

export interface Tier {
  key: 'good' | 'warn' | 'serious' | 'crit'
  label: string
  label_ja: string
  label_ar: string
  colour: string
}

/** Site crowding from people on site ÷ comfortable capacity. */
export function crowdTier(load: number): Tier {
  if (load < 0.45) return { key: 'good', label: 'Comfortable', label_ja: '快適', label_ar: 'مريح', colour: '#0ca30c' }
  if (load < 0.8) return { key: 'warn', label: 'Busy', label_ja: 'やや混雑', label_ar: 'مزدحم قليلاً', colour: '#fab219' }
  if (load < 1.0) return { key: 'serious', label: 'Crowded', label_ja: '混雑', label_ar: 'مزدحم', colour: '#ec835a' }
  return { key: 'crit', label: 'Over capacity', label_ja: '過密', label_ar: 'فوق السعة', colour: '#d03b3b' }
}
export const CROWD_TIERS: Tier[] = [0.2, 0.6, 0.9, 1.2].map(crowdTier)

/** Road congestion 0..1. */
export function trafficTier(c: number): Tier {
  if (c < 0.4) return { key: 'good', label: 'Free flow', label_ja: '順調', label_ar: 'حركة سلسة', colour: '#0ca30c' }
  if (c < 0.7) return { key: 'warn', label: 'Slow', label_ja: '混雑気味', label_ar: 'حركة بطيئة', colour: '#fab219' }
  return { key: 'crit', label: 'Jammed', label_ja: '渋滞', label_ar: 'ازدحام شديد', colour: '#d03b3b' }
}
export const TRAFFIC_TIERS: Tier[] = [0.2, 0.55, 0.85].map(trafficTier)

export interface NodeFrame {
  id: string
  observed: boolean
  /** People on site: actual when observed, else predicted. */
  onSite: number
  actual: number | null
  predicted: number
  lo: number | null
  hi: number | null
  load: number
  tier: Tier
  arrivals: number
  /** hourly: where this hour's values come from when real hourly weather covers it (else null). */
  weather: { temp: number; pop: number; mm: number; wind: number; cond: WeatherCondition; station: string; station_ja: string; hourly: 'observed' | 'forecast' | null }
  alerts: LiveWeatherAlert[]
  sentiment: { score: number; posts: number; keywords: { en: string; ja: string }[]; real?: RealSentiment }
  /** Real daily figures for this node on this day (null when the day is not observed). */
  realDay: { visitors: number | null; signal: number | null } | null
  /** No visitor estimate exists (Fukui Station): show the raw signal only. */
  noEstimate: boolean
  /** Weather extras from real_data.json for the day. */
  wxDay: { sun: number | null; humidity: number | null; snow: number | null; temp: number | null; precip: number | null; wind: number | null; real: boolean }
}

export function frameAt(live: LiveData, i: number): Record<string, NodeFrame> {
  const out: Record<string, NodeFrame> = {}
  const d = Math.min(live.days.length - 1, Math.floor(i / 24))
  for (const [id, n] of Object.entries(live.nodes)) {
    const actual = n.on_site.actual[i] ?? null
    const predicted = n.on_site.predicted[i] ?? 0
    const onSite = actual ?? predicted
    const load = onSite / Math.max(1, n.comfortable_capacity)
    out[id] = {
      id,
      observed: actual !== null,
      onSite,
      actual,
      predicted,
      lo: n.on_site.lo?.[i] ?? null,
      hi: n.on_site.hi?.[i] ?? null,
      load,
      tier: crowdTier(load),
      arrivals: n.arrivals.actual[i] ?? n.arrivals.predicted[i] ?? 0,
      weather: {
        temp: n.weather.temp_c[i],
        pop: n.weather.precip_pct[i],
        mm: n.weather.precip_mm[i],
        wind: n.weather.wind_ms[i],
        cond: n.weather.condition[i],
        station: n.weather.station,
        station_ja: n.weather.station_ja,
        hourly: n.weather.hourly_source?.[i] ?? null,
      },
      alerts: live.weather_alerts.filter((a) => a.nodes.includes(id) && i >= a.start && i <= a.end),
      realDay: (() => {
        const m = live.node_meta?.[id]
        if (!m) return null
        const v = m.visitors_daily[d] ?? null
        const sg = m.signal_daily[d] ?? null
        return v === null && sg === null ? null : { visitors: v, signal: sg }
      })(),
      noEstimate: Boolean(live.node_meta?.[id]?.no_estimate),
      wxDay: {
        sun: n.weather.sun_h?.[d] ?? null,
        humidity: n.weather.humidity_pct?.[d] ?? null,
        snow: n.weather.snow_cm?.[d] ?? null,
        temp: n.weather.daily_temp_c?.[d] ?? null,
        precip: n.weather.daily_precip_mm?.[d] ?? null,
        wind: n.weather.daily_wind_ms?.[d] ?? null,
        real: Boolean(n.weather.real_days?.[d]),
      },
      sentiment: {
        score: n.sentiment.score[d],
        posts: n.sentiment.posts[d],
        keywords: n.sentiment.keywords[d] ?? [],
        real: n.sentiment.real,
      },
    }
  }
  return out
}

/** Max congestion across a route's segments at hour i (0 if the route has no traffic data). */
export function routeCongestion(live: LiveData, routeId: string, i: number): number {
  const t = live.traffic[routeId]
  if (!t) return 0
  return Math.max(...t.congestion.map((s) => s[i] ?? 0))
}

export function activeAdvisories(live: LiveData, i: number) {
  return live.advisories.filter((a) => i >= a.start && i <= a.end)
}

export function dayIndex(i: number) {
  return Math.floor(i / 24)
}

const DOW_JA: Record<string, string> = { Sun: '日', Mon: '月', Tue: '火', Wed: '水', Thu: '木', Fri: '金', Sat: '土' }
const DOW_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function dayLabel(live: LiveData, d: number, lang: 'en' | 'ja' | 'ar', short = false): string {
  const day = live.days[d]
  if (!day) return ''
  const [, m, dd] = day.date.split('-').map(Number)
  if (lang === 'ja') return short ? `${m}/${dd}(${DOW_JA[day.dow]})` : `${m}月${dd}日(${DOW_JA[day.dow]})`
  if (lang === 'ar') return short ? `${dowAr(day.dow)} ${dd}` : `${dowAr(day.dow)} ${dd} ${MON_AR[m - 1]}`
  return short ? `${day.dow} ${dd}` : `${day.dow} ${dd} ${MONTHS[m - 1]}`
}

/** Arabic weekday for the data's "Sun".."Sat". */
export function dowAr(dow: string): string {
  return DOW_AR[DOW_INDEX[dow]] ?? dow
}

export function hourLabel(i: number): string {
  return `${String(i % 24).padStart(2, '0')}:00`
}

export function timeLabel(live: LiveData, i: number, lang: 'en' | 'ja' | 'ar'): string {
  return `${dayLabel(live, dayIndex(i), lang)} ${hourLabel(i)}`
}

/** Daily arrivals per day: predicted total, and the observed total so far where the day has actuals. */
export function dailyArrivals(live: LiveData, id: string) {
  const n = live.nodes[id]
  if (!n) return []
  return live.days.map((_, d) => {
    const pred = n.arrivals.predicted.slice(d * 24, d * 24 + 24).reduce((a, b) => a + b, 0)
    const act = n.arrivals.actual.slice(d * 24, d * 24 + 24)
    const hasActual = act.some((v) => v !== null)
    const actualSoFar = hasActual ? act.reduce<number>((a, b) => a + (b ?? 0), 0) : null
    return { d, predicted: pred, actualSoFar }
  })
}

/** Diverging sentiment colour: red (negative), grey midpoint, blue (positive). */
export function sentimentColour(score: number): string {
  const neg = [230, 103, 103]
  const mid = [110, 121, 145]
  const pos = [57, 135, 229]
  const t = Math.max(-1, Math.min(1, score))
  const target = t < 0 ? neg : pos
  const f = Math.abs(t)
  const c = mid.map((v, k) => Math.round(v + (target[k] - v) * f))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

export function sentimentLabel(score: number): { en: string; ja: string; ar: string } {
  if (score >= 0.35) return { en: 'Very positive', ja: 'とても好評', ar: 'إيجابي جداً' }
  if (score >= 0.1) return { en: 'Positive', ja: '好評', ar: 'إيجابي' }
  if (score > -0.1) return { en: 'Mixed', ja: '賛否', ar: 'متباين' }
  if (score > -0.35) return { en: 'Negative', ja: '不評', ar: 'سلبي' }
  return { en: 'Very negative', ja: 'とても不評', ar: 'سلبي جداً' }
}

/** Neutral band of the real sentiment model (dhde-preprocessing-model sentiment.NEUTRAL_BAND). */
export const REAL_NEUTRAL_BAND = 0.2

/**
 * Label for a real average score, on the same ±0.2 band each post is labelled with, so a
 * site's label agrees with its positive / neutral / negative split. No "very": a first
 * model's average isn't precise enough for that.
 */
export function realSentimentLabel(score: number): { en: string; ja: string; ar: string } {
  if (score >= REAL_NEUTRAL_BAND) return { en: 'Positive', ja: '好評', ar: 'إيجابي' }
  if (score <= -REAL_NEUTRAL_BAND) return { en: 'Negative', ja: '不評', ar: 'سلبي' }
  return { en: 'Mixed', ja: '賛否', ar: 'متباين' }
}

export const CONDITION_LABEL: Record<WeatherCondition, { en: string; ja: string; ar: string }> = {
  clear: { en: 'Sunny', ja: '晴れ', ar: 'مشمس' },
  clear_night: { en: 'Clear', ja: '晴れ', ar: 'صافٍ' },
  partly: { en: 'Partly cloudy', ja: '晴れ時々曇り', ar: 'غائم جزئياً' },
  partly_night: { en: 'Partly cloudy', ja: '晴れ時々曇り', ar: 'غائم جزئياً' },
  cloudy: { en: 'Cloudy', ja: '曇り', ar: 'غائم' },
  rain: { en: 'Rain', ja: '雨', ar: 'مطر' },
  heavy_rain: { en: 'Heavy rain', ja: '大雨', ar: 'مطر غزير' },
  thunder: { en: 'Thunderstorm', ja: '雷雨', ar: 'عاصفة رعدية' },
  snow: { en: 'Snow', ja: '雪', ar: 'ثلج' },
  fog: { en: 'Fog', ja: '霧', ar: 'ضباب' },
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

/** Map pixel radius from people on site (area ∝ count). */
export function peopleRadius(n: number): number {
  return 6 + Math.sqrt(Math.max(0, n)) * 0.52
}
