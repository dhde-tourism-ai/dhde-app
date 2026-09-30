import { useState } from 'react'
import type { ReactNode } from 'react'
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type {
  BarsCard,
  BuilderCard,
  ForecastCard,
  FormulaTableCard,
  FunnelCard,
  HeatmapCard,
  IndicatorsCard,
  MonthlyForecastCard,
  MonthlyShareCard,
  ProgressCard,
  StatCard,
  StrategyCard,
  TableCard,
} from '../../types/strategy'
import { StatusPill } from '../../components/StatusPill'
import { Icon } from '../../components/icons'
import { fmtCompact, fmtYen, PENDING } from '../../lib/format'
import { useLang } from '../../lib/i18n'
import { storeLayers, storePanelOpen } from '../map/layers'
import type { LayerId } from '../map/layers'
import { useJsonResource } from '../../hooks/useJsonResource'
import { measuredYear, yearTotal } from '../../lib/monthly'
import type { MonthlyForecastFile } from '../../types/monthly'

import { AXIS, S, TIP } from './chartTheme'
import { GuestNightsMonths, TargetPace } from './guestNights'

/** Card frame: title, status pill (always shown), notes and TODOs. */
export function StrategyCardView({ card }: { card: StrategyCard }) {
  const { t } = useLang()
  return (
    <article id={card.id} className={`s-card s-${card.status} span-${card.span}`} style={{ ['--span' as string]: card.span }}>
      <header className="s-card-head">
        <h3>{card.title}</h3>
        <StatusPill status={card.status} />
      </header>
      <div className="s-card-body">
        <CardBody card={card} />
      </div>
      {(card.note || card.pending_on || card.source || card.todo) && (
        <footer className="s-card-foot">
          {card.note && <p>{card.note}</p>}
          {card.pending_on && (
            <p>
              <span className="s-k">{t('Pending on', '待ち')}:</span> {card.pending_on}
            </p>
          )}
          {card.source && (
            <p>
              <span className="s-k">{t('Source', '出典')}:</span> {card.source}
            </p>
          )}
          {card.todo && (
            <p className="s-todo">
              <span className="s-k">TODO:</span> {card.todo}
            </p>
          )}
        </footer>
      )}
    </article>
  )
}

function CardBody({ card }: { card: StrategyCard }): ReactNode {
  switch (card.type) {
    case 'stat':
      return <Stat card={card} />
    case 'progress':
      return <Progress card={card} />
    case 'formula_table':
      return <FormulaTable card={card} />
    case 'bars':
      return <Bars card={card} />
    case 'forecast':
      return <Forecast card={card} />
    case 'monthly_share':
      return <MonthlyShare card={card} />
    case 'heatmap':
      return <Heatmap card={card} />
    case 'funnel':
      return <Funnel card={card} />
    case 'indicators':
      return <Indicators card={card} />
    case 'table':
      return <DataTable card={card} />
    case 'builder':
      return <Builder card={card} />
    case 'monthly_forecast':
      return <MonthlyForecast card={card} />
    case 'guest_nights_months':
      return <GuestNightsMonths card={card} />
    case 'target_pace':
      return <TargetPace card={card} />
  }
}

function Stat({ card }: { card: StatCard }) {
  return (
    <div className="stat">
      <div className={`stat-value ${card.value_text === null ? 'pending' : ''}`}>
        {card.value_text ?? PENDING}
        {card.value_text !== null && card.unit}
      </div>
      {card.detail && <div className="stat-detail">{card.detail}</div>}
    </div>
  )
}

function fmtUnit(v: number, prefix: string, unit: string): string {
  return `${prefix}${v.toLocaleString('en-US')}${unit}`
}

