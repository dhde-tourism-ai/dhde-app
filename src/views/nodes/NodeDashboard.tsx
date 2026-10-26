import { useMemo } from 'react'
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import type { RealData } from '../../types/real'
import type { LiveData } from '../../types/live'
import type { MarketVoiceData } from '../../types/market'
import type { RegistryNode } from '../../types/nodes'
import type { HotelThresholds, Nudge } from '../../lib/nudges'
import { computeNudges, PRIORITY, priorityOf } from '../../lib/nudges'
import { CONDITION_LABEL } from '../../lib/live'
import { dayWeather } from '../../lib/dayWeather'
import { fmtDate } from '../../lib/format'
import { useLang } from '../../lib/i18n'
import { addDays, nodeFigures } from '../../lib/nodeFigures'
import type { NodeFigures } from '../../lib/nodeFigures'

const S1 = '#3987e5'
const S2 = '#d95926'
const AXIS = { fill: '#7f8ba3', fontSize: 10.5, fontFamily: 'IBM Plex Mono' }
const TIP = { background: '#17233a', border: '1px solid rgba(160,185,230,.2)', borderRadius: 8, fontSize: 12, color: '#e9eef8' }
const CHART_DAYS = 60
const DOW_JA = '日月火水木金土'

const fmtNum = (n: number | null | undefined) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString('en-US'))
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '?' : `${Math.round(v * 100)}%`)

