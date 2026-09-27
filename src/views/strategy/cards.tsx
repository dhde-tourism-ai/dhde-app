import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  BarsCard,
  BuilderCard,
  ForecastCard,
  FormulaTableCard,
  FunnelCard,
  HeatmapCard,
  IndicatorsCard,
  MonthlyShareCard,
  ProgressCard,
  StatCard,
  StrategyCard,
  TableCard,
} from '../../types/strategy'
import { StatusPill } from '../../components/StatusPill'
import { fmtCompact, fmtYen, PENDING } from '../../lib/format'

const AXIS_TICK = { fontFamily: 'JetBrains Mono', fontSize: 10 }

/** Card frame: title, status pill (always shown), notes and TODOs. */
export function StrategyCardView({ card }: { card: StrategyCard }) {
  return (
    <article className={`s-card s-card-${card.status}`} style={{ gridColumn: `span ${card.span}` }}>
      <header className="s-card-head">
        <h3>{card.title}</h3>
        <StatusPill status={card.status} />
      </header>
      <CardBody card={card} />
      {card.note && <p className="s-note">{card.note}</p>}
      {card.pending_on && <p className="s-note">Pending on: {card.pending_on}</p>}
      {card.source && <p className="s-note">Source: {card.source}</p>}
      {card.todo && <p className="s-todo">TODO: {card.todo}</p>}
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
  }
}

function Stat({ card }: { card: StatCard }) {
  return (
    <div>
      <div className={`s-stat ${card.value_text === null ? 'pending' : ''}`}>
        {card.value_text ?? PENDING}
        {card.value_text !== null && card.unit}
      </div>
      {card.detail && <div className="s-detail">{card.detail}</div>}
    </div>
  )
}

function fmtUnit(v: number, prefix: string, unit: string): string {
  return `${prefix}${v.toLocaleString('en-US')}${unit}`
}

function Progress({ card }: { card: ProgressCard }) {
  return (
    <div className="progress-list">
      {card.rows.map((r) => {
        const share = Math.max(0, Math.min(1, (r.current - r.baseline) / (r.target - r.baseline)))
        const behind = share < card.elapsed_share
        return (
          <div key={r.label} className="progress-row">
            <div className="progress-label">
              <span>{r.label}</span>
              <span className="progress-pct">
                {Math.round(share * 100)}%{behind && <span className="behind"> behind pace</span>}
              </span>
            </div>
            <div
              className="progress-track"
              role="img"
              aria-label={`${r.label}: ${Math.round(share * 100)}% of the way to target`}
              title={`${Math.round(share * 100)}% of the way; time elapsed ${Math.round(card.elapsed_share * 100)}%`}
            >
              <div className={`progress-fill ${behind ? 'behind' : ''}`} style={{ width: `${share * 100}%` }}></div>
              <div className="progress-tick" style={{ left: `${card.elapsed_share * 100}%` }}></div>
            </div>
            <div className="progress-meta">
              FY2023 {fmtUnit(r.baseline, r.prefix, r.unit)} → <strong>{fmtUnit(r.current, r.prefix, r.unit)}</strong>{' '}
              <span className={`year-tag ${r.todo ? 'flag' : ''}`} title={r.todo}>
                {r.current_year}
              </span>{' '}
              → FY2029 {fmtUnit(r.target, r.prefix, r.unit)}
            </div>
            {r.todo && <div className="s-todo">TODO: {r.todo}</div>}
          </div>
        )
      })}
    </div>
  )
}