function Progress({ card }: { card: ProgressCard }) {
  const { t } = useLang()
  const el = Math.round(card.elapsed_share * 100)
  return (
    <div className="progress-list">
      <div className="progress-legend">
        <span>
          <i className="pl-fill"></i>
          {t('Share of the way to target', '目標までの進捗')}
        </span>
        <span>
          <i className="pl-tick"></i>
          {t('Time elapsed', '経過期間')} {el}%
        </span>
      </div>
      {card.rows.map((r) => {
        const share = Math.max(0, Math.min(1, (r.current - r.baseline) / (r.target - r.baseline)))
        const met = r.current >= r.target
        const behind = !met && share < card.elapsed_share
        const pct = Math.round(share * 100)
        return (
          <div key={r.label} className="progress-row">
            <div className="progress-top">
              <span className="progress-label">{r.label}</span>
              <span className="progress-pct num">
                {pct}%
                <span className={`pace-flag ${behind ? 'behind' : 'ahead'}`}>
                  <Icon name={behind ? 'alert' : 'chevron'} size={11} />
                  {met ? t('Target met', '目標達成') : behind ? t('Behind pace', '遅れ') : t('On pace', '順調')}
                </span>
              </span>
            </div>
            <div className="progress-track" role="img" aria-label={`${r.label}: ${pct}% ${t('of the way to target; time elapsed', '進捗、経過')} ${el}%`}>
              <div className={`progress-fill ${behind ? 'behind' : ''}`} style={{ width: `${share * 100}%` }}></div>
              <div className="progress-tick" style={{ left: `${card.elapsed_share * 100}%` }}></div>
            </div>
            <div className="progress-meta num">
              {card.baseline_year ?? 'FY2023'} {fmtUnit(r.baseline, r.prefix, r.unit)} → <strong>{fmtUnit(r.current, r.prefix, r.unit)}</strong>{' '}
              <span className={`year-tag ${r.todo ? 'flag' : ''}`} title={r.todo}>
                {r.current_year}
              </span>{' '}
              → {card.target_year ?? 'FY2029'} {fmtUnit(r.target, r.prefix, r.unit)}
            </div>
            {r.source && (
              <div className="progress-source">
                {t('Source', '出典')}: {r.source}
              </div>
            )}
            {r.todo && <div className="s-todo small">{r.todo}</div>}
          </div>
        )
      })}
    </div>
  )
}