/** "10/26（月）" or "Mon 26 Oct". */
function dayName(iso: string, lang: 'en' | 'ja'): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (lang === 'ja') return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${DOW_JA[d.getUTCDay()]}）`
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

const shortDate = (iso: unknown) => (typeof iso === 'string' ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : String(iso ?? ''))

function Change({ f }: { f: NodeFigures }) {
  const { t } = useLang()
  if (!f.comparable || f.past30 === null || !f.lastYear) return <span className="muted">—</span>
  const d = f.past30 / f.lastYear - 1
  return (
    <span className={`tile-delta ${d >= 0 ? 'up' : 'down'}`}>
      {d >= 0 ? '▲ +' : '▼ '}
      {Math.round(d * 100)}% {t('YoY', '前年比')}
    </span>
  )
}

function NudgeList({ nudges, reg }: { nudges: Nudge[]; reg: RegistryNode[] }) {
  const { t } = useLang()
  if (!nudges.length) return <p className="muted">{t('No actions for the next 7 days: demand, weather and bookings are within normal range.', '今後7日間の推奨事項はありません。需要・天候・予約は平常範囲です。')}</p>
  return (
    <ul className="nudges">
      {nudges.map((n) => {
        const pr = PRIORITY[priorityOf(n.sev)]
        const node = reg.find((r) => r.id === n.node)
        return (
          <li key={n.id} className="nudge" style={{ borderLeftColor: pr.colour }}>
            <div className="nudge-type" title={t(pr.hint_en, pr.hint_ja)}>
              {t(pr.en, pr.ja)}
              {node ? ` · ${t(node.name, node.name_ja)}` : ''}
            </div>
            <div>
              <strong>{t(n.title_en, n.title_ja)}</strong>
            </div>
            <div className="muted">{t(n.action_en, n.action_ja)}</div>
          </li>
        )
      })}
    </ul>
  )
}

interface Props {
  real: RealData
  live: LiveData | null
  market: MarketVoiceData | null
  registry: RegistryNode[]
  thresholds: HotelThresholds | null
  ids: string[]
  /** JST date. */
  today: string
  selectedNode: string | 'all'
  onSelect: (id: string) => void
}

/**
 * Per-node dashboard from real_data.json (refreshed daily): the last 30 days
 * against the same days a year earlier, the week's weather, the last 60 days of
 * counts with the 7-day model forecast, and the real-data action nudges.
 * "All nodes" lists every node's figures side by side.
 */
export default function NodeDashboard({ real, live, market, registry, thresholds, ids, today, selectedNode, onSelect }: Props) {
  const { t, lang } = useLang()
  const name = (id: string) => {
    const r = registry.find((n) => n.id === id)
    return r ? t(r.name, r.name_ja) : id
  }

  // Real-data nudges for the next 7 days, highest priority first (as the Summary).
  const nudges = useMemo(() => {
    if (!live) return []
    const from = live.today_day ?? 0
    const rank = { high: 0, medium: 1, low: 2 }
    return computeNudges(live, market, registry, from, thresholds)
      .filter((n) => n.real && n.day >= from && n.day < from + 7)
      .sort((a, b) => rank[priorityOf(a.sev)] - rank[priorityOf(b.sev)] || b.magnitude - a.magnitude)
  }, [live, market, registry, thresholds])

  if (selectedNode === 'all') {
    return (
      <div className="nd">
        <section className="nd-section card">
          <div className="nd-head row">
            <h2 className="card-title">{t('All nodes', '全ノード')}</h2>
            <span className="card-sub">{t('Last 30 days to each node’s latest count, against the same days 52 weeks earlier', '各ノードの最新実績までの30日間と、52週前の同じ期間')}</span>
          </div>
          <div className="table-scroll">
            <table className="data-table nd-all">
              <thead>
                <tr>
                  <th>{t('Node', 'ノード')}</th>
                  <th className="num">{t('Past 30 days', '過去30日')}</th>
                  <th className="num">{t('Same days last year', '前年同期')}</th>
                  <th>{t('Change', '増減')}</th>
                  <th className="num">{t('Forecast, coming days', '今後の予測')}</th>
                  <th>{t('Counts to', '実績')}</th>
                </tr>
              </thead>
              <tbody>
                {ids
                  .filter((id) => real.nodes[id])
                  .map((id) => {
                    const f = nodeFigures(real.nodes[id], today)
                    return (
                      <tr key={id} onClick={() => onSelect(id)}>
                        <td>
                          {name(id)}
                          {!f.visitors && <span className="muted"> · {t('camera detections', 'カメラ検知数')}</span>}
                        </td>
                        <td className="num">{fmtNum(f.past30)}</td>
                        <td className="num">{f.lastYear ? fmtNum(f.lastYear) : '—'}</td>
                        <td>
                          <Change f={f} />
                        </td>
                        <td className="num">{f.next ? `${fmtNum(f.next.total)} (${f.next.days}${t('d', '日')})` : '—'}</td>
                        <td className="mono">{f.asOf ? fmtDate(f.asOf, lang) : '—'}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="nd-section card">
          <div className="nd-head row">
            <h3 className="card-title">{t('Action nudges, next 7 days', '推奨アクション（今後7日間）')}</h3>
          </div>
          <NudgeList nudges={nudges.slice(0, 6)} reg={registry} />
        </section>
      </div>
    )
  }

  const rn = real.nodes[selectedNode]
  const f = nodeFigures(rn, today)
  const unit = f.visitors ? t('visitors', '人') : t('detections', '検知')
  const fc = f.visitors ? rn.forecast : undefined
  const lastCount = f.asOf ?? today
  const chart = [
    ...rn.daily
      .filter((d) => d.date <= lastCount && d.date > addDays(lastCount, -CHART_DAYS))
      .map((d) => ({ date: d.date, actual: f.visitors ? d.visitors_est : d.signal })),
    ...(fc?.days ?? []).filter((d) => d.date > lastCount).map((d) => ({ date: d.date, forecast: d.visitors_est, range: [d.visitors_lo ?? d.visitors_est, d.visitors_hi ?? d.visitors_est] })),
  ]
  const week = Array.from({ length: 7 }, (_, k) => addDays(today, k))
  const ahead = (fc?.days ?? []).filter((d) => d.date >= today)

  return (
    <div className="nd">
      <section className="nd-section">
        <div className="nd-head">
          <h2 className="nd-title">
            {name(selectedNode)}
            <span className="nd-title-sub">{t('Executive summary', '概要')}</span>
          </h2>
          {rn.calibration.method_text && <p className="nd-desc">{t(rn.calibration.method_text, rn.calibration.method_text_ja)}</p>}
        </div>
        <div className="tile-grid">
          <div className="tile">
            <div className="tile-label">{t('Past 30 days', '過去30日')}</div>
            <div className="tile-value">{fmtNum(f.past30)}</div>
            <Change f={f} />
          </div>
          <div className="tile">
            <div className="tile-label">{t('Same days last year', '前年同期')}</div>
            <div className="tile-value">{f.lastYear ? fmtNum(f.lastYear) : '—'}</div>
            <div className="tile-foot">
              {f.comparable
                ? t('52 weeks earlier, same weekdays', '52週前の同じ曜日')
                : rn.compare_30d
                  ? t(`Counted on ${f.lastYearDays} of 30 days, so no comparison`, `30日中${f.lastYearDays}日のみ計測のため比較なし`)
                  : t('Available from the next data refresh', '次回のデータ更新から表示')}
            </div>
          </div>
          <div className="tile">
            <div className="tile-label">{t('Net difference', '差分')}</div>
            <div className="tile-value">{f.comparable && f.past30 !== null && f.lastYear !== null ? `${f.past30 >= f.lastYear ? '+' : ''}${fmtNum(f.past30 - f.lastYear)}` : '—'}</div>
            <div className="tile-foot">{t(`${unit[0].toUpperCase()}${unit.slice(1)} vs last year`, `前年との差（${unit}）`)}</div>
          </div>
          <div className="tile">
            <div className="tile-label">{f.next ? t(`Forecast, next ${f.next.days} days`, `今後${f.next.days}日間の予測`) : t('Forecast', '予測')}</div>
            <div className="tile-value">{f.next ? fmtNum(f.next.total) : '—'}</div>
            <div className="tile-foot">{f.next ? t(`To ${dayName(f.next.to, lang)}`, `${dayName(f.next.to, lang)}まで`) : t('No visitor forecast for this node', 'このノードの来場者予測はありません')}</div>
          </div>
        </div>
      </section>

      <section className="nd-section">
        <div className="nd-head row">
          <h3 className="card-title">{t('Weather, next 7 days', '今後7日間の天気')}</h3>
          <span className="card-sub">{t('JMA observations and model forecast · rain days outlined', '気象庁の観測とモデル予報・雨の日を強調')}</span>
        </div>
        <div className="wx-strip" role="list">
          {week.map((date) => {
            const w = dayWeather(rn, live, selectedNode, date)
            const rain = Boolean(w && w.mm !== null && w.mm >= 1)
            return (
              <div key={date} role="listitem" className={`wx-day ${rain ? 'risk' : ''}`}>
                <div className="wx-date">{dayName(date, lang)}</div>
                <div className="wx-desc">{w ? CONDITION_LABEL[w.cond][lang] : '—'}</div>
                <div className="wx-pop num">
                  {w && w.tMin !== null ? (w.tMax !== null && w.tMax !== w.tMin ? `${Math.round(w.tMin)}–${Math.round(w.tMax)}℃` : `${Math.round(w.tMin)}℃`) : ''}
                  {rain ? ` · ${Math.round(w!.mm!)}mm` : ''}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="nd-section card">
        <div className="nd-head row">
          <div>
            <h3 className="card-title">{fc ? t(`Daily ${unit}: last ${CHART_DAYS} days and the forecast`, `日別の来場者：過去${CHART_DAYS}日と予測`) : t(`Daily ${unit}: last ${CHART_DAYS} days`, `日別の${f.visitors ? '来場者' : '検知数'}：過去${CHART_DAYS}日`)}</h3>
            <p className="card-sub">
              {fc
                ? t(
                    `Model (${fc.model}): error ${pct(fc.backtest_wape)} vs ${pct(fc.baseline_wape)} for "same weekday last week"; ${pct(fc.range_coverage)} of past test days fell inside the range.`,
                    `モデル（${fc.model}）：誤差 ${pct(fc.backtest_wape)}（「先週の同じ曜日」なら ${pct(fc.baseline_wape)}）。過去の検証日の ${pct(fc.range_coverage)} が予測範囲内。`,
                  )
                : t('No visitor forecast for this node.', 'このノードの来場者予測はありません。')}
            </p>
          </div>
        </div>
        <div className="chart-key">
          <span>
            <i className="k-band" style={{ background: 'rgba(57,135,229,.35)' }}></i>
            {t('Counted', '実績')}
          </span>
          {fc && (
            <span>
              <i className="k-line dash" style={{ borderColor: S2 }}></i>
              {t('Forecast and range', '予測と範囲')}
            </span>
          )}
        </div>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ndActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={S1} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={S1} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f2a3f" vertical={false} />
              <XAxis dataKey="date" tick={AXIS} tickFormatter={shortDate} tickLine={false} axisLine={{ stroke: '#34425e' }} minTickGap={24} />
              <YAxis tick={AXIS} tickFormatter={(val: number) => Number(val).toLocaleString('en-US')} tickLine={false} axisLine={false} width={56} />
              <Tooltip
                contentStyle={TIP}
                formatter={(val: unknown, nm: unknown) => [Array.isArray(val) ? val.map((v) => Number(v).toLocaleString('en-US')).join(' – ') : Number(val).toLocaleString('en-US'), String(nm)]}
                labelFormatter={shortDate}
              />
              <Area type="monotone" dataKey="actual" name={t('Counted', '実績')} stroke={S1} strokeWidth={2} fill="url(#ndActual)" isAnimationActive={false} />
              {fc && <Area type="monotone" dataKey="range" name={t('Range', '予測範囲')} stroke="none" fill={S2} fillOpacity={0.15} isAnimationActive={false} />}
              {fc && <Line type="monotone" dataKey="forecast" name={t('Forecast', '予測')} stroke={S2} strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="nd-two">
        <section className="nd-section card">
          <div className="nd-head row">
            <h3 className="card-title">{t('Coming days', '今後の予測')}</h3>
            <span className="card-sub">{t('Model forecast and its range', 'モデル予測と範囲')}</span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Date', '日付')}</th>
                  <th className="num">{t('Forecast', '予測')}</th>
                  <th className="num">{t('Range', '予測範囲')}</th>
                </tr>
              </thead>
              <tbody>
                {ahead.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      {t('No visitor forecast for this node.', 'このノードの来場者予測はありません。')}
                    </td>
                  </tr>
                ) : (
                  ahead.map((d) => (
                    <tr key={d.date}>
                      <td>{dayName(d.date, lang)}</td>
                      <td className="num">{fmtNum(d.visitors_est)}</td>
                      <td className="num">
                        {fmtNum(d.visitors_lo)}–{fmtNum(d.visitors_hi)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="nd-section card">
          <div className="nd-head row">
            <h3 className="card-title">{t('Action nudges, next 7 days', '推奨アクション（今後7日間）')}</h3>
          </div>
          <NudgeList nudges={nudges.filter((n) => n.node === selectedNode)} reg={registry} />
          <button className="btn nd-export" onClick={() => window.print()}>
            {t('Export PDF summary', 'PDFで出力')}
          </button>
        </section>
      </div>
    </div>
  )
}
