import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NodeRegistry } from '../../types/nodes'
import type { DayType, MarketStatus, ModeId, TransportFile, TransportMarketFile, TransportModesFile, TransportTrendsFile } from '../../types/transport'
import { useJsonResource } from '../../hooks/useJsonResource'
import { useLang } from '../../lib/i18n'
import { Loading, LoadError } from '../../components/StateMsg'
import { DAY_LABEL, EARLY_LAST_RETURN_MIN, clockLabel, clockMinutes, fmtMinutes } from '../../lib/transport'
import '../../styles/pages.css'
import '../../styles/transport.css'

/**
 * Mode colours: the dashboard's categorical tokens (--s1..--s4), validated in
 * this order against --surface (#121c2f). Other is a recessive neutral.
 */
const MODE_COLOUR: Record<ModeId, string> = { own_car: '#199e70', rental_car: '#c98500', bus: '#3987e5', train: '#d95926', other: '#4a5770' }
const MODE_ORDER: ModeId[] = ['own_car', 'rental_car', 'bus', 'train', 'other']
const MODE_NAME: Record<ModeId, [string, string]> = {
  own_car: ['Own car', '自家用車'],
  rental_car: ['Rental car', 'レンタカー'],
  bus: ['Bus', 'バス'],
  train: ['Train', '鉄道'],
  other: ['Other', 'その他'],
}
const GROUP_COLOUR: Record<string, string> = { taxi: '#c98500', bus: '#3987e5', rail: '#d95926', car: '#199e70' }
/** Trend lines: the first five categorical slots, in order (validated, adjacent pairs). */
const TREND_COLOURS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181']
const TERM_JA: Record<string, string> = {
  'Echizen Railway': 'えちぜん鉄道',
  'Keifuku Bus': '京福バス',
  'Hokuriku Shinkansen Fukui': '北陸新幹線 福井',
  'Car rental Fukui': 'レンタカー 福井',
  'Bike rental Fukui': 'レンタサイクル 福井',
}
const LATER = '#5a6782'
const EARLY = '#fab219'
const INK = '#e9eef8'
const GRID = '#34425e'
const AXIS = { fill: '#aeb9cd', fontSize: 12 }
const TIP = { background: '#17233a', border: '1px solid rgba(160,185,230,.2)', borderRadius: 8, fontSize: 12.5, color: '#e9eef8' }
const CURSOR = { fill: 'rgba(160,185,230,.06)' }
type Period = 'last_30_days' | 'year_2025'