function FormulaTable({ card }: { card: FormulaTableCard }) {
  const { t } = useLang()
  const rows = card.rows.map((r) => ({ ...r, total: r.terms.reduce((a, b) => a * b, 1) }))
  const max = Math.max(1, ...rows.map((r) => r.total))
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('Lever', 'レバー')}</th>
            <th>{t('Calculation', '計算')}</th>
            <th className="num">{t('Extra spend / yr', '年間追加消費')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.lever}>
              <td>{r.lever}</td>
              <td className="mono muted">{r.formula}</td>
              <td className="num">
                <span className="cell-bar">
                  <span className="cell-bar-fill" style={{ width: `${(r.total / max) * 100}%` }}></span>
                  <span className="cell-bar-val">{fmtYen(r.total)}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Bars({ card }: { card: BarsCard }) {
  const values = card.rows.map((r) => Math.abs(r.value ?? 0))
  const max = Math.max(1e-9, ...values)
  const fmt = (v: number) => {
    const s = card.decimals !== undefined ? v.toFixed(card.decimals).replace(/^(-?)0\./, '$1.') : v.toLocaleString('en-US')
    return `${card.signed && v > 0 ? '+' : ''}${card.prefix ?? ''}${s}${card.unit ?? ''}`
  }
  return (
    <div className={`hbars ${card.signed ? 'signed' : ''}`} role="list">
      {card.rows.map((r) => (
        <div key={r.label} role="listitem" className="hbar-row" title={r.value === null ? `${r.label}: ${PENDING}` : `${r.label}: ${fmt(r.value)}`}>
          <span className="hbar-label">{r.label}</span>
          <span className="hbar-track">
            {card.signed && <span className="hbar-zero"></span>}
            {r.value === null ? (
              <span className="hbar-fill pending" style={{ width: '100%' }}></span>
            ) : (
              <span
                className={`hbar-fill ${r.value < 0 ? 'neg' : ''}`}
                style={
                  card.signed
                    ? { width: `${(Math.abs(r.value) / max) * 50}%`, left: r.value < 0 ? `${50 - (Math.abs(r.value) / max) * 50}%` : '50%' }
                    : { width: `${(Math.abs(r.value) / max) * 100}%` }
                }
              ></span>
            )}
          </span>
          <span className={`hbar-value num ${r.value === null ? 'pending' : ''}`}>{r.value === null ? PENDING : (r.approx ? '~' : '') + fmt(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

const ACTION_TONE: Record<string, string> = { Normal: 'ok', 'Extend hours': 'up', 'Push indoor sites': 'warn' }

function Forecast({ card }: { card: ForecastCard }) {
  const { t } = useLang()
  const [siteId, setSiteId] = useState(card.sites[0]?.id)
  const site = card.sites.find((s) => s.id === siteId) ?? card.sites[0]
  if (!site) return null
  const rows = site.points.map((p) => ({ ...p, range: p.lo !== null && p.hi !== null ? [p.lo, p.hi] : null }))
  const firstFc = site.points.find((p) => p.forecast !== null && p.actual === null)?.date ?? site.points.find((p) => p.forecast !== null)?.date
  const last = site.points[site.points.length - 1]?.date
  return (
    <div>
      <div className="seg" role="group" aria-label={t('Site', '地点')}>
        {card.sites.map((s) => (
          <button key={s.id} aria-pressed={s.id === site.id} onClick={() => setSiteId(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="forecast-layout">
        <div className="forecast-chart">
          <div className="chart-key">
            <span>
              <i className="k-line" style={{ borderColor: S[0] }}></i>
              {t('Counted', '実測')}
            </span>
            <span>
              <i className="k-line dash" style={{ borderColor: S[1] }}></i>
              {t('Forecast', '予測')}
            </span>
            <span>
              <i className="k-band" style={{ background: 'rgba(217,89,38,.28)' }}></i>
              {t('Forecast range', '予測幅')}
            </span>
            <span>
              <i className="k-dot"></i>
              {t('Severe weather', '荒天')}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#1f2a3f" vertical={false} />
              {firstFc && last && <ReferenceArea x1={firstFc} x2={last} fill="#8b9dff" fillOpacity={0.06} ifOverflow="visible" />}
              <XAxis dataKey="date" tick={AXIS} tickFormatter={(d: string) => d.slice(5).replace('-', '/')} minTickGap={28} tickLine={false} axisLine={{ stroke: '#34425e' }} />
              <YAxis tick={AXIS} tickFormatter={(v: number) => fmtCompact(v)} width={44} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={TIP}
                formatter={(v: unknown, name: unknown) => [Array.isArray(v) ? v.map((x) => Number(x).toLocaleString('en-US')).join('–') : Number(v).toLocaleString('en-US'), String(name)]}
              />
              <Area dataKey="range" name={t('Forecast range', '予測幅')} stroke="none" fill={S[1]} fillOpacity={0.16} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="actual" name={t('Counted', '実測')} stroke={S[0]} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="forecast" name={t('Forecast', '予測')} stroke={S[1]} strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false} />
              {site.points
                .filter((p) => p.severe_weather)
                .map((p) => (
                  <ReferenceDot key={p.date} x={p.date} y={0} r={5} fill="#d03b3b" stroke="#121c2f" strokeWidth={2} ifOverflow="visible" />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="next7">
          <h4 className="mini-h">{t('Next 7 days', '今後7日間')}</h4>
          <table className="data-table compact">
            <thead>
              <tr>
                <th>{t('Day', '日')}</th>
                <th className="num">{t('Expected', '見込み')}</th>
                <th>{t('Action', '対応')}</th>
              </tr>
            </thead>
            <tbody>
              {site.next7.map((r) => (
                <tr key={r.day}>
                  <td>{r.day}</td>
                  <td className="num">{r.range}</td>
                  <td>
                    <span className={`action-tag a-${ACTION_TONE[r.action] ?? 'ok'}`}>{r.action}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/** Start index of the lowest-sum run of 3 consecutive months (wrapping Dec→Jan). */
function quietestRun(values: number[]): number {
  let best = 0
  let bestSum = Infinity
  for (let i = 0; i < values.length; i++) {
    const s = values[i] + values[(i + 1) % values.length] + values[(i + 2) % values.length]
    if (s < bestSum) {
      bestSum = s
      best = i
    }
  }
  return best
}

const MODEL_LABEL: Record<string, [string, string]> = {
  seasonal_naive: ['Same month last year', '前年同月'],
  own_growth: ['Same month last year + its own recent growth', '前年同月＋直近の伸び'],
  neighbour_growth: ['Same month last year + Ishikawa and Toyama growth', '前年同月＋石川・富山の伸び'],
}

/** 12-month forecast (F2) from monthly_forecast.json: actual months, forecast and range, and this year's expected total. */
function MonthlyForecast({ card }: { card: MonthlyForecastCard }) {
  const { t } = useLang()
  const file = useJsonResource<MonthlyForecastFile>('monthly_forecast.json')
  const [pick, setPick] = useState(card.series[0])
  const offered = (file.data?.series ?? []).filter((x) => card.series.includes(x.id))
  const s = offered.find((x) => x.id === pick) ?? offered[0]
  if (file.isLoading) return <p className="muted small">{t('Loading…', '読み込み中…')}</p>
  if (!s) return <p className="muted small">{t('The monthly forecast is not published yet.', '月次予測はまだ公開されていません。')}</p>

  const rows = [
    ...s.actual.map((a) => ({ month: a.month, actual: a.value as number | null, forecast: null as number | null, range: null as number[] | null })),
    ...s.forecast.map((f) => ({ month: f.month, actual: null, forecast: f.predicted, range: f.low !== null && f.high !== null ? [f.low, f.high] : null })),
  ]
  // Join the dashed forecast line to the last actual month.
  const lastActual = rows[s.actual.length - 1]
  if (lastActual && s.forecast.length) lastActual.forecast = lastActual.actual
  const year = s.data_through.slice(0, 4)
  const total = yearTotal(s, year)
  const prevYear = String(Number(year) - 1)
  const prev = measuredYear(s, prevYear)
  const pct = (v: number) => {
    const p = Math.round(((v - prev!) / prev!) * 1000) / 10
    return `${p >= 0 ? '+' : ''}${p}%`
  }
  const unit = s.kind === 'guest_nights' ? t('guest-nights', '延べ宿泊者') : t('visitors', '来訪者')
  const fmtN = (v: number) => Math.round(v).toLocaleString('en-US')

  return (
    <div>
      <div className="seg seg-wrap" role="group" aria-label={t('Series', '系列')}>
        {offered.map((x) => (
          <button key={x.id} aria-pressed={x.id === s.id} onClick={() => setPick(x.id)}>
            {t(x.label, x.label_ja)}
          </button>
        ))}
      </div>
      <div className="forecast-layout">
        <div className="forecast-chart">
          <div className="chart-key">
            <span>
              <i className="k-line" style={{ borderColor: S[0] }}></i>
              {t('Actual', '実績')}
            </span>
            <span>
              <i className="k-line dash" style={{ borderColor: S[1] }}></i>
              {t('Forecast', '予測')}
            </span>
            <span>
              <i className="k-band" style={{ background: 'rgba(217,89,38,.28)' }}></i>
              {t('Likely range', '予測範囲')}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#1f2a3f" vertical={false} />
              <XAxis dataKey="month" tick={AXIS} tickFormatter={(m: string) => `${m.slice(2, 4)}/${m.slice(5)}`} minTickGap={16} tickLine={false} axisLine={{ stroke: '#34425e' }} />
              <YAxis tick={AXIS} tickFormatter={(v: number) => fmtCompact(v)} width={48} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={TIP}
                formatter={(v: unknown, name: unknown) => [Array.isArray(v) ? v.map((x) => fmtN(Number(x))).join('–') : fmtN(Number(v)), String(name)]}
              />
              <Area dataKey="range" name={t('Likely range', '予測範囲')} stroke="none" fill={S[1]} fillOpacity={0.16} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="actual" name={t('Actual', '実績')} stroke={S[0]} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="forecast" name={t('Forecast', '予測')} stroke={S[1]} strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="next7">
          <h4 className="mini-h">{t(`Expected in ${year}`, `${year}年の見込み`)}</h4>
          {total ? (
            <>
              <div className="stat-value num">{fmtN(total.total)}</div>
              {total.low !== null && total.high !== null && (
                <p className="muted small num">
                  {t('Range', '範囲')} {fmtN(total.low)}–{fmtN(total.high)}
                </p>
              )}
              {prev !== null && (
                <p className="mf-vs num">
                  {t(`vs ${prevYear}: ${fmtN(prev)}`, `${prevYear}年：${fmtN(prev)}`)} <strong className={total.total >= prev ? 'sum-up' : 'sum-down'}>{pct(total.total)}</strong>
                  {total.low !== null && total.high !== null && (
                    <span className="muted small">
                      {' '}
                      ({t('range', '範囲')} {pct(total.low)} {t('to', '〜')} {pct(total.high)})
                    </span>
                  )}
                </p>
              )}
              <p className="muted small">
                {t(
                  `${unit}: ${total.actualMonths} actual months (${fmtN(total.actualSum)}) plus the forecast for the other ${12 - total.actualMonths}.`,
                  `${unit}：実績${total.actualMonths}か月（${fmtN(total.actualSum)}）＋残り${12 - total.actualMonths}か月の予測。`,
                )}
              </p>
            </>
          ) : (
            <p className="muted small">{t('Not enough months for this year yet.', '今年の月数がまだ足りません。')}</p>
          )}
          <dl className="mf-facts">
            <dt>{t('Model', 'モデル')}</dt>
            <dd>{MODEL_LABEL[s.model] ? t(MODEL_LABEL[s.model][0], MODEL_LABEL[s.model][1]) : s.model}</dd>
            <dt>{t('Typical error', '典型的な誤差')}</dt>
            <dd className="num">{s.backtest_mape_pct !== null ? `${s.backtest_mape_pct}%` : PENDING}</dd>
            <dt>{t('Data to', 'データ')}</dt>
            <dd className="num">{s.data_through}</dd>
          </dl>
          {s.range_rough && <p className="muted small">{t('The range is rough: fewer than 12 months to test the model on.', '範囲は目安です：検証できる月が12か月未満。')}</p>}
          {s.kind === 'visitors' && (
            <p className="muted small">
              {t(
                "Visitor counts are comparable from Jan 2025 only (the publisher revised its method). They are JTTA's digital tourism statistics, which count differently from the prefecture's official visitor total in Q1 (21.44M in 2025), so the two don't match.",
                '来訪者数は2025年1月以降のみ比較可能（公表元の手法改定）。日本観光振興協会のデジタル観光統計で、Q1の県公式の観光客入込数（2025年2,144万人）とは数え方が異なるため一致しません。',
              )}
            </p>
          )}
          <p className="muted small">
            {t('Source', '出典')}: {s.kind === 'visitors' ? t('JTTA digital tourism statistics', '日本観光振興協会 デジタル観光統計') : t('JTA accommodation survey', '観光庁 宿泊旅行統計調査')}
          </p>
        </div>
      </div>
    </div>
  )
}

function MonthlyShare({ card }: { card: MonthlyShareCard }) {
  const { t } = useLang()
  const start = quietestRun(card.values)
  const quiet = new Set([start, (start + 1) % 12, (start + 2) % 12])
  const rows = card.months.map((m, i) => ({ month: m, share: card.values[i], quiet: quiet.has(i) }))
  return (
    <div className="monthly-layout">
      <div className="monthly-chart">
        <div className="chart-key">
          <span>
            <i className="k-band" style={{ background: S[0] }}></i>
            {t('Share of annual visitors', '年間来訪者に占める割合')}
          </span>
          <span>
            <i className="k-band" style={{ background: S[1] }}></i>
            {t('Quietest 3 consecutive months', '最も少ない連続3か月')}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={rows} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1f2a3f" vertical={false} />
            <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={{ stroke: '#34425e' }} />
            <YAxis tick={AXIS} unit="%" width={40} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TIP} cursor={{ fill: 'rgba(139,157,255,.08)' }} formatter={(v: unknown) => [`${v}%`, t('Share of year', '年間比')]} />
            <Bar dataKey="share" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} label={{ position: 'top', fill: '#aeb9cd', fontSize: 10, formatter: (v: unknown) => `${v}` }}>
              {rows.map((r) => (
                <Cell key={r.month} fill={r.quiet ? S[1] : S[0]} fillOpacity={r.quiet ? 1 : 0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {card.kpi && (
        <div className="kpi-side">
          <div className="eyebrow">{card.kpi.label}</div>
          <div className={`stat-value ${card.kpi.value_text === null ? 'pending' : ''}`}>{card.kpi.value_text ?? PENDING}</div>
          <StatusPill status={card.kpi.status} />
          <p className="muted small">
            {t('Quietest run', '最も少ない期間')}: {rows.filter((r) => r.quiet).map((r) => r.month).join(' · ')} ={' '}
            {rows
              .filter((r) => r.quiet)
              .reduce((a, r) => a + r.share, 0)
              .toFixed(1)}
            %
          </p>
        </div>
      )}
    </div>
  )
}

/** Sequential blue for dark surfaces: low values sit near the surface, high values are light. */
const SEQ = ['#16304f', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4']

function Heatmap({ card }: { card: HeatmapCard }) {
  const { t } = useLang()
  const shown = card.cells.flat().filter((c) => c.n >= card.min_n)
  const max = Math.max(1, ...shown.map((c) => c.value))
  const min = Math.min(...shown.map((c) => c.value))
  const col = (v: number) => SEQ[Math.min(SEQ.length - 1, Math.floor(((v - min) / Math.max(1, max - min)) * (SEQ.length - 0.01)))]
  return (
    <div className="heat-wrap">
      <table className="heat">
        <thead>
          <tr>
            <th></th>
            {card.cols.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {card.rows.map((r, ri) => (
            <tr key={r}>
              <th scope="row">{r}</th>
              {card.cells[ri].map((c, ci) => {
                if (c.n < card.min_n)
                  return (
                    <td key={ci} className="heat-hidden" title={`n = ${c.n} (< ${card.min_n}), hidden`}>
                      n&lt;{card.min_n}
                    </td>
                  )
                const bg = col(c.value)
                const light = SEQ.indexOf(bg) >= 4
                return (
                  <td key={ci} style={{ background: bg, color: light ? '#0a1120' : '#e9eef8' }} title={`${r} × ${card.cols[ci]}: ${c.value}${card.unit} (n = ${c.n})`}>
                    {c.value}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="heat-scale">
        <span>
          {min}
          {card.unit}
        </span>
        <span className="heat-scale-bar" style={{ background: `linear-gradient(90deg, ${SEQ.join(',')})` }}></span>
        <span>
          {max}
          {card.unit}
        </span>
        <span className="muted">· {t('hatched = fewer than', '斜線＝')} {card.min_n} {t('responses', '件未満')}</span>
      </div>
    </div>
  )
}

/** Where each funnel stage's leak shows on the map, keyed by the stage's first word. */
const FUNNEL_MAP: Record<string, { ja: string; layers: LayerId[]; node?: string; en: string; ja_where: string }> = {
  discover: { ja: '認知', layers: ['rsi'], en: 'Search intent: how often people search routes to each town. Low interest means few people hear of Fukui.', ja_where: '検索関心：各市町へのルート検索の多さ。関心が低いと福井を知る人が少ない。' },
  decide: { ja: '検討', layers: ['reviews', 'hotels'], en: 'Reviews and hotels: what visitors see when they choose. The bookable-products audit is still pending.', ja_where: 'レビューとホテル：来訪者が選ぶ時に見る情報。予約可能な商品の調査は未実施。' },
  reach: { ja: '移動・周遊', layers: ['traffic', 'flow'], node: 'tojinbo', en: 'Traffic and people flow around Tojinbo, which has no direct bus from Fukui Station.', ja_where: '東尋坊周辺の交通と人流。福井駅からの直通バスがない。' },
  stay: { ja: '宿泊', layers: ['hotels', 'economics'], en: 'Hotels and economics: how full hotels are and the overnight spend lost to neighbouring areas.', ja_where: 'ホテルと経済：ホテルの稼働率と、近隣地域に流出した宿泊消費。' },
  return: { ja: '再訪', layers: ['survey'], en: 'Survey: satisfaction and how likely visitors are to come back or recommend Fukui.', ja_where: 'アンケート：満足度と、再訪・推奨の意向。' },
}

const stageKey = (stage: string) => stage.split(/[\s/]/)[0].toLowerCase()

/** Opens the map with the stage's layers on (and its site, if any) through the saved layer choice. */
function showOnMap(where: { layers: LayerId[]; node?: string }) {
  storeLayers(where.layers)
  storePanelOpen(true)
  window.location.hash = `/map${where.node ? `/${where.node}` : ''}`
}

function Funnel({ card }: { card: FunnelCard }) {
  const { t } = useLang()
  const [picked, setPicked] = useState<string | null>(null)
  const sel = card.stages.find((s) => s.stage === picked)
  const where = sel ? FUNNEL_MAP[stageKey(sel.stage)] : undefined
  return (
    <>
      <ol className="funnel">
        {card.stages.map((s, i) => (
          <li key={s.stage} className={`funnel-stage ${picked === s.stage ? 'on' : ''}`} onClick={() => setPicked(picked === s.stage ? null : s.stage)}>
            <div className="funnel-step">{i + 1}</div>
            <div className="funnel-name">
              <button className="funnel-pick" aria-pressed={picked === s.stage} onClick={(e) => { e.stopPropagation(); setPicked(picked === s.stage ? null : s.stage) }}>
                {t(s.stage, FUNNEL_MAP[stageKey(s.stage)]?.ja ?? s.stage)}
              </button>
            </div>
            <div className={`funnel-gap ${s.gap_pct === null ? 'pending' : ''}`}>
              {s.gap_pct === null ? PENDING : `${s.gap_pct}%`}
              <span className="funnel-gap-lab">{t('gap vs Kanazawa', '金沢との差')}</span>
            </div>
            <div className="funnel-track" role="img" aria-label={s.gap_pct === null ? PENDING : `${s.gap_pct}%`}>
              {s.gap_pct === null ? <span className="pending" style={{ width: '100%' }}></span> : <span style={{ width: `${s.gap_pct}%` }}></span>}
            </div>
            <div className="funnel-evidence">{s.evidence}</div>
            <div className="funnel-value">
              <span className="muted">{t('At stake', '損失額')}</span> <strong className={s.value_text === null ? 'pending' : ''}>{s.value_text ?? '¥[x]bn'}</strong>
            </div>
          </li>
        ))}
      </ol>
      {sel && where ? (
        <div className="funnel-where" role="status">
          <span className="funnel-where-text">
            <strong>{t(sel.stage, where.ja)}:</strong> {t(where.en, where.ja_where)}
          </span>
          <button className="btn btn-accent" onClick={() => showOnMap(where)}>
            <Icon name="map" /> {t('Show on map', '地図で見る')}
          </button>
        </div>
      ) : (
        <p className="funnel-hint muted small">{t('Click a stage to see where its leak shows on the map.', '段階をクリックすると、地図上のどこで流出が見えるかを表示します。')}</p>
      )}
    </>
  )
}

const SEV = {
  crit: { en: 'Critical', ja: '重大', icon: 'alert' as const },
  warn: { en: 'Warning', ja: '注意', icon: 'alert' as const },
  ok: { en: 'OK', ja: '良好', icon: 'chevron' as const },
  pending: { en: 'Pending', ja: '待ち', icon: 'now' as const },
}

function Indicators({ card }: { card: IndicatorsCard }) {
  const { t } = useLang()
  return (
    <div className="indicators">
      {card.items.map((it) => (
        <div key={it.label} className={`indicator sev-${it.severity}`}>
          <div className={`indicator-value ${it.value_text === null ? 'pending' : ''}`}>{it.value_text ?? PENDING}</div>
          <div className="indicator-label">{it.label}</div>
          <div className="indicator-foot">
            <span className={`sev-tag sev-${it.severity}`}>
              <Icon name={SEV[it.severity].icon} size={12} />
              {t(SEV[it.severity].en, SEV[it.severity].ja)}
            </span>
            <StatusPill status={it.status} />
          </div>
          {it.pending_on && (
            <div className="muted small">
              {t('Pending on', '待ち')}: {it.pending_on}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PaceBar({ pace }: { pace: { value: number; expected: number; label?: string } }) {
  const behind = pace.value < pace.expected
  return (
    <span className="pace" title={pace.label}>
      <span className="pace-track">
        <span className={`pace-fill ${behind ? 'behind' : ''}`} style={{ width: `${pace.value * 100}%` }}></span>
        <span className="pace-exp" style={{ left: `${pace.expected * 100}%` }}></span>
      </span>
      <span className="num">
        {pace.value.toFixed(2).replace(/^0/, '')} vs {pace.expected.toFixed(2).replace(/^0/, '')}
      </span>
    </span>
  )
}

function DataTable({ card }: { card: TableCard }) {
  const hasStatusCol = card.columns.length > (card.rows[0]?.cells.length ?? 0)
  const paceCol = card.columns.findIndex((c) => c.toLowerCase() === 'pace')
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {card.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {card.rows.map((r, i) => (
            <tr key={i}>
              {r.cells.map((c, j) => (
                <td key={j} className={c === null ? 'pending-cell' : c === 'Not yet measurable' ? 'muted' : ''}>
                  {j === paceCol && r.pace ? <PaceBar pace={r.pace} /> : (c ?? PENDING)}
                </td>
              ))}
              {hasStatusCol && (
                <td>
                  <StatusPill status={r.status} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Builder({ card }: { card: BuilderCard }) {
  const { t } = useLang()
  const [vals, setVals] = useState<Record<string, number>>(() => Object.fromEntries(card.levers.map((l) => [l.id, l.default])))
  const added = card.levers.map((l, k) => {
    const v = vals[l.id] ?? 0
    const guests = l.unit === '%' ? (l.base * v) / 100 : v * l.base
    return { lever: l, guests, spend: guests * l.spend_per, colour: S[k % S.length] }
  })
  const totalSpend = added.reduce((a, b) => a + b.spend, 0)
  return (
    <div className="builder">
      <div className="builder-levers">
        {card.levers.map((l, k) => (
          <label key={l.id} className="lever">
            <span className="lever-head">
              <span className="lever-name">
                <i className="lever-sw" style={{ background: S[k % S.length] }}></i>
                {l.label}
              </span>
              <span className="num lever-val">{l.unit === '%' ? `${vals[l.id]}%` : `${(vals[l.id] ?? 0).toLocaleString('en-US')} ${l.unit}`}</span>
            </span>
            <input
              type="range"
              min={l.min}
              max={l.max}
              step={l.step}
              value={vals[l.id]}
              style={{ ['--pct' as string]: `${(((vals[l.id] ?? 0) - l.min) / (l.max - l.min)) * 100}%`, ['--c' as string]: S[k % S.length] }}
              onChange={(e) => setVals((s) => ({ ...s, [l.id]: Number(e.target.value) }))}
            />
            <span className="lever-help">{l.help}</span>
          </label>
        ))}
      </div>
      <div className="builder-out">
        {card.gaps.map((g) => {
          const parts = added.filter((a) => a.lever.counts.includes(g.id))
          const closed = parts.reduce((s, a) => s + a.guests, 0)
          const share = Math.min(1, closed / g.gap)
          let acc = 0
          return (
            <div key={g.id} className="gap-row">
              <div className="progress-top">
                <span className="progress-label">{g.label}</span>
                <span className="num">
                  {fmtCompact(closed)} {t('of', '/')} {fmtCompact(g.gap)} <strong>({Math.round(share * 100)}%)</strong>
                </span>
              </div>
              <div className="stack-track" role="img" aria-label={`${g.label}: ${Math.round(share * 100)}%`}>
                {parts.map((p) => {
                  const w = Math.max(0, Math.min(1 - acc, p.guests / g.gap))
                  const left = acc
                  acc += w
                  return w > 0 ? (
                    <span key={p.lever.id} className="stack-seg" style={{ left: `${left * 100}%`, width: `${w * 100}%`, background: p.colour }} title={`${p.lever.id}: ${fmtCompact(p.guests)}`}></span>
                  ) : null
                })}
              </div>
              <div className="stack-key">
                {parts.map((p) => (
                  <span key={p.lever.id}>
                    <i style={{ background: p.colour }}></i>
                    {p.lever.id} {fmtCompact(p.guests)}
                  </span>
                ))}
                <span className="muted">
                  {t('Gap', 'ギャップ')} = {g.formula}
                </span>
              </div>
            </div>
          )
        })}
        <div className="builder-total">
          <span className="eyebrow">{t('Spend added per year', '年間の追加消費')}</span>
          <span className="stat-value">{fmtYen(totalSpend)}</span>
          <span className="muted small">
            {t('Spend per added guest', '追加1人あたり消費')}: {card.levers.map((l) => `${l.id} ¥${l.spend_per.toLocaleString('en-US')}`).join(' · ')}
          </span>
        </div>
      </div>
    </div>
  )
}
