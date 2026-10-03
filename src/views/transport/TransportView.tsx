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
function Card({ title, sub, source, className = '', children }: { title: string; sub?: string; source?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`td-card ${className}`}>
      <header>
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
  const onDay = t(...({ weekday: ['on weekdays', '平日は'], saturday: ['on Saturdays', '土曜は'], sunday: ['on Sundays and holidays', '日祝は'] } as Record<DayType, [string, string]>)[day])
  const OnDay = onDay.charAt(0).toUpperCase() + onDay.slice(1)

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
  const siteShare = (id: string, ms: ModeId[]) => ms.reduce((a, m) => a + (modes?.nodes[id]?.shares[m]?.share ?? 0), 0)
  const transitSite = modeSites.slice().sort((a, b) => siteShare(b, ['bus', 'train']) - siteShare(a, ['bus', 'train']))[0]

  // --- last bus back and service
  const lastBack = (id: string, d: DayType = day) => clockMinutes(data.nodes[id]?.days[d]?.to_hub?.leave)
  const linked = sites.filter((id) => lastBack(id) != null)
  const early = linked.filter((id) => (lastBack(id) ?? 9999) <= EARLY_LAST_RETURN_MIN)
  const noBus = sites.filter((id) => !(['weekday', 'saturday', 'sunday'] as DayType[]).some((d) => data.nodes[id].days[d]?.departures))
  const thinnest = sites
    .filter((id) => !noBus.includes(id))
    .map((id) => ({ id, deps: data.nodes[id].days.weekday?.departures ?? 0 }))
    .sort((a, b) => a.deps - b.deps)[0]

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
  const ownCarSpend = spendRows.find((r) => r.id === 'own_car')?.yen
  const spendRatio = spendRows.length && ownCarSpend ? Math.round((spendRows[0].yen / ownCarSpend) * 10) / 10 : null
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

  const siteBack = site !== 'all' ? lastBack(site) : null
  const kpis = [
    { value: total != null ? compact(total) : '—', label: t(`Visitors, ${periodLabel}`, `来訪者（${periodLabel}）`) },
    { value: pct(carShare), label: t('Arrive by car', '車で来訪'), accent: true },
    { value: pct(ptShare), label: t('Arrive by bus or train', 'バス・鉄道で来訪') },
    site === 'all'
      ? { value: `${early.length} / ${linked.length}`, label: t(`Sites whose last bus back leaves by 17:30 (${dayLabel})`, `最終バスが17:30までの地点（${dayLabel}）`), warn: early.length > 0 }
      : {
          value: siteBack != null ? clockLabel(data.nodes[site].days[day]?.to_hub?.leave) : t('None', 'なし'),
          label: t(`Last bus back to ${hub} (${dayLabel})`, `${hub}への最終バス（${dayLabel}）`),
          warn: siteBack != null && siteBack <= EARLY_LAST_RETURN_MIN,
        },
    { value: revenueTotal ? yen(revenueTotal) : '—', label: t('Published transport revenue a year (taxi, bus, Hapi-line)', '公表されている交通の年間収入（タクシー・バス・ハピライン）') },
  ]

  return (
    <div className="page td">
      <header className="td-head">
        <div>
          <div className="eyebrow">{t('Transport', '交通')}</div>
          <h1 className="td-title">{t('How visitors reach Fukui’s priority sites', '福井の重点地点への来訪者の交通')}</h1>
          <p className="td-asof">
            {modes?.totals.last_30_days.period && t(`Visitor estimates to ${modes.totals.last_30_days.period[1]}`, `来訪者推計は${modes.totals.last_30_days.period[1]}まで`)}
            {t(` · bus timetables for the week of ${data.reference_days.weekday}`, `・${data.reference_days.weekday}の週のバス時刻表`)}
            {market && t(' · operator figures FY2024–25', '・事業者データは2024〜25年度')}
          </p>
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
            <div className="td-kpi-value num">{k.value}</div>
            <div className="td-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <p className="td-sowhat">
        <strong>{t('So what', '示唆')}</strong>
        {t(
          `Most visitors drive, and those who don't must leave early: ${onDay} the last bus back to ${hub} leaves by 17:30 at ${early.length} of ${linked.length} sites. Later weekend buses on the Tojinbo, Eiheiji and Katsuyama routes are the clearest lever to test for longer stays.`,
          `来訪者の多くは車で、車なしの来訪者は早く帰る必要がある：${dayLabel}は${linked.length}地点中${early.length}地点で${hub}への最終バスが17:30まで。東尋坊・永平寺・勝山方面の週末最終バスの延長が、滞在延長に向けて最初に検証すべき施策。`,
        )}
      </p>

      {/* Row 1: how visitors arrive */}
      <h2 className="td-row-h">{t('How visitors arrive', '来訪者の交通手段')}</h2>
      <div className="td-row">
        <Card
          className="td-5"
          title={t(`${pct(carShare)} of visitors arrive by car; ${pct(ptShare)} by bus or train`, `来訪者の${pct(carShare)}が車、${pct(ptShare)}がバス・鉄道`)}
          sub={t(`Estimated visitors by mode, ${site === 'all' ? 'five sites' : name(site)}, ${periodLabel}`, `交通手段別の推計来訪者数（${site === 'all' ? '5地点' : name(site)}、${periodLabel}）`)}
          source={t('Estimate: site visitor estimates × prefecture tourism survey answers. Note 1.', '推計：各地点の来訪者推計×県観光アンケート。注1。')}
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
          title={
            transitSite
              ? t(
                  `Car leads at every site; ${name(transitSite)} has the most bus and train use (${pct(siteShare(transitSite, ['bus', 'train']))})`,
                  `どの地点も車が最多。バス・鉄道が最も多いのは${name(transitSite)}（${pct(siteShare(transitSite, ['bus', 'train']))}）`,
                )
              : t('How visitors travel, by site', '地点別の交通手段')
          }
          sub={t('Share of visitors by mode, %, last 12 months of survey answers', '交通手段の割合（%、直近12か月のアンケート回答）')}
          source={t('Fukui Prefecture tourism survey, 福井県内での交通手段. Note 1.', '福井県観光アンケート（福井県内での交通手段）。注1。')}
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
          title={
            early.length === linked.length && linked.length
              ? t(`${OnDay}, the last bus back leaves by 17:30 at every site it serves`, `${dayLabel}はバスが通るすべての地点で最終便が17:30まで`)
              : t(`Last bus back leaves by 17:30 at ${early.length} of ${linked.length} sites`, `${linked.length}地点中${early.length}地点で最終便が17:30まで`)
          }
          sub={t(`Last bus from each site that still reaches ${hub}, ${dayLabel}`, `${hub}へ戻れる最終バス（${dayLabel}）`)}
          source={t('Operators’ bus timetables (GTFS-JP, Fukui Prefecture open data). Bus only. Note 2.', '事業者のバス時刻表（GTFS-JP、県オープンデータ）。バスのみ。注2。')}
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
          title={
            noBus.length && thinnest
              ? t(`${name(noBus[0])} has no public transport; ${name(thinnest.id)} has ${thinnest.deps} buses a weekday`, `${name(noBus[0])}は公共交通なし、${name(thinnest.id)}は平日${thinnest.deps}本`)
              : t('Service level by site', '地点別の運行水準')
          }
          sub={t(`Bus service from ${hub}, ${dayLabel}; visitors ${periodLabel}`, `${hub}からのバス（${dayLabel}）、来訪者は${periodLabel}`)}
          source={t('Bus timetables and fare tables (GTFS-JP); Eiheiji Liner ¥1,000 from 2026-10-01 (Keifuku Bus). Fares: adult, one way, quickest trip. Note 2.', 'バス時刻表・運賃表（GTFS-JP）。永平寺ライナーは2026年10月1日から1,000円。運賃は大人・片道・最短経路。注2。')}
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
                  const fare = d?.from_hub?.fastest.fare_yen
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
          <h2 className="td-row-h">{t('The transport market', '交通市場')}</h2>
          <div className="td-row">
            <Card
              className="td-6"
              title={revenue.length >= 2 ? t('Taxis and route buses each take in over ¥3bn a year', 'タクシーと路線バスがそれぞれ年30億円超') : t('Published transport revenue', '公表されている交通の収入')}
              sub={t('Annual revenue in Fukui Prefecture, FY2024, yen', '福井県内の年間収入（2024年度、円）')}
              source={t('Chubu District Transport Bureau (taxis, buses; official); Fukui Shimbun (Hapi-line; press). Note 3.', '中部運輸局（タクシー・バス、公式）、福井新聞（ハピライン、報道）。注3。')}
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
              title={t('Rail carries the most passengers: the Shinkansen and Hapi-line 7–8M each a year', '最多は鉄道：北陸新幹線とハピラインがそれぞれ年700〜800万人')}
              sub={t('Passengers a year, latest published period', '年間輸送人員（最新の公表期間）')}
              source={t('JR West (via Wakasa Bay), Fukui Shimbun, Chunichi (press); Chubu District Transport Bureau (official). Periods differ. Note 3.', 'JR西日本（若狭湾経由）、福井新聞、中日新聞（報道）、中部運輸局（公式）。期間は異なる。注3。')}
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
                title={spendRatio ? t(`Visitors who rent a car spend ${spendRatio}× more on transport than drivers`, `レンタカー利用者の交通費は自家用車の${spendRatio}倍`) : t('Transport spend per visitor', '来訪者1人当たりの交通費')}
                sub={t('Average transport spend per visitor for the whole trip, visitors from outside Fukui', '県外来訪者1人当たりの旅行全体の交通費')}
                source={t(
                  `Estimate: survey 交通費 bands (midpoints), ${spend.responses.toLocaleString()} answers; includes getting to Fukui. Grey: Fukui residents.`,
                  `推計：アンケートの交通費（区分の中央値）、回答${spend.responses.toLocaleString()}件。福井までを含む。灰色は県内在住者。`,
                )}
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
                title={t('Echizen Railway draws the most transport searches; bike rental almost none', '交通の検索はえちぜん鉄道が最多、レンタサイクルはほぼゼロ')}
                sub={t('Google Trends, Japan, weekly, last 12 months; 100 = busiest week of any term', 'Googleトレンド（日本・週次・直近12か月）、いずれかの語の最多週＝100')}
                source={t(`Relative search interest, not traveller numbers. Collected ${trends.generated_at.slice(0, 10)}.`, `相対的な検索関心で利用者数ではない。${trends.generated_at.slice(0, 10)}取得。`)}
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
              `Bus timetables and fares: ${data.sources.map((s) => s.name).join(', ')} (Fukui Prefecture open data, refreshed weekly). Echizen Railway and Fukui Railway publish no open timetable, so trips are by bus only and look longer than by train at Katsuyama, Awara Onsen and Tojinbo. Kanazawa times add an estimated Shinkansen leg. The Keifuku Bus licence is to be confirmed with the company before publication.`,
              `バス時刻表・運賃：${data.sources.map((s) => s.name_ja).join('、')}（福井県オープンデータ、毎週更新）。えちぜん鉄道・福井鉄道はオープンな時刻表を公開していないため、移動はバスのみで、勝山・あわら温泉・東尋坊では鉄道より長めに出る。京福バスの利用許諾は公開前に確認予定。`,
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
