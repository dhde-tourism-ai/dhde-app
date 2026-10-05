import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Bar, CartesianGrid, Cell, ComposedChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { GdpTrendCard, RippleCard, RippleTierId, TourismTrendCard, TourismTrendPoint, WhatIfCard } from '../../types/strategy'
import { useLang } from '../../lib/i18n'
import { AXIS, S } from './chartTheme'
import { ScenarioSlider } from './slider'

// Q1 economy block: Fukui's GDP, tourism's share of it, the ripple by round and a what-if.

const GRID = '#1f2a3f'
const AXIS_LINE = '#34425e'
const BAR_EDGE = '#121c2f'
const TIER: Record<RippleTierId, string> = { direct: '#9ec5f4', indirect1: '#6da7ec', indirect2: '#3987e5' }
const TIERS: RippleTierId[] = ['direct', 'indirect1', 'indirect2']
const RING = '#e9eef8'
const GDP_REST = '#3a4a6b'
const TOURISM = '#d95926'
const PROJ_FILL = '#8b9dff'
/** Axis titles: every chart says what its axes measure. */
const AXIS_TITLE = { fill: '#7f8ba3', fontSize: 11 }
const yTitle = (value: string) => ({ value, angle: -90, position: 'insideLeft' as const, offset: 4, style: { ...AXIS_TITLE, textAnchor: 'middle' as const } })
const xTitle = (value: string) => ({ value, position: 'insideBottom' as const, offset: 0, style: AXIS_TITLE })

function useTierNames(): Record<RippleTierId, string> {
  const { t } = useLang()
  return {
    direct: t('Direct', '直接効果'),
    indirect1: t('Indirect ① suppliers', '第1次間接効果（取引先）'),
    indirect2: t('Indirect ② wage spending', '第2次間接効果（所得の消費）'),
  }
}

const fixed = (v: number, d = 1) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
/** ¥139.0bn */
const bn = (v: number, d = 1) => `¥${fixed(v, d)}bn`
/** ¥4.08tn, from ¥bn */
const tn = (v: number) => `¥${(v / 1e3).toFixed(2)}tn`
/** Jobs rounded to 10 (to 100 from 1,000 up): 33,900 */
const jobs = (v: number) => {
  const step = Math.abs(v) >= 1e3 ? 100 : 10
  return (Math.round(v / step) * step).toLocaleString('en-US')
}
const pct = (v: number, d = 1) => `${v.toFixed(d)}%`

interface TipRow {
  label: string
  value: string
  key?: string
  strong?: boolean
}

function EcoTip({ title, rows, foot }: { title: string; rows: TipRow[]; foot?: string }) {
  return (
    <div className="eco-tip">
      <div className="eco-tip-title">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className={`eco-tip-row ${r.strong ? 'strong' : ''}`}>
          <i className={`eco-tip-key ${r.key ? '' : 'none'}`} style={r.key ? { borderColor: r.key } : undefined}></i>
          <span className="eco-tip-val num">{r.value}</span>
          <span className="eco-tip-lab">{r.label}</span>
        </div>
      ))}
      {foot && <div className="eco-tip-foot">{foot}</div>}
    </div>
  )
}