const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`)
const compact = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : `${Math.round(v)}`)
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** A dashboard card: the title states the finding, the subtitle says what is measured, the footer names the source. */
function Card({ title, sub, source, tag, className = '', children }: { title: string; sub?: string; source?: ReactNode; tag?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`td-card ${className}`}>
      <header>
        {tag}
        <h3 className="td-card-title">{title}</h3>
        {sub && <p className="td-card-sub">{sub}</p>}
      </header>
      <div className="td-card-body">{children}</div>
      {source && <footer className="td-card-source">{source}</footer>}
    </section>
  )
}

function Slicer({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className="td-slicer">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}

function Badge({ status }: { status: MarketStatus }) {
  const { t } = useLang()
  if (status === 'official') return <span className="td-badge off">{t('Official', '公式')}</span>
  if (status === 'press') return <span className="td-badge press">{t('Press', '報道')}</span>
  return <span className="td-badge none">{t('Not published', '非公表')}</span>
}

/**
 * Transport: one page an executive can skim top to bottom. Header and filters,
 * a KPI strip with the "so what", then four rows of paired cards (how visitors
 * arrive; getting there without a car; the transport market; spending and
 * interest), then notes and sources folded away.
 */
export default function TransportView({ registry, onOpenMap }: { registry: NodeRegistry | null; onOpenMap: (id: string) => void }) {
  const { t, lang } = useLang()
  const res = useJsonResource<TransportFile>('transport.json')
  const modes = useJsonResource<TransportModesFile>('transport_modes.json').data
  const trends = useJsonResource<TransportTrendsFile>('transport_trends.json').data
  const market = useJsonResource<TransportMarketFile>('transport_market.json').data
  const [period, setPeriod] = useState<Period>('last_30_days')
  const [day, setDay] = useState<DayType>('saturday')
  const [site, setSite] = useState<string>('all')

  const data = res.data
  const names = useMemo(() => Object.fromEntries((registry?.nodes ?? []).map((n) => [n.id, [n.name, n.name_ja] as [string, string]])), [registry])
  const name = (id: string) => (names[id] ? t(names[id][0], names[id][1]) : id)

  if (res.isLoading) return <Loading what={t('Loading transport…', '交通データを読み込み中…')} />
  if (res.error || !data) return <LoadError file="transport.json" error={res.error} />

  const hub = t('Fukui Station', '福井駅')
  const sites = Object.keys(data.nodes).filter((id) => id !== data.hub)
  const modeSites = modes ? Object.keys(modes.nodes) : []
  const periodLabel = period === 'last_30_days' ? t('last 30 days', '直近30日') : t('latest official year', '最新の公式年度')
  const dayLabel = t(...DAY_LABEL[day])

  // --- visitors by mode for the chosen period and site
  const byMode = !modes
    ? null
    : site === 'all'
      ? modes.totals[period].by_mode
      : modes.nodes[site]
        ? period === 'last_30_days'
          ? modes.nodes[site].by_mode_30d
          : modes.nodes[site].by_mode_year
        : null
  const shares = site !== 'all' && modes?.nodes[site] ? modes.nodes[site].shares : null
  const total = byMode ? MODE_ORDER.reduce((a, m) => a + byMode[m].visitors, 0) : null
  const share = (ms: ModeId[]) => {
    if (shares) return ms.reduce((a, m) => a + (shares[m]?.share ?? 0), 0)
    if (!byMode || !total) return null
    return ms.reduce((a, m) => a + byMode[m].visitors, 0) / total
  }
  const carShare = share(['own_car', 'rental_car'])
  const ptShare = share(['bus', 'train'])

  // --- last bus back and service
  const lastBack = (id: string, d: DayType = day) => clockMinutes(data.nodes[id]?.days[d]?.to_hub?.leave)
  const linked = sites.filter((id) => lastBack(id) != null)
  const early = linked.filter((id) => (lastBack(id) ?? 9999) <= EARLY_LAST_RETURN_MIN)

  // --- market
  const revenue = market ? market.revenue.filter((r) => r.yen != null).sort((a, b) => (b.yen ?? 0) - (a.yen ?? 0)) : []
  const unpublished = market ? market.revenue.filter((r) => r.yen == null) : []
  const revenueTotal = revenue.reduce((a, r) => a + (r.yen ?? 0), 0)
  const ridership = market ? market.ridership.slice().sort((a, b) => b.passengers - a.passengers) : []
  const spend = modes?.spend_per_visitor
  const spendRows = spend
    ? (['rental_car', 'bus', 'train', 'own_car'] as ModeId[])
        .map((m) => ({ id: m, name: t(...MODE_NAME[m]), yen: spend.visitors_from_outside[m]?.yen ?? 0, local: spend.fukui_residents[m]?.yen ?? null }))
        .filter((r) => r.yen > 0)
    : []
  const trendRows = trends ? trends.weeks.map((w, i) => Object.fromEntries([['week', w.slice(5)], ...trends.terms.map((x) => [x.label, x.values[i]])])) : []
  const yen = (v: number) =>
    lang === 'ja' ? (v >= 1e8 ? `${(v / 1e8).toFixed(1)}億円` : `${Math.round(v / 1e4).toLocaleString()}万円`) : v >= 1e9 ? `¥${(v / 1e9).toFixed(2)}bn` : `¥${Math.round(v / 1e6)}M`
  const people = (v: number) => (lang === 'ja' ? `${Math.round(v / 1e4)}万人` : `${(v / 1e6).toFixed(2)}M`)

  // chart data
  const modeBars = byMode ? MODE_ORDER.map((m) => ({ id: m, name: t(...MODE_NAME[m]), value: byMode[m].visitors })) : []
  const stacked = modes
    ? modeSites.map((id) => ({ id, name: name(id), ...Object.fromEntries(MODE_ORDER.map((m) => [m, Math.round((modes.nodes[id].shares[m]?.share ?? 0) * 1000) / 10])) }))
    : []
  const backBars = sites
    .map((id) => ({ id, name: lastBack(id) == null ? `${name(id)} ${t('(no bus)', '（バスなし）')}` : name(id), value: lastBack(id), label: clockLabel(data.nodes[id].days[day]?.to_hub?.leave) }))
    .sort((a, b) => (a.value ?? 9999) - (b.value ?? 9999))

  // Everything split by mode comes from the tourism survey: say so where the number is.
  const tourists = (
    <span className="td-tag" title={t('From the Fukui Prefecture tourism survey: how surveyed tourists got around. Not residents or all travellers.', '福井県観光アンケートより：回答した観光客の移動手段。住民や全移動者ではない。')}>
      {t('Tourists only · survey', '観光客のみ・アンケート')}
    </span>
  )
  const siteBack = site !== 'all' ? lastBack(site) : null
  const kpis = [
    { value: total != null ? compact(total) : '—', label: t(`Visitors · ${periodLabel}`, `来訪者・${periodLabel}`) },
    { value: pct(carShare), label: t('Tourists by car', '車で来る観光客'), accent: true, tag: true },
    { value: pct(ptShare), label: t('Tourists by bus or train', 'バス・鉄道で来る観光客'), tag: true },
    site === 'all'
      ? { value: `${early.length} / ${linked.length}`, label: t(`Sites with last bus by 17:30 · ${dayLabel}`, `最終バス17:30までの地点・${dayLabel}`), warn: early.length > 0 }
      : {
          value: siteBack != null ? clockLabel(data.nodes[site].days[day]?.to_hub?.leave) : t('None', 'なし'),
          label: t(`Last bus back · ${dayLabel}`, `最終バス・${dayLabel}`),
          warn: siteBack != null && siteBack <= EARLY_LAST_RETURN_MIN,
        },
    { value: revenueTotal ? yen(revenueTotal) : '—', label: t('Transport revenue a year', '交通の年間収入') },
  ]

  return (
    <div className="page td">
      <header className="td-head">
        <div>
          <h1 className="td-title">{t('How Fukui People Travel', '福井の人々の移動')}</h1>
        </div>
        <div className="td-slicers">
          <Slicer
            label={t('Period', '期間')}
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={[
              ['last_30_days', t('Last 30 days', '直近30日')],
              ['year_2025', t('Latest official year', '最新の公式年度')],
            ]}
          />
          <Slicer label={t('Day', '曜日')} value={day} onChange={(v) => setDay(v as DayType)} options={(Object.keys(DAY_LABEL) as DayType[]).map((k) => [k, t(...DAY_LABEL[k])])} />
          <Slicer label={t('Site', '地点')} value={site} onChange={setSite} options={[['all', t('All sites', 'すべて')], ...sites.map((id) => [id, name(id)] as [string, string])]} />
        </div>
      </header>

      <div className="td-kpis">
        {kpis.map((k, i) => (
          <div key={i} className={`td-kpi${k.accent ? ' accent' : ''}${k.warn ? ' warn' : ''}`}>
            {'tag' in k && k.tag && tourists}
            <div className="td-kpi-value num">{k.value}</div>
            <div className="td-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Row 1: how visitors arrive */}
      <h2 className="td-row-h">{t('How tourists arrive', '観光客の来訪手段')}</h2>
      <div className="td-row">
        <Card
          className="td-5"
          tag={tourists}
          title={t('Tourists by mode of transport', '交通手段別の観光客')}
          sub={t(`Visitors split by tourism survey answers · ${periodLabel}`, `来訪者を観光アンケートの割合で按分・${periodLabel}`)}
          source={t('Estimate · survey × visitor counts', '推計・アンケート×来訪者数')}
        >
          <div className="td-chart" style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modeBars} margin={{ top: 22, right: 6, left: 6, bottom: 0 }}>
                <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
                <YAxis hide />
                <Tooltip cursor={CURSOR} contentStyle={TIP} formatter={(v) => [Number(v).toLocaleString(), t('visitors', '人')]} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={54} isAnimationActive={false}>
                  {modeBars.map((d) => (
                    <Cell key={d.id} fill={MODE_COLOUR[d.id]} />
                  ))}
                  <LabelList dataKey="value" position="top" formatter={(v) => compact(Number(v))} style={{ fill: INK, fontSize: 12, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card
          className="td-7"
          title={t('Tourist mode share by site', '地点別の観光客の交通手段')}
          tag={tourists}
          sub={t('Share of tourists by mode, %', '交通手段別の割合（%）')}
          source={t('Fukui Prefecture tourism survey', '福井県観光アンケート')}
        >
          <div className="td-chart" style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stacked} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }} barCategoryGap={7}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={150} />
                <Tooltip cursor={CURSOR} contentStyle={TIP} formatter={(v, k) => [`${v}%`, t(...MODE_NAME[k as ModeId])]} />
                {MODE_ORDER.map((m) => (
                  <Bar key={m} dataKey={m} stackId="s" fill={MODE_COLOUR[m]} isAnimationActive={false} stroke="#121c2f" strokeWidth={2}>
                    <LabelList dataKey={m} position="center" formatter={(v) => (Number(v) >= 10 ? `${Math.round(Number(v))}%` : '')} style={{ fill: '#0a1120', fontSize: 11.5, fontWeight: 700 }} />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="td-legend">
            {MODE_ORDER.map((m) => (
              <span key={m}>
                <i style={{ background: MODE_COLOUR[m] }}></i>
                {t(...MODE_NAME[m])}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 2: getting there without a car */}
      <h2 className="td-row-h">{t('Getting there without a car', '車なしで行く')}</h2>
      <div className="td-row">
        <Card
          className="td-5"
          title={t('Last bus back to Fukui Station', '福井駅への最終バス')}
          sub={t(`By site · ${dayLabel}`, `地点別・${dayLabel}`)}
          source={t('Bus timetables (GTFS-JP)', 'バス時刻表（GTFS-JP）')}
        >
          <div className="td-chart" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={backBars.map((b) => ({ ...b, value: b.value ?? 6 * 60 }))} layout="vertical" margin={{ top: 18, right: 52, left: 4, bottom: 0 }}>
                <XAxis type="number" domain={[6 * 60, 22 * 60]} ticks={[360, 600, 840, 1080, 1320]} tickFormatter={hhmm} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
                <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={150} />
                <ReferenceLine x={EARLY_LAST_RETURN_MIN} stroke={EARLY} strokeDasharray="4 4" label={{ value: '17:30', position: 'top', fill: EARLY, fontSize: 11 }} />
                <Tooltip cursor={CURSOR} contentStyle={TIP} formatter={(_, __, item) => [(item?.payload as { label?: string })?.label ?? '—', t('last bus', '最終便')]} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false} onClick={(d) => onOpenMap((d as unknown as { id: string }).id)} style={{ cursor: 'pointer' }}>
                  {backBars.map((b) => (
                    <Cell key={b.id} fill={b.value == null ? 'transparent' : b.value <= EARLY_LAST_RETURN_MIN ? EARLY : LATER} />
                  ))}
                  <LabelList dataKey="label" position="right" formatter={(v) => (v === '—' ? '' : String(v))} style={{ fill: INK, fontSize: 12.5, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card
          className="td-7"
          title={t('Bus service by site', '地点別のバス運行')}
          sub={t(`From ${hub} · ${dayLabel}`, `${hub}から・${dayLabel}`)}
          source={t('Bus timetables and fares (GTFS-JP) · adult, one way', 'バス時刻表・運賃（GTFS-JP）・大人片道')}
        >
          <div className="td-table-wrap">
            <table className="td-table">
              <thead>
                <tr>
                  <th>{t('Site', '地点')}</th>
                  <th>{t('Visitors', '来訪者')}</th>
                  <th>{t('Buses a day', 'バス本数/日')}</th>
                  <th>{t(`Quickest from ${hub}`, `${hub}から最短`)}</th>
                  <th>{t('Bus fare', 'バス運賃')}</th>
                  <th>{t('Last bus back', '最終便')}</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((id) => {
                  const d = data.nodes[id].days[day]
                  const m = modes?.nodes[id]
                  const v = m ? (period === 'last_30_days' ? m.visitors_30d : m.official_annual_2025) : null
                  const back = lastBack(id)
                  const fare = (d?.from_hub?.recommended ?? d?.from_hub?.fastest)?.fare_yen
                  return (
                    <tr key={id} className={site === 'all' || site === id ? '' : 'dim'} onClick={() => onOpenMap(id)} title={t('Show on the map', '地図で表示')}>
                      <th>{name(id)}</th>
                      <td className="num">{v != null ? compact(v) : <span className="td-dim">—</span>}</td>
                      <td className="num">{d?.departures ? d.departures : <span className="td-dim">0</span>}</td>
                      <td className="num">{d?.from_hub ? fmtMinutes(d.from_hub.fastest_min, lang) : <span className="td-dim">—</span>}</td>
                      <td className="num">{fare != null ? `¥${fare.toLocaleString()}` : <span className="td-dim">—</span>}</td>
                      <td className="num">
                        {back == null ? <span className="td-dim">{t('none', 'なし')}</span> : <span className={back <= EARLY_LAST_RETURN_MIN ? 'td-hi' : ''}>{clockLabel(d?.to_hub?.leave)}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Row 3: the transport market */}
      {market && (
        <>
          <h2 className="td-section-h">{t('Revenue and Fares', '収入と運賃')}</h2>
          <h3 className="td-row-h">{t('The transport market', '交通市場')}</h3>
          <div className="td-row">
            <Card
              className="td-6"
              title={t('Transport revenue by mode', '交通手段別の収入')}
              sub={t('Revenue · FY2024', '収入・2024年度')}
              source={t('Chubu District Transport Bureau · Fukui Shimbun', '中部運輸局・福井新聞')}
            >
              <div className="td-chart" style={{ height: 40 + revenue.length * 46 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenue.map((r) => ({ ...r, name: t(r.label, r.label_ja) }))} layout="vertical" margin={{ top: 2, right: 82, left: 4, bottom: 2 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={210} />
                    <Tooltip cursor={CURSOR} contentStyle={TIP} formatter={(v) => [yen(Number(v)), t('revenue', '収入')]} />
                    <Bar dataKey="yen" barSize={22} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      {revenue.map((r) => (
                        <Cell key={r.id} fill={GROUP_COLOUR[r.mode] ?? LATER} />
                      ))}
                      <LabelList dataKey="yen" position="right" formatter={(v) => yen(Number(v))} style={{ fill: INK, fontSize: 12.5, fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {unpublished.length > 0 && (
                <p className="td-note">
                  <Badge status="not_published" /> {unpublished.map((r) => t(r.label, r.label_ja)).join(t(', ', '、'))}
                </p>
              )}
            </Card>
            <Card
              className="td-6"
              title={t('Annual passengers by operator', '事業者別の年間輸送人員')}
              sub={t('Passengers a year', '年間輸送人員')}
              source={t('JR West · Fukui Shimbun · Chunichi · Chubu District Transport Bureau', 'JR西日本・福井新聞・中日新聞・中部運輸局')}
            >
              <div className="td-chart" style={{ height: 40 + ridership.length * 38 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ridership.map((r) => ({ ...r, name: t(r.label, r.label_ja) }))} layout="vertical" margin={{ top: 2, right: 64, left: 4, bottom: 2 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={230} />
                    <Tooltip cursor={CURSOR} contentStyle={TIP} formatter={(v) => [Number(v).toLocaleString(), t('passengers', '人')]} />
                    <Bar dataKey="passengers" barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      {ridership.map((r) => (
                        <Cell key={r.id} fill={GROUP_COLOUR[r.mode] ?? LATER} />
                      ))}
                      <LabelList dataKey="passengers" position="right" formatter={(v) => people(Number(v))} style={{ fill: INK, fontSize: 12.5, fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <div className="td-stats">
            {market.utilisation.map((u) => (
              <a key={u.id} className="td-stat" href={u.url} target="_blank" rel="noreferrer" title={t(u.detail, u.detail_ja)}>
                <span className="td-stat-value num">{u.value}</span>
                <span className="td-stat-label">{t(u.label, u.label_ja)}</span>
                <span className="td-stat-meta">
                  {u.period} <Badge status={u.status} />
                </span>
              </a>
            ))}
          </div>
        </>
      )}

      {/* Row 4: spending and interest */}
      {(spendRows.length > 0 || (trends && trends.terms.length > 0)) && (
        <>
          <h2 className="td-row-h">{t('Spending and interest', '支出と関心')}</h2>
          <div className="td-row">
            {spendRows.length > 0 && spend && (
              <Card
                className="td-5"
                tag={tourists}
                title={t('Transport spend per tourist', '観光客1人当たりの交通費')}
                sub={t('By mode · grey: tourists living in Fukui', '交通手段別・灰色：県内在住の観光客')}
                source={t('Estimate · prefecture tourism survey', '推計・県観光アンケート')}
              >
                <div className="td-chart" style={{ height: 40 + spendRows.length * 44 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={spendRows} layout="vertical" margin={{ top: 2, right: 150, left: 4, bottom: 2 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={96} />
                      <Tooltip cursor={CURSOR} contentStyle={TIP} formatter={(v) => [`¥${Number(v).toLocaleString()}`, t('per visitor', '1人当たり')]} />
                      <Bar dataKey="yen" barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                        {spendRows.map((r) => (
                          <Cell key={r.id} fill={MODE_COLOUR[r.id]} />
                        ))}
                        <LabelList
                          dataKey="yen"
                          position="right"
                          content={(p) => {
                            const { x = 0, y = 0, width = 0, height = 0, index = 0 } = p as { x?: number; y?: number; width?: number; height?: number; index?: number }
                            const r = spendRows[index]
                            return (
                              <text x={Number(x) + Number(width) + 8} y={Number(y) + Number(height) / 2 + 4} fill={INK} fontSize={12.5} fontWeight={600}>
                                ¥{r.yen.toLocaleString()}
                                <tspan fill="#7f8ba3" fontWeight={400}>
                                  {r.local != null ? `  ·  ¥${r.local.toLocaleString()}` : ''}
                                </tspan>
                              </text>
                            )
                          }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
            {trends && trends.terms.length > 0 && (
              <Card
                className="td-7"
                title={t('Search interest in transport', '交通の検索関心')}
                sub={t('Google Trends · 12 months', 'Googleトレンド・12か月')}
                source={t('Google Trends · relative index', 'Googleトレンド・相対指数')}
              >
                <div className="td-chart" style={{ height: 210 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendRows} margin={{ top: 6, right: 12, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(160,185,230,.08)" vertical={false} />
                      <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={8} />
                      <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[0, 100]} ticks={[0, 50, 100]} />
                      <Tooltip contentStyle={TIP} cursor={{ stroke: GRID }} />
                      {trends.terms.map((x, i) => (
                        <Line key={x.term} dataKey={x.label} name={t(x.label, TERM_JA[x.label] ?? x.term)} stroke={TREND_COLOURS[i % 5]} strokeWidth={2} dot={false} isAnimationActive={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="td-legend">
                  {trends.terms.map((x, i) => (
                    <span key={x.term}>
                      <i style={{ background: TREND_COLOURS[i % 5] }}></i>
                      {t(x.label, TERM_JA[x.label] ?? x.term)}
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      <details className="td-notes">
        <summary>{t('Notes and sources', '注記と出典')}</summary>
        <ol>
          <li>
            {t(
              'Visitors by mode: each site’s visitor estimate (its camera, booking or hotel signal scaled to the official count) split by how that site’s respondents to the Fukui Prefecture tourism survey got around in Fukui (last 12 months). Several answers count equally; walking only when it was the only answer. Answers are voluntary, so the split is an estimate. Awara Onsen counts hotel guests; Fukui Station has no visitor estimate (shares only). “Latest official year” is calendar 2025, except Katsuyama (FY2025).',
              '交通手段別の来訪者：各地点の来訪者推計（カメラ・予約・宿泊の指標を公式値に換算）を、その地点での福井県観光アンケートの「福井県内での交通手段」の回答割合（直近12か月）で分けた推計。複数回答は均等配分、徒歩は単独回答のみ。回答は任意。あわら温泉は宿泊客、福井駅は来訪者推計なし（割合のみ）。「最新の公式年度」は2025年（勝山は2025年度）。',
            )}{' '}
            {modes && (
              <a href={modes.survey.url} target="_blank" rel="noreferrer">
                {t('Survey data', 'アンケートデータ')}
              </a>
            )}
          </li>
          <li>
            {t(
              `Bus timetables and fares: ${data.sources.map((s) => s.name).join(', ')} (Fukui Prefecture open data, refreshed weekly). Echizen Railway and Fukui Railway publish no open timetable, so trips are by bus only and look longer than by train at Katsuyama, Awara Onsen and Tojinbo. Kanazawa times add an estimated Shinkansen leg. Bus data: 京福バス株式会社 and city buses, Fukui Prefecture open data (CC BY 4.0).`,
              `バス時刻表・運賃：${data.sources.map((s) => s.name_ja).join('、')}（福井県オープンデータ、毎週更新）。えちぜん鉄道・福井鉄道はオープンな時刻表を公開していないため、移動はバスのみで、勝山・あわら温泉・東尋坊では鉄道より長めに出る。バスデータ：京福バス株式会社ほか、福井県オープンデータ（CC BY 4.0）。`,
            )}
          </li>
          {market && (
            <li>
              {t('Published figures (each with period and status; nothing estimated):', '公表値（期間・区分付き、推計なし）：')}
              <ul className="td-sources">
                {[...market.revenue.filter((r) => r.url), ...market.ridership].map((r, i) => (
                  <li key={`${r.id}-${i}`}>
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {t(r.label, r.label_ja)}
                    </a>{' '}
                    <span className="td-dim">· {r.period}</span> <Badge status={r.status} />
                  </li>
                ))}
                {market.fares.map((f, i) => (
                  <li key={`fare-${i}`}>
                    <a href={f.url} target="_blank" rel="noreferrer">
                      {f.group === 'taxi' ? t(`${f.operator}, ${f.to}`, `${f.operator_ja}、${f.to_ja}`) : t(`${f.operator}: ${f.from} to ${f.to}`, `${f.operator_ja}：${f.from_ja}→${f.to_ja}`)}
                    </a>{' '}
                    <span className="num">¥{f.yen.toLocaleString()}</span> <Badge status={f.status} />
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ol>
      </details>
    </div>
  )
}