function FormulaTable({ card }: { card: FormulaTableCard }) {
  return (
    <table className="s-table">
      <thead>
        <tr>
          <th>Lever</th>
          <th>Calculation</th>
          <th className="num">Extra spend / yr</th>
        </tr>
      </thead>
      <tbody>
        {card.rows.map((r) => (
          <tr key={r.lever}>
            <td>{r.lever}</td>
            <td className="mono">{r.formula}</td>
            <td className="num mono">{fmtYen(r.terms.reduce((a, b) => a * b, 1))}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
    <div className="hbars">
      {card.rows.map((r) => (
        <div key={r.label} className="hbar-row" title={r.value === null ? `${r.label}: ${PENDING}` : `${r.label}: ${fmt(r.value)}`}>
          <span className="hbar-label">{r.label}</span>
          <span className={`hbar-track ${card.signed ? 'signed' : ''}`}>
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
          <span className="hbar-value">{r.value === null ? PENDING : (r.approx ? '~' : '') + fmt(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

function Forecast({ card }: { card: ForecastCard }) {
  const [siteId, setSiteId] = useState(card.sites[0]?.id)
  const site = card.sites.find((s) => s.id === siteId) ?? card.sites[0]
  if (!site) return null
  const rows = site.points.map((p) => ({ ...p, range: p.lo !== null && p.hi !== null ? [p.lo, p.hi] : null }))
  return (
    <div>
      <div className="seg small" role="group" aria-label="Site">
        {card.sites.map((s) => (
          <button key={s.id} className={`seg-btn ${s.id === site.id ? 'active' : ''}`} onClick={() => setSiteId(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="forecast-layout">
        <div className="forecast-chart">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,43,70,0.06)" />
              <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
              <YAxis tick={AXIS_TICK} tickFormatter={(v: number) => fmtCompact(v)} width={44} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--washi-card)', borderColor: 'var(--hairline)', fontSize: 12 }}
                formatter={(v: unknown, name: unknown) => [Array.isArray(v) ? v.map((x) => Number(x).toLocaleString('en-US')).join('–') : Number(v).toLocaleString('en-US'), String(name)]}
              />
              <Area dataKey="range" name="Forecast range" stroke="none" fill="#B5432E" fillOpacity={0.12} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="actual" name="Counted" stroke="#0F2B46" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="forecast" name="Forecast" stroke="#B5432E" strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false} />
              {site.points
                .filter((p) => p.severe_weather)
                .map((p) => (
                  <ReferenceDot key={p.date} x={p.date} y={0} r={5} fill="#9C2E2E" stroke="#FFFDF8" strokeWidth={2} ifOverflow="visible" />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
          <div className="chart-key">
            <span><i className="k-line"></i>Counted</span>
            <span><i className="k-dash"></i>Forecast</span>
            <span><i className="k-band"></i>Forecast range</span>
            <span><i className="k-dot"></i>Severe weather</span>
          </div>
        </div>
        <table className="s-table next7">
          <caption>Next 7 days</caption>
          <thead>
            <tr>
              <th>Day</th>
              <th>Expected range</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {site.next7.map((r) => (
              <tr key={r.day}>
                <td>{r.day}</td>
                <td className="mono">{r.range}</td>
                <td>{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

function MonthlyShare({ card }: { card: MonthlyShareCard }) {
  const start = quietestRun(card.values)
  const quiet = new Set([start, (start + 1) % 12, (start + 2) % 12])
  const rows = card.months.map((m, i) => ({ month: m, share: card.values[i], quiet: quiet.has(i) }))
  return (
    <div className="monthly-layout">
      <div className="monthly-chart">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={rows} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,43,70,0.06)" vertical={false} />
            <XAxis dataKey="month" tick={AXIS_TICK} />
            <YAxis tick={AXIS_TICK} unit="%" width={40} />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--washi-card)', borderColor: 'var(--hairline)', fontSize: 12 }}
              formatter={(v: unknown) => [`${v}%`, 'Share of year']}
            />
            <Bar dataKey="share" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.month} fill={r.quiet ? '#B5432E' : '#2E6592'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="chart-key">
          <span><i className="k-sq" style={{ background: '#B5432E' }}></i>Quietest 3 consecutive months</span>
        </div>
      </div>
      {card.kpi && (
        <div className="kpi-mini">
          <div className="kpi-label">{card.kpi.label}</div>
          <div className={`s-stat ${card.kpi.value_text === null ? 'pending' : ''}`}>{card.kpi.value_text ?? PENDING}</div>
          <StatusPill status={card.kpi.status} />
        </div>
      )}
    </div>
  )
}

function Heatmap({ card }: { card: HeatmapCard }) {
  const shown = card.cells.flat().filter((c) => c.n >= card.min_n)
  const max = Math.max(1, ...shown.map((c) => c.value))
  return (
    <div className="heat-wrap">
      <table className="heat">
        <thead>
          <tr>
            <th></th>
            {card.cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {card.rows.map((r, ri) => (
            <tr key={r}>
              <th>{r}</th>
              {card.cells[ri].map((c, ci) =>
                c.n < card.min_n ? (
                  <td key={ci} className="heat-hidden" title={`n = ${c.n} (< ${card.min_n}), hidden`}>
                    n&lt;{card.min_n}
                  </td>
                ) : (
                  <td
                    key={ci}
                    style={{ background: `rgba(28,74,115,${0.08 + 0.8 * (c.value / max)})`, color: c.value / max > 0.55 ? '#FFFDF8' : 'var(--ink)' }}
                    title={`${r} × ${card.cols[ci]}: ${c.value}${card.unit} (n = ${c.n})`}
                  >
                    {c.value}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Funnel({ card }: { card: FunnelCard }) {
  return (
    <div className="funnel">
      {card.stages.map((s) => (
        <div key={s.stage} className="funnel-stage">
          <div className="funnel-name">{s.stage}</div>
          <div className={`funnel-gap ${s.gap_pct === null ? 'pending' : ''}`}>{s.gap_pct === null ? PENDING : `${s.gap_pct}% gap`}</div>
          {s.gap_pct !== null && (
            <div className="funnel-track" title={`${s.gap_pct}% gap vs Kanazawa`}>
              <span style={{ width: `${s.gap_pct}%` }}></span>
            </div>
          )}
          <div className="s-detail">{s.evidence}</div>
          <div className="funnel-value">At stake: {s.value_text ?? '¥[x]bn'}</div>
        </div>
      ))}
    </div>
  )
}

const SEVERITY_LABEL = { crit: 'Critical', warn: 'Warning', ok: 'OK', pending: 'Pending' } as const

function Indicators({ card }: { card: IndicatorsCard }) {
  return (
    <div className="indicators">
      {card.items.map((it) => (
        <div key={it.label} className={`indicator sev-${it.severity}`}>
          <div className="indicator-value">{it.value_text ?? PENDING}</div>
          <div className="indicator-label">{it.label}</div>
          <div className="indicator-foot">
            <span className={`sev-tag sev-${it.severity}`}>{SEVERITY_LABEL[it.severity]}</span>
            <StatusPill status={it.status} />
          </div>
          {it.pending_on && <div className="s-note">Pending on: {it.pending_on}</div>}
        </div>
      ))}
    </div>
  )
}

function DataTable({ card }: { card: TableCard }) {
  const hasStatusCol = card.columns.length > (card.rows[0]?.cells.length ?? 0)
  return (
    <div className="table-scroll">
      <table className="s-table">
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
                <td key={j} className={c === null ? 'pending-cell' : ''}>
                  {c ?? PENDING}
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
  const [vals, setVals] = useState<Record<string, number>>(() => Object.fromEntries(card.levers.map((l) => [l.id, l.default])))
  const added = card.levers.map((l) => {
    const v = vals[l.id] ?? 0
    const guests = l.unit === '%' ? (l.base * v) / 100 : v * l.base
    return { lever: l, guests, spend: guests * l.spend_per }
  })
  const totalSpend = added.reduce((a, b) => a + b.spend, 0)
  return (
    <div className="builder">
      <div className="builder-levers">
        {card.levers.map((l) => (
          <label key={l.id} className="lever">
            <span className="lever-head">
              <span>{l.label}</span>
              <span className="mono">
                {l.unit === '%' ? `${vals[l.id]}%` : `${(vals[l.id] ?? 0).toLocaleString('en-US')} ${l.unit}`}
              </span>
            </span>
            <input
              type="range"
              min={l.min}
              max={l.max}
              step={l.step}
              value={vals[l.id]}
              onChange={(e) => setVals((s) => ({ ...s, [l.id]: Number(e.target.value) }))}
            />
            <span className="s-detail">{l.help}</span>
          </label>
        ))}
      </div>
      <div className="builder-out">
        {card.gaps.map((g) => {
          const closed = added.filter((a) => a.lever.counts.includes(g.id)).reduce((s, a) => s + a.guests, 0)
          const share = Math.min(1, closed / g.gap)
          return (
            <div key={g.id} className="gap-row">
              <div className="progress-label">
                <span>{g.label}</span>
                <span className="mono">
                  {fmtCompact(closed)} of {fmtCompact(g.gap)} ({Math.round(share * 100)}%)
                </span>
              </div>
              <div className="progress-track" title={`Gap = ${g.formula}`}>
                <div className="progress-fill" style={{ width: `${share * 100}%` }}></div>
              </div>
              <div className="s-detail">Gap = {g.formula}</div>
            </div>
          )
        })}
        <div className="builder-total">
          Spend added: <strong>{fmtYen(totalSpend)}</strong> / yr
          <span className="s-detail">
            {' '}
            (spend per added guest: {card.levers.map((l) => `${l.id} ¥${l.spend_per.toLocaleString('en-US')}`).join(' · ')})
          </span>
        </div>
      </div>
    </div>
  )
}
