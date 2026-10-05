import { useState } from 'react'
import { Bar, CartesianGrid, Cell, ComposedChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { GdpTrendCard, RippleCard, RippleTierId, TourismTrendCard, TourismTrendPoint, WhatIfCard } from '../../types/strategy'
import { useLang } from '../../lib/i18n'
import { AXIS, S } from './chartTheme'

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
      <ResponsiveContainer width="100%" height={236}>
        <ComposedChart data={rows} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid stroke={GRID} vertical={false} />
          {firstProj && <ReferenceArea x1={firstProj} x2={last.x} fill={PROJ_FILL} fillOpacity={0.06} ifOverflow="visible" />}
          <XAxis dataKey="x" tick={AXIS} tickLine={false} axisLine={{ stroke: AXIS_LINE }} interval={1} tickFormatter={(v: string) => `FY${v.slice(2)}`} />
          <YAxis tick={AXIS} width={46} tickLine={false} axisLine={false} domain={[0, top]} ticks={ticks} tickFormatter={(v: number) => (v === 0 ? '0' : `¥${(v / 1e3).toFixed(0)}tn`)} />
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

type Measure = 'share' | 'va' | 'jobs'

function byRound(p: TourismTrendPoint, m: Measure): [number, number, number, number] {
  if (m === 'share') return [p.share_direct, p.share_indirect1, p.share_indirect2, p.share_total]
  if (m === 'va') return [p.va_direct, p.va_indirect1, p.va_indirect2, p.va_total]
  return [p.jobs_direct, p.jobs_indirect1, p.jobs_indirect2, p.jobs_total]
}

/** Tourism's share of GDP, GDP added or jobs each year, stacked by round, with the low–high range on projected years. */
export function TourismTrend({ card }: { card: TourismTrendCard }) {
  const { t } = useLang()
  const names = useTierNames()
  const [m, setM] = useState<Measure>('share')
  const fmt = (v: number) => (m === 'share' ? pct(v, 2) : m === 'va' ? bn(v) : jobs(v))
  const tick = (v: number) => (m === 'share' ? `${v}%` : m === 'va' ? `¥${v}bn` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v))
  const rows = card.points.map((p) => {
    const [d, i1, i2, tot] = byRound(p, m)
    const range = p.range ? p.range[m] : null
    return { x: String(p.year), p, d, i1, i2, tot, lo: range ? range[0] : null, hi: range ? range[1] : null, forecast: p.kind === 'forecast' }
  })
  const firstProj = rows.find((r) => r.forecast)?.x
  const lastModelled = [...rows].reverse().find((r) => !r.forecast)
  const last = rows[rows.length - 1]
  const marks = card.benchmarks.map((b) => ({ ...b, v: b[m] })).filter((b) => b.v !== undefined)
  const peak = Math.max(...rows.map((r) => Math.max(r.tot, r.hi ?? 0)), ...marks.map((b) => b.v ?? 0))
  const step = m === 'share' ? 1 : m === 'va' ? 50 : 1e4
  const top = Math.ceil((peak * 1.08) / step) * step
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const faded = (f: boolean) => (f ? 0.5 : 1)
  const ranged = rows.filter((r) => r.lo !== null && r.hi !== null)

  return (
    <div>
      <div className="eco-controls">
        <div className="seg" role="group" aria-label={t('Measure', '指標')}>
          <button aria-pressed={m === 'share'} onClick={() => setM('share')}>
            {t('Share of GDP', 'GDP比')}
          </button>
          <button aria-pressed={m === 'va'} onClick={() => setM('va')}>
            {t('GDP added', '付加価値額')}
          </button>
          <button aria-pressed={m === 'jobs'} onClick={() => setM('jobs')}>
            {t('Jobs', '就業者')}
          </button>
        </div>
      </div>
      <div className="chart-key">
        {TIERS.map((id) => (
          <span key={id}>
            <i className="k-band" style={{ background: TIER[id] }}></i>
            {names[id]}
          </span>
        ))}
        {ranged.length > 0 && (
          <span>
            <i className="k-range"></i>
            {t('Low to high spend', '観光消費の低位〜高位')}
          </span>
        )}
        {marks.length > 0 && (
          <span>
            <i className="k-ring"></i>
            {t("Prefecture's own estimate", '県の推計')}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={rows} margin={{ top: 20, right: 14, left: 0, bottom: 0 }} barCategoryGap="22%">
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
          <XAxis dataKey="x" tick={AXIS} tickLine={false} axisLine={{ stroke: AXIS_LINE }} interval={1} tickFormatter={(v: string) => `'${v.slice(2)}`} />
          <YAxis tick={AXIS} width={46} tickLine={false} axisLine={false} domain={[0, top]} ticks={ticks} tickFormatter={tick} />
          <Tooltip
            cursor={{ fill: 'rgba(139,157,255,.08)' }}
            content={({ active, payload }) => {
              const r = active ? (payload?.[0]?.payload as (typeof rows)[number] | undefined) : undefined
              if (!r) return null
              const tipRows: TipRow[] = TIERS.map((id, i) => ({ key: TIER[id], label: names[id], value: fmt([r.d, r.i1, r.i2][i]) }))
              tipRows.push({ label: t('total', '合計'), value: fmt(r.tot), strong: true })
              if (r.lo !== null && r.hi !== null) tipRows.push({ key: S[1], label: t('low to high spend', '低位〜高位'), value: `${fmt(r.lo)} – ${fmt(r.hi)}` })
              const b = marks.find((x) => String(x.year) === r.x)
              if (b?.v !== undefined) tipRows.push({ key: RING, label: b.label, value: fmt(b.v) })
              const est = r.p.gdp_kind === 'actual' ? '' : t(' (estimate)', '（推計）')
              return (
                <EcoTip
                  title={`${r.x}${r.forecast ? t(' · base projection', '・基準予測') : ''}`}
                  rows={tipRows}
                  foot={`${t('Tourism spend', '観光消費額')} ${bn(r.p.spend_bn)} · GDP ${tn(r.p.gdp_bn)}${est}`}
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

/** Spend → direct + indirect ① + indirect ② = total, with the sectors that gain most in each round. */
export function Ripple({ card }: { card: RippleCard }) {
  const { t } = useLang()
  const names = useTierNames()
  const tot = card.total
  const maxSector = Math.max(...card.tiers.flatMap((tier) => tier.top.map((s) => s.va_bn)))
  const partOf = (v: number) => Math.round((v / tot.va_bn) * 100)
  return (
    <div className="ripple">
      <div className="ripple-flow">
        <div className="ripple-box spend">
          <div className="ripple-kicker">
            {t('Tourism spend', '観光消費額')} {card.year}
          </div>
          <div className="ripple-big">{bn(card.spend_bn)}</div>
          <div className="ripple-sub">
            {bn(card.retained_bn)} {t('reaches Fukui businesses', 'が県内の生産に')} ({Math.round((card.retained_bn / card.spend_bn) * 100)}%)
          </div>
          <div className="ripple-sub muted">
            {bn(card.leak_bn)} {t('buys goods and services made elsewhere', 'は県外・海外製品へ')}
          </div>
        </div>
        <span className="ripple-op" aria-hidden="true">
          →
        </span>
        {card.tiers.map((tier, i) => (
          <div key={tier.id} className="ripple-seq">
            <div className="ripple-box tier" style={{ ['--tier' as string]: TIER[tier.id] }}>
              <div className="ripple-kicker">
                <i className="ripple-sw" style={{ background: TIER[tier.id] }}></i>
                {names[tier.id]}
              </div>
              <div className="ripple-what">{tier.what}</div>
              <div className="ripple-figs">
                <div>
                  <div className="ripple-big">{bn(tier.va_bn)}</div>
                  <div className="ripple-lab">{t('GDP added', '付加価値')}</div>
                </div>
                <div>
                  <div className="ripple-mid num">{jobs(tier.jobs)}</div>
                  <div className="ripple-lab">{t('jobs', '就業者')}</div>
                </div>
                <div>
                  <div className="ripple-mid num">{bn(tier.output_bn)}</div>
                  <div className="ripple-lab">{t('output', '生産額')}</div>
                </div>
              </div>
              <ul className="ripple-top" aria-label={t('Sectors that gain most', '効果の大きい部門')}>
                {tier.top.map((s) => (
                  <li key={s.sector} title={`${s.sector}: ${bn(s.va_bn)} ${t('GDP', '付加価値')}, ${jobs(s.jobs)} ${t('jobs', '人')}`}>
                    <span className="rt-name">{s.sector}</span>
                    <span className="rt-bar">
                      <span style={{ width: `${Math.max(2, (s.va_bn / maxSector) * 100)}%`, background: TIER[tier.id] }}></span>
                    </span>
                    <span className="rt-val num">{bn(s.va_bn)}</span>
                    <span className="rt-jobs num">
                      {jobs(s.jobs)} {t('jobs', '人')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <span className="ripple-op" aria-hidden="true">
              {i < card.tiers.length - 1 ? '+' : '='}
            </span>
          </div>
        ))}
        <div className="ripple-box total">
          <div className="ripple-kicker">
            {t('Total effect', '総合効果')} {card.year}
          </div>
          <div className="ripple-big">{bn(tot.va_bn)}</div>
          <div className="ripple-lab">
            {t('GDP added', '付加価値')} = {pct(tot.share_pct)} {t(`of Fukui GDP (FY${card.year} est.)`, `（FY${card.year}県内総生産比・推計）`)}
          </div>
          <div className="ripple-mid num">{jobs(tot.jobs)}</div>
          <div className="ripple-lab">
            {t('jobs', '就業者')} = {pct(tot.jobs_share_pct)} {t('of workers (FY2023 count)', '（FY2023県内就業者比）')}
          </div>
          <div className="ripple-mid num">{bn(tot.output_bn)}</div>
          <div className="ripple-lab">
            {t('output', '生産額')} = {tot.multiplier_spend.toFixed(2)}× {t('spend', '消費額')} · {tot.multiplier_direct.toFixed(2)}× {t('direct', '直接効果')}
          </div>
          <div className="ripple-split" role="img" aria-label={card.tiers.map((tier) => `${names[tier.id]} ${partOf(tier.va_bn)}%`).join(', ')}>
            {card.tiers.map((tier) => (
              <span key={tier.id} style={{ width: `${(tier.va_bn / tot.va_bn) * 100}%`, background: TIER[tier.id] }} title={`${names[tier.id]}: ${partOf(tier.va_bn)}%`}></span>
            ))}
          </div>
          <div className="ripple-split-key muted">
            {card.tiers.map((tier) => `${partOf(tier.va_bn)}%`).join(' · ')} {t('of the GDP added', '（付加価値の内訳）')}
          </div>
        </div>
      </div>
      <div className="ripple-legend muted">
        {t('Under each round: the sectors that gain most, with the GDP they add and the jobs it supports.', '各段階の下：効果の大きい部門（付加価値と就業者数）。')}
      </div>
    </div>
  )
}

/** Slide the change in tourism spend; GDP, jobs and share follow at the base year's effect per ¥1bn. */
/** What-if slider: thumb diameter (pages.css), and the ruler's tick and label spacing in percent. */
const THUMB = 18
const RULER_STEP = 5
const RULER_LABEL = 10

export function WhatIf({ card }: { card: WhatIfCard }) {
  const { t } = useLang()
  const [p, setP] = useState(card.default_pct)
  // The readout over the thumb shows while the pointer is on the thumb, or while dragging or keyboard-focused.
  const [near, setNear] = useState(false)
  const [active, setActive] = useState(false)
  const dSpend = (card.base_spend_bn * p) / 100
  const dVa = dSpend * card.per_bn.va_bn
  const dJobs = dSpend * card.per_bn.jobs
  const share = ((card.base_va_bn + dVa) / card.gdp_bn) * 100
  const baseShare = (card.base_va_bn / card.gdp_bn) * 100
  const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±')
  const at = (v: number) => ((v - card.min_pct) / (card.max_pct - card.min_pct)) * 100
  const fill = at(p)
  // The thumb's centre runs from THUMB/2 to (width − THUMB/2), so the readout and the ruler sit on that span.
  const onThumb = `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${fill / 100})`
  const ticks: number[] = []
  for (let v = Math.ceil(card.min_pct / RULER_STEP) * RULER_STEP; v <= card.max_pct; v += RULER_STEP) ticks.push(v)
  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}%`
  const tiles = [
    { label: t('Tourism spend', '観光消費額'), value: `${sign(dSpend)}${bn(Math.abs(dSpend))}`, detail: `${bn(card.base_spend_bn + dSpend)} ${t('a year', '/年')}` },
    { label: t('GDP added', '付加価値'), value: `${sign(dVa)}${bn(Math.abs(dVa))}`, detail: `${sign(dVa)}${Math.abs(share - baseShare).toFixed(2)} ${t('pt of GDP', 'pt（GDP比）')}` },
    { label: t('Jobs', '就業者'), value: `${sign(dJobs)}${jobs(Math.abs(dJobs))}`, detail: `${jobs(card.base_jobs + dJobs)} ${t('in total', '（合計）')}` },
    { label: t("Tourism's share of GDP", 'GDPに占める割合'), value: pct(share), detail: t(`from ${pct(baseShare)} in ${card.base_year}`, `基準 ${pct(baseShare)}（${card.base_year}年）`) },
  ]
  return (
    <div className="whatif">
      <label className="lever">
        <span className="lever-head">
          <span className="lever-name">{t(`Change in tourism spend vs ${card.base_year}`, `観光消費額の変化（基準：${card.base_year}年）`)}</span>
          <span className="num lever-val">
            {p > 0 ? '+' : ''}
            {p}%
          </span>
        </span>
        <span
          className="whatif-slider"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const x = THUMB / 2 + ((r.width - THUMB) * fill) / 100
            setNear(Math.abs(e.clientX - r.left - x) <= THUMB)
          }}
          onPointerLeave={() => setNear(false)}
        >
          <span className={`whatif-readout num ${near || active ? 'on' : ''}`} style={{ left: onThumb }} aria-hidden="true">
            {signed(p)} {t('growth', '成長')}
          </span>
          <input
            type="range"
            min={card.min_pct}
            max={card.max_pct}
            step={card.step_pct}
            value={p}
            style={{ ['--pct' as string]: `${fill}%`, ['--c' as string]: TIER.indirect1 }}
            onChange={(e) => setP(Number(e.target.value))}
            onPointerDown={() => setActive(true)}
            onPointerUp={() => setActive(false)}
            onFocus={(e) => e.currentTarget.matches(':focus-visible') && setActive(true)}
            onBlur={() => setActive(false)}
            aria-valuetext={`${signed(p)} ${t('growth', '成長')}`}
          />
          <span className="whatif-ruler" aria-hidden="true">
            {ticks.map((v) => (
              <span key={v} className={`whatif-tick ${v % RULER_LABEL === 0 ? 'major' : ''} ${v === 0 ? 'zero' : ''}`} style={{ left: `${at(v)}%` }}>
                {v % RULER_LABEL === 0 && <span className="whatif-tick-label num">{v === 0 ? '0%' : signed(v)}</span>}
              </span>
            ))}
            <span className="whatif-here" style={{ left: `${fill}%` }} />
          </span>
        </span>
      </label>
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
      <p className="whatif-rule muted small">
        {t(
          `Each extra ¥1bn of spend adds ${bn(card.per_bn.va_bn, 2)} of GDP, ${Math.round(card.per_bn.jobs)} jobs and ${bn(card.per_bn.output_bn, 2)} of output (same mix as ${card.base_year}).`,
          `観光消費10億円の増加ごとに、${bn(card.per_bn.va_bn, 2)}の付加価値、${Math.round(card.per_bn.jobs)}人の就業、${bn(card.per_bn.output_bn, 2)}の生産（消費構成は${card.base_year}年と同じ）。`,
        )}
      </p>
    </div>
  )
}