/** Fukui's GDP each fiscal year, tourism's part in orange; estimated years faded. */
export function GdpTrend({ card }: { card: GdpTrendCard }) {
  const { t } = useLang()
  const rows = card.points.map((p) => {
    const gdp = p.actual ?? p.base ?? 0
    return { ...p, x: String(p.fy), gdp, tour: p.tourism_va, rest: Math.max(gdp - p.tourism_va, 0), proj: p.actual === undefined }
  })
  const firstProj = rows.find((r) => r.proj)?.x
  const last = rows[rows.length - 1]
  const lastPublished = [...rows].reverse().find((r) => !r.proj)
  const top = Math.ceil(Math.max(...rows.map((r) => r.gdp)) / 1e3) * 1e3
  const ticks = Array.from({ length: top / 1e3 + 1 }, (_, i) => i * 1e3)
  return (
    <div>
      <div className="eco-kpis">
        {card.kpis.map((k) => (
          <div key={k.label} className="eco-kpi">
            <div className="eco-kpi-label">{k.label}</div>
            <div className="eco-kpi-value">{k.value_text}</div>
            {k.detail && <div className="eco-kpi-detail">{k.detail}</div>}
          </div>
        ))}
      </div>
      <div className="chart-key">
        <span>
          <i className="k-sw" style={{ background: GDP_REST }}></i>
          {t("Fukui's GDP (rest of the economy)", '県内総生産（観光以外）')}
        </span>
        <span>
          <i className="k-sw" style={{ background: TOURISM }}></i>
          {t("Tourism's contribution", '観光の寄与')}
        </span>
        {firstProj && (
          <span>
            <i className="k-sw" style={{ background: GDP_REST, opacity: 0.45 }}></i>
            {t(`Estimate (FY${firstProj} on)`, `推計（FY${firstProj}以降）`)}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={262}>
        <ComposedChart data={rows} margin={{ top: 18, right: 8, left: 6, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid stroke={GRID} vertical={false} />
          {firstProj && <ReferenceArea x1={firstProj} x2={last.x} fill={PROJ_FILL} fillOpacity={0.06} ifOverflow="visible" />}
          <XAxis dataKey="x" tick={AXIS} tickLine={false} axisLine={{ stroke: AXIS_LINE }} interval={1} tickFormatter={(v: string) => `FY${v.slice(2)}`} height={40} label={xTitle(t('Fiscal year', '年度'))} />
          <YAxis tick={AXIS} width={58} tickLine={false} axisLine={false} domain={[0, top]} ticks={ticks} tickFormatter={(v: number) => (v === 0 ? '0' : `¥${(v / 1e3).toFixed(0)}tn`)} label={yTitle(t('GDP (¥ trillion)', '県内総生産（兆円）'))} />
          <Tooltip
            cursor={{ fill: 'rgba(160,185,230,0.06)' }}
            content={({ active, payload }) => {
              const r = active ? (payload?.[0]?.payload as (typeof rows)[number] | undefined) : undefined
              if (!r) return null
              return (
                <EcoTip
                  title={`FY${r.fy} · ${r.proj ? t('estimate', '推計') : t('published', '公表値')}`}
                  rows={[
                    { key: GDP_REST, label: t("Fukui's GDP", '県内総生産'), value: tn(r.gdp), strong: true },
                    { key: TOURISM, label: t("tourism's contribution", '観光の寄与'), value: bn(r.tour) },
                    { label: t('of GDP', 'GDP比'), value: pct(r.gdp ? (r.tour / r.gdp) * 100 : 0, 2) },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="tour" stackId="g" fill={TOURISM} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.x} fillOpacity={r.proj ? 0.55 : 1} />
            ))}
          </Bar>
          <Bar dataKey="rest" stackId="g" fill={GDP_REST} radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.x} fillOpacity={r.proj ? 0.45 : 1} />
            ))}
          </Bar>
          {lastPublished && (
            <ReferenceDot x={lastPublished.x} y={lastPublished.gdp} r={0} ifOverflow="visible" label={{ value: tn(lastPublished.gdp), position: 'top', fill: '#aeb9cd', fontSize: 10.5, offset: 6 }} />
          )}
          <ReferenceDot x={last.x} y={last.gdp} r={0} ifOverflow="visible" label={{ value: tn(last.gdp), position: 'top', fill: '#aeb9cd', fontSize: 10.5, offset: 6 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

type Measure = 'spend' | 'share' | 'va' | 'jobs'

function byRound(p: TourismTrendPoint, m: Measure): [number, number, number, number] {
  // Revenue isn't split by round: one bar.
  if (m === 'spend') return [p.spend_bn, 0, 0, p.spend_bn]
  if (m === 'share') return [p.share_direct, p.share_indirect1, p.share_indirect2, p.share_total]
  if (m === 'va') return [p.va_direct, p.va_indirect1, p.va_indirect2, p.va_total]
  return [p.jobs_direct, p.jobs_indirect1, p.jobs_indirect2, p.jobs_total]
}

/** Tourism revenue, or tourism's share of GDP, GDP added or jobs stacked by round, each year, with the low–high range on projected years. */
export function TourismTrend({ card, theme }: { card: TourismTrendCard; theme?: string }) {
  const { t } = useLang()
  const names = useTierNames()
  // Under Q1's themes each shows its own measure only: Spending revenue, GDP share and GDP added, Jobs jobs.
  const measures: Measure[] = theme === 'spending' ? ['spend'] : theme === 'jobs' ? ['jobs'] : theme === 'gdp' ? ['share', 'va'] : ['share', 'va', 'jobs']
  const [picked, setM] = useState<Measure>('share')
  const m = measures.includes(picked) ? picked : measures[0]
  const money = m === 'va' || m === 'spend'
  const fmt = (v: number) => (m === 'share' ? pct(v, 2) : money ? bn(v) : jobs(v))
  const tick = (v: number) => (m === 'share' ? `${v}%` : money ? `¥${v}bn` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v))
  const rows = card.points.map((p) => {
    const [d, i1, i2, tot] = byRound(p, m)
    const range = p.range ? p.range[m === 'spend' ? 'spend_bn' : m] : null
    return { x: String(p.year), p, d, i1, i2, tot, lo: range ? range[0] : null, hi: range ? range[1] : null, forecast: p.kind === 'forecast' }
  })
  const firstProj = rows.find((r) => r.forecast)?.x
  const lastModelled = [...rows].reverse().find((r) => !r.forecast)
  const last = rows[rows.length - 1]
  const marks = m === 'spend' ? [] : card.benchmarks.map((b) => ({ ...b, v: b[m] })).filter((b) => b.v !== undefined)
  const peak = Math.max(...rows.map((r) => Math.max(r.tot, r.hi ?? 0)), ...marks.map((b) => b.v ?? 0))
  const step = m === 'share' ? 1 : m === 'va' || m === 'spend' ? 50 : 1e4
  const top = Math.ceil((peak * 1.08) / step) * step
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const faded = (f: boolean) => (f ? 0.5 : 1)
  const ranged = rows.filter((r) => r.lo !== null && r.hi !== null)

  return (
    <div>
      {measures.length > 1 && (
        <div className="eco-controls">
          <div className="seg" role="group" aria-label={t('Measure', '指標')}>
            {measures.map((id) => (
              <button key={id} aria-pressed={m === id} onClick={() => setM(id)}>
                {id === 'share' ? t('Share of GDP', 'GDP比') : id === 'va' ? t('GDP added', '付加価値額') : t('Jobs', '就業者')}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="chart-key">
        {m === 'spend' ? (
          <span>
            <i className="k-band" style={{ background: TIER.direct }}></i>
            {t('Tourism revenue (visitor spend)', '観光消費額')}
          </span>
        ) : (
          TIERS.map((id) => (
            <span key={id}>
              <i className="k-band" style={{ background: TIER[id] }}></i>
              {names[id]}
            </span>
          ))
        )}
        {ranged.length > 0 && (
          <span>
            <i className="k-range"></i>
            {t('Low to high revenue', '観光消費の低位〜高位')}
          </span>
        )}
        {marks.length > 0 && (
          <span>
            <i className="k-ring"></i>
            {t("Prefecture's own estimate", '県の推計')}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={276}>
        <ComposedChart data={rows} margin={{ top: 20, right: 14, left: 6, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke={GRID} vertical={false} />
          {firstProj && (
            <ReferenceArea
              x1={firstProj}
              x2={last.x}
              fill={PROJ_FILL}
              fillOpacity={0.06}
              ifOverflow="visible"
              label={{ value: t('Projection', '予測'), position: 'insideTopLeft', fill: '#7f8ba3', fontSize: 10.5 }}
            />
          )}
          <XAxis dataKey="x" tick={AXIS} tickLine={false} axisLine={{ stroke: AXIS_LINE }} interval={1} tickFormatter={(v: string) => `'${v.slice(2)}`} height={40} label={xTitle(t('Year', '年'))} />
          <YAxis
            tick={AXIS}
            width={58}
            tickLine={false}
            axisLine={false}
            domain={[0, top]}
            ticks={ticks}
            tickFormatter={tick}
            label={yTitle(
              m === 'spend'
                ? t('Tourism revenue (¥ billion)', '観光消費額（10億円）')
                : m === 'share'
                  ? t('Share of Fukui GDP (%)', '県内総生産比（%）')
                  : m === 'va'
                    ? t('GDP added (¥ billion)', '付加価値（10億円）')
                    : t('Jobs supported', '就業者数'),
            )}
          />
          <Tooltip
            cursor={{ fill: 'rgba(139,157,255,.08)' }}
            content={({ active, payload }) => {
              const r = active ? (payload?.[0]?.payload as (typeof rows)[number] | undefined) : undefined
              if (!r) return null
              const tipRows: TipRow[] =
                m === 'spend'
                  ? [{ key: TIER.direct, label: t('tourism revenue', '観光消費額'), value: fmt(r.tot), strong: true }]
                  : [...TIERS.map((id, i) => ({ key: TIER[id], label: names[id], value: fmt([r.d, r.i1, r.i2][i]) })), { label: t('total', '合計'), value: fmt(r.tot), strong: true }]
              if (r.lo !== null && r.hi !== null) tipRows.push({ key: S[1], label: t('low to high revenue', '低位〜高位'), value: `${fmt(r.lo)} – ${fmt(r.hi)}` })
              const b = marks.find((x) => String(x.year) === r.x)
              if (b?.v !== undefined) tipRows.push({ key: RING, label: b.label, value: fmt(b.v) })
              const est = r.p.gdp_kind === 'actual' ? '' : t(' (estimate)', '（推計）')
              return (
                <EcoTip
                  title={`${r.x}${r.forecast ? t(' · base projection', '・基準予測') : ''}`}
                  rows={tipRows}
                  foot={m === 'spend' ? undefined : `${t('Tourism revenue', '観光消費額')} ${bn(r.p.spend_bn)} · GDP ${tn(r.p.gdp_bn)}${est}`}
                />
              )
            }}
          />
          <Bar dataKey="d" stackId="t" fill={TIER.direct} stroke={BAR_EDGE} strokeWidth={1.5} maxBarSize={24} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.x} fillOpacity={faded(r.forecast)} />
            ))}
          </Bar>
          <Bar dataKey="i1" stackId="t" fill={TIER.indirect1} stroke={BAR_EDGE} strokeWidth={1.5} maxBarSize={24} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.x} fillOpacity={faded(r.forecast)} />
            ))}
          </Bar>
          <Bar dataKey="i2" stackId="t" fill={TIER.indirect2} stroke={BAR_EDGE} strokeWidth={1.5} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.x} fillOpacity={faded(r.forecast)} />
            ))}
          </Bar>
          {ranged.map((r) => (
            <ReferenceLine
              key={`rng-${r.x}`}
              segment={[
                { x: r.x, y: r.lo! },
                { x: r.x, y: r.hi! },
              ]}
              stroke={S[1]}
              strokeWidth={1.5}
              ifOverflow="visible"
            />
          ))}
          {ranged.flatMap((r) => [
            <ReferenceDot key={`lo-${r.x}`} x={r.x} y={r.lo!} r={2.5} fill={S[1]} stroke="none" ifOverflow="visible" />,
            <ReferenceDot key={`hi-${r.x}`} x={r.x} y={r.hi!} r={2.5} fill={S[1]} stroke="none" ifOverflow="visible" />,
          ])}
          {marks.map((b) => (
            <ReferenceDot key={`b-${b.year}`} x={String(b.year)} y={b.v!} r={4.5} fill={BAR_EDGE} stroke={RING} strokeWidth={2} ifOverflow="visible" />
          ))}
          {lastModelled && (
            <ReferenceDot x={lastModelled.x} y={lastModelled.tot} r={0} ifOverflow="visible" label={{ value: fmt(lastModelled.tot), position: 'top', fill: '#e9eef8', fontSize: 11, offset: 6 }} />
          )}
          {last.hi !== null && <ReferenceDot x={last.x} y={last.hi} r={0} ifOverflow="visible" label={{ value: fmt(last.tot), position: 'top', fill: '#aeb9cd', fontSize: 10.5, offset: 7 }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** A smaller figure in a ripple box: value over its label. */
function Fig({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="ripple-mid num">{value}</div>
      <div className="ripple-lab">{label}</div>
    </div>
  )
}

/**
 * A ripple box that flips on click (or Enter / Space): the front holds the headline figures, on
 * rows shared by all five boxes (pages.css subgrid) so they line up; the back holds the detail.
 */
function FlipBox({ className, style, front, back, label }: { className: string; style?: CSSProperties; front: ReactNode; back: ReactNode; label: string }) {
  const { t } = useLang()
  const [flipped, setFlipped] = useState(false)
  const flip = () => setFlipped((f) => !f)
  return (
    <div
      className={`ripple-box ${className}${flipped ? ' flipped' : ''}`}
      style={style}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={flipped ? t(`${label}: back, details. Click to turn back.`, `${label}：裏面（詳細）。クリックで表に戻る。`) : t(`${label}. Click for details.`, `${label}。クリックで詳細。`)}
      onClick={flip}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          flip()
        }
      }}
    >
      <div className="ripple-face front" aria-hidden={flipped}>
        {front}
      </div>
      <div className="ripple-face back" aria-hidden={!flipped}>
        {back}
      </div>
    </div>
  )
}

/**
 * Two bold curved arrows chasing each other round a circle: the flip mark. Clockwise on the
 * front (flip over), mirrored on the back (turn back).
 */
function TurnArrow({ back = false }: { back?: boolean }) {
  return (
    <svg className="ripple-flip" width="17" height="17" viewBox="-1 -1 26 26" aria-hidden="true" style={back ? { transform: 'scaleX(-1)' } : undefined}>
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 9a9 9 0 0 1 14.85-3.36L23 10" />
        <path d="M23 4v6h-6" />
        <path d="M20.5 15a9 9 0 0 1-14.85 3.36L1 14" />
        <path d="M1 20v-6h6" />
      </g>
    </svg>
  )
}

/** On the back, in its title row: click to turn the box back. */
const BackMark = () => <TurnArrow back />

/** The flip hint in a box's title row. */
const FlipMark = () => <TurnArrow />

/**
 * Revenue → direct + indirect ① + indirect ② = total. Five equal flip boxes: the front has what
 * the box is and its figures; the back has the rest (where the revenue goes, the sectors that
 * gain most in each round, the split of the total by round).
 */
export function Ripple({ card }: { card: RippleCard }) {
  const { t } = useLang()
  const names = useTierNames()
  const tot = card.total
  const maxSector = Math.max(...card.tiers.flatMap((tier) => tier.top.map((s) => s.va_bn)))
  const partOf = (v: number) => Math.round((v / tot.va_bn) * 100)
  const retainedPct = Math.round((card.retained_bn / card.spend_bn) * 100)
  return (
    <div className="ripple">
      <div className="ripple-flow">
        <FlipBox
          className="spend"
          label={t(`Tourism revenue ${card.year}`, `観光消費額 ${card.year}年`)}
          front={
            <>
              <div className="ripple-kicker">
                {t('Tourism revenue', '観光消費額')} {card.year}
                <FlipMark />
              </div>
              <div className="ripple-what">{t('What visitors spent in Fukui on stays, food, shopping, transport and attractions.', '来訪者が県内で宿泊・飲食・買物・交通・観光に消費した額。')}</div>
              <div>
                <div className="ripple-big">{bn(card.spend_bn)}</div>
                <div className="ripple-lab">{t('visitor spend', '観光消費')}</div>
              </div>
              <div className="ripple-figs">
                <Fig value={bn(card.retained_bn)} label={t(`in Fukui (${retainedPct}%)`, `県内（${retainedPct}%）`)} />
                <Fig value={bn(card.leak_bn)} label={t('made elsewhere', '県外')} />
              </div>
            </>
          }
          back={
            <>
              <div className="ripple-back-h">
                {t('Where the revenue goes', '観光消費の行き先')}
                <BackMark />
              </div>
              <ul className="ripple-back-list">
                <li>
                  <span className="rb-name">{t('Fukui businesses', '県内の生産')}</span>
                  <span className="rb-val num">{bn(card.retained_bn)}</span>
                  <span className="rb-bar">
                    <span style={{ width: `${retainedPct}%`, background: TIER.direct }}></span>
                  </span>
                  <span className="rb-sub num">{retainedPct}%</span>
                </li>
                <li>
                  <span className="rb-name">{t('Goods and services made elsewhere', '県外・海外製品')}</span>
                  <span className="rb-val num">{bn(card.leak_bn)}</span>
                  <span className="rb-bar">
                    <span style={{ width: `${100 - retainedPct}%`, background: GDP_REST }}></span>
                  </span>
                  <span className="rb-sub num">{100 - retainedPct}%</span>
                </li>
              </ul>
              <p className="ripple-back-note">{t('Only the part that reaches Fukui businesses starts the ripple.', '県内の生産に回る分だけが波及効果を生む。')}</p>
            </>
          }
        />
        <span className="ripple-op" aria-hidden="true">
          →
        </span>
        {card.tiers.map((tier, i) => (
          <div key={tier.id} className="ripple-seq">
            <FlipBox
              className="tier"
              style={{ ['--tier' as string]: TIER[tier.id] }}
              label={names[tier.id]}
              front={
                <>
                  <div className="ripple-kicker">
                    <i className="ripple-sw" style={{ background: TIER[tier.id] }}></i>
                    {names[tier.id]}
                    <FlipMark />
                  </div>
                  <div className="ripple-what">{tier.what}</div>
                  <div>
                    <div className="ripple-big">{bn(tier.va_bn)}</div>
                    <div className="ripple-lab">{t('GDP added', '付加価値')}</div>
                  </div>
                  <div className="ripple-figs">
                    <Fig value={jobs(tier.jobs)} label={t('jobs', '就業者')} />
                    <Fig value={bn(tier.output_bn)} label={t('output', '生産額')} />
                  </div>
                </>
              }
              back={
                <>
                  <div className="ripple-back-h">
                    {t('Sectors that gain most', '効果の大きい部門')}
                    <BackMark />
                  </div>
                  <ul className="ripple-back-list">
                    {tier.top.map((s) => (
                      <li key={s.sector}>
                        <span className="rb-name" title={s.sector}>
                          {s.sector}
                        </span>
                        <span className="rb-val num">{bn(s.va_bn)}</span>
                        <span className="rb-bar">
                          <span style={{ width: `${Math.max(2, (s.va_bn / maxSector) * 100)}%`, background: TIER[tier.id] }}></span>
                        </span>
                        <span className="rb-sub num">
                          {jobs(s.jobs)} {t('jobs', '人')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              }
            />
            <span className="ripple-op" aria-hidden="true">
              {i < card.tiers.length - 1 ? '+' : '='}
            </span>
          </div>
        ))}
        <FlipBox
          className="total"
          label={t(`Total effect ${card.year}`, `総合効果 ${card.year}年`)}
          front={
            <>
              <div className="ripple-kicker">
                {t('Total effect', '総合効果')} {card.year}
                <FlipMark />
              </div>
              <div className="ripple-what">{t('The direct effect and both indirect rounds added together, across the whole economy.', '直接効果と2段階の間接効果を合わせた、県経済全体への効果。')}</div>
              <div>
                <div className="ripple-big">{bn(tot.va_bn)}</div>
                <div className="ripple-lab">
                  {t('GDP added', '付加価値')} ({pct(tot.share_pct)} {t('of Fukui GDP', '県内総生産比')})
                </div>
              </div>
              <div className="ripple-figs">
                <Fig value={jobs(tot.jobs)} label={t(`jobs (${pct(tot.jobs_share_pct)})`, `就業者（${pct(tot.jobs_share_pct)}）`)} />
                <Fig value={bn(tot.output_bn)} label={t(`output (${tot.multiplier_spend.toFixed(2)}×)`, `生産額（${tot.multiplier_spend.toFixed(2)}倍）`)} />
              </div>
            </>
          }
          back={
            <>
              <div className="ripple-back-h">
                {t('GDP added, by round', '付加価値の内訳（段階別）')}
                <BackMark />
              </div>
              <div className="ripple-split" role="img" aria-label={card.tiers.map((tier) => `${names[tier.id]} ${partOf(tier.va_bn)}%`).join(', ')}>
                {card.tiers.map((tier) => (
                  <span key={tier.id} style={{ width: `${(tier.va_bn / tot.va_bn) * 100}%`, background: TIER[tier.id] }}></span>
                ))}
              </div>
              <ul className="ripple-back-list">
                {card.tiers.map((tier) => (
                  <li key={tier.id}>
                    <span className="rb-name">
                      <i className="ripple-sw" style={{ background: TIER[tier.id] }}></i> {names[tier.id]}
                    </span>
                    <span className="rb-val num">{bn(tier.va_bn)}</span>
                    <span className="rb-sub num">{partOf(tier.va_bn)}%</span>
                  </li>
                ))}
              </ul>
              <p className="ripple-back-note">
                {t(`Output ${bn(tot.output_bn)} = ${tot.multiplier_spend.toFixed(2)}× revenue · ${tot.multiplier_direct.toFixed(2)}× direct`, `生産額${bn(tot.output_bn)}＝消費の${tot.multiplier_spend.toFixed(2)}倍・直接効果の${tot.multiplier_direct.toFixed(2)}倍`)}
              </p>
            </>
          }
        />
      </div>
    </div>
  )
}

/** Slide the change in tourism revenue; GDP, jobs and share follow at the base year's effect per ¥1bn. */
export function WhatIf({ card }: { card: WhatIfCard }) {
  const { t } = useLang()
  const [p, setP] = useState(card.default_pct)
  const dSpend = (card.base_spend_bn * p) / 100
  const dVa = dSpend * card.per_bn.va_bn
  const dJobs = dSpend * card.per_bn.jobs
  const share = ((card.base_va_bn + dVa) / card.gdp_bn) * 100
  const baseShare = (card.base_va_bn / card.gdp_bn) * 100
  const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±')
  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}%`
  // Last year's real growth in revenue (prev_year → base_year), marked on the ruler.
  const actual = card.prev_spend_bn ? Math.round((card.base_spend_bn / card.prev_spend_bn - 1) * 100) : null
  const tiles = [
    { label: t('Tourism revenue', '観光消費額'), value: `${sign(dSpend)}${bn(Math.abs(dSpend))}`, detail: `${bn(card.base_spend_bn + dSpend)} ${t('a year', '/年')}` },
    { label: t('GDP added', '付加価値'), value: `${sign(dVa)}${bn(Math.abs(dVa))}`, detail: `${sign(dVa)}${Math.abs(share - baseShare).toFixed(2)} ${t('pt of GDP', 'pt（GDP比）')}` },
    { label: t('Jobs', '就業者'), value: `${sign(dJobs)}${jobs(Math.abs(dJobs))}`, detail: `${jobs(card.base_jobs + dJobs)} ${t('in total', '（合計）')}` },
    { label: t("Tourism's share of GDP", 'GDPに占める割合'), value: pct(share), detail: t(`from ${pct(baseShare)} in ${card.base_year}`, `基準 ${pct(baseShare)}（${card.base_year}年）`) },
  ]
  const name = t(`Change in tourism revenue vs ${card.base_year}`, `観光消費額の変化（基準：${card.base_year}年）`)
  return (
    <div className="whatif">
      <div className="lever-name">{name}</div>
      <ScenarioSlider
        min={card.min_pct}
        max={card.max_pct}
        step={card.step_pct}
        value={p}
        onChange={setP}
        colour={TIER.indirect1}
        format={(v) => `${signed(v)} ${t('growth', '成長')}`}
        tickFormat={(v) => (v === 0 ? '0%' : signed(v))}
        label={name}
        labelStep={10}
        reference={
          actual === null
            ? null
            : {
                value: actual,
                label: t(`${card.base_year} actual ${signed(actual)}`, `${card.base_year}年実績 ${signed(actual)}`),
                title: t(`Set the slider to ${card.base_year}'s actual growth`, `${card.base_year}年の実績の伸びに合わせる`),
              }
        }
      />
      {card.marks && card.marks.length > 0 && (
        <div className="whatif-marks">
          {card.marks.map((mk) => (
            <button key={mk.label} className="chip-btn" aria-pressed={p === mk.pct} onClick={() => setP(mk.pct)}>
              {mk.label}{' '}
              <span className="num">
                ({mk.pct > 0 ? '+' : ''}
                {mk.pct}%)
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="whatif-out">
        {tiles.map((x) => (
          <div key={x.label} className="whatif-tile">
            <div className="eco-kpi-label">{x.label}</div>
            <div className="whatif-value">{x.value}</div>
            <div className="eco-kpi-detail">{x.detail}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
