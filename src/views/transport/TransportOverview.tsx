import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, Treemap, XAxis, YAxis } from 'recharts'
import type { DayType, ModeId, TransportFile, TransportModesFile } from '../../types/transport'
import { useLang } from '../../lib/i18n'
import { DAY_LABEL, EARLY_LAST_RETURN_MIN, clockLabel, clockMinutes } from '../../lib/transport'

/**
 * Mode colours on the light report canvas, validated with the dataviz
 * validator against #ffffff (all checks pass, adjacent order as listed).
 * Other is a recessive neutral.
 */
const MODE_COLOURS: Record<ModeId, string> = {
  own_car: '#7048c8',
  rental_car: '#e0782f',
  bus: '#2a78d6',
  train: '#1a9a6c',
  other: '#b9b3c9',
}
const MODE_ORDER: ModeId[] = ['own_car', 'rental_car', 'bus', 'train', 'other']
const MODE_NAME: Record<ModeId, [string, string]> = {
  own_car: ['Own car', '自家用車'],
  rental_car: ['Rental car', 'レンタカー'],
  bus: ['Bus', 'バス'],
  train: ['Train', '鉄道'],
  other: ['Other', 'その他'],
}
const PURPLE = '#6a3fb5'
const EARLY = '#b45309'
const AXIS = { fill: '#5d5475', fontSize: 12 }
const TIP = { background: '#ffffff', border: '1px solid #ddd5ee', borderRadius: 8, fontSize: 12.5, color: '#1f1633', boxShadow: '0 6px 20px rgba(60,30,110,.12)' }
type Period = 'last_30_days' | 'year_2025'

const compact = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : `${Math.round(v)}`)
/** Name cut to fit a treemap tile (about 7px per character at 12.5px). */
const fit = (s: string, px: number) => (s.length * 7 <= px ? s : `${s.slice(0, Math.max(1, Math.floor(px / 7) - 1))}…`)
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`txo-card ${className}`}>
      <h3 className="txo-card-title">{title}</h3>
      <div className="txo-card-body">{children}</div>
    </section>
  )
}

function Slicer({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className="txo-slicer">
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

/** Overview page of the transport report: KPI row, four charts, slicers. */
export function TransportOverview({ data, modes, name, onOpenMap }: { data: TransportFile; modes: TransportModesFile | null; name: (id: string) => string; onOpenMap: (id: string) => void }) {
  const { t } = useLang()
  const [period, setPeriod] = useState<Period>('last_30_days')
  const [day, setDay] = useState<DayType>('saturday')
  const [site, setSite] = useState<string>('all')
  const sites = Object.keys(data.nodes).filter((id) => id !== data.hub)
  const modeSites = modes ? Object.keys(modes.nodes) : []

  // visitors by mode for the chosen period and site
  const byMode = useMemo(() => {
    if (!modes) return null
    if (site === 'all') return modes.totals[period].by_mode
    const n = modes.nodes[site]
    return n ? (period === 'last_30_days' ? n.by_mode_30d : n.by_mode_year) : null
  }, [modes, period, site])
  const siteShares = site !== 'all' && modes?.nodes[site] ? modes.nodes[site].shares : null
  const total = byMode ? MODE_ORDER.reduce((a, m) => a + byMode[m].visitors, 0) : null
  const share = (ms: ModeId[]) => {
    if (siteShares) return ms.reduce((a, m) => a + (siteShares[m]?.share ?? 0), 0)
    if (!byMode || !total) return null
    return ms.reduce((a, m) => a + byMode[m].visitors, 0) / total
  }
  const carShare = share(['own_car', 'rental_car'])
  const ptShare = share(['bus', 'train'])

  const shown = site === 'all' ? sites : sites.filter((s) => s === site)
  const lastBack = (id: string) => clockMinutes(data.nodes[id]?.days[day]?.to_hub?.leave)
  const linked = shown.filter((id) => lastBack(id) != null)
  const early = linked.filter((id) => (lastBack(id) ?? 9999) <= EARLY_LAST_RETURN_MIN)
  const buses = shown.reduce((a, id) => a + (data.nodes[id]?.days[day]?.departures ?? 0), 0)

  const modeBars = byMode ? MODE_ORDER.map((m) => ({ id: m, name: t(...MODE_NAME[m]), value: byMode[m].visitors })) : []
  const tree = modes
    ? modeSites
        .filter((id) => (period === 'last_30_days' ? modes.nodes[id].visitors_30d : modes.nodes[id].official_annual_2025))
        .map((id) => ({ id, name: name(id), size: (period === 'last_30_days' ? modes.nodes[id].visitors_30d : modes.nodes[id].official_annual_2025) ?? 0 }))
        .sort((a, b) => b.size - a.size)
    : []
  const backBars = sites
    .map((id) => ({ id, name: lastBack(id) == null ? `${name(id)} ${t('(no bus)', '（バスなし）')}` : name(id), value: lastBack(id), label: clockLabel(data.nodes[id].days[day]?.to_hub?.leave) }))
    .sort((a, b) => (a.value ?? 9999) - (b.value ?? 9999))
  const stacked = modes
    ? modeSites.map((id) => ({ id, name: name(id), ...Object.fromEntries(MODE_ORDER.map((m) => [m, Math.round((modes.nodes[id].shares[m]?.share ?? 0) * 1000) / 10])) }))
    : []
  const periodLabel = period === 'last_30_days' ? t('Last 30 days', '直近30日') : t('2025', '2025年')

  const kpis = [
    { value: total != null ? compact(total) : '—', label: t(`Visitors · ${periodLabel}`, `来訪者・${periodLabel}`) },
    { value: carShare != null ? `${Math.round(carShare * 100)}%` : '—', label: t('Arrive by car', '車で来訪') },
    { value: ptShare != null ? `${Math.round(ptShare * 100)}%` : '—', label: t('Arrive by bus or train', 'バス・鉄道で来訪') },
    site === 'all'
      ? { value: `${early.length} / ${linked.length}`, label: t('Sites: last bus back by 17:30', '最終便17:30までの地点') }
      : { value: lastBack(site) != null ? clockLabel(data.nodes[site].days[day]?.to_hub?.leave) : t('None', 'なし'), label: t('Last bus back to Fukui Stn', '福井駅への最終便') },
    { value: String(buses), label: t(`Buses a day · ${DAY_LABEL[day][0]}`, `バス本数/日・${DAY_LABEL[day][1]}`) },
  ]

  return (
    <div className="txo">
      <div className="txo-kpis">
        {kpis.map((k, i) => (
          <div key={i} className="txo-kpi">
            <div className="txo-kpi-value num">{k.value}</div>
            <div className="txo-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="txo-grid">
        <Card title={t('Visitors by mode', '交通手段別の来訪者')} className="txo-a">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={modeBars} margin={{ top: 22, right: 8, left: 8, bottom: 0 }}>
              <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: '#ddd5ee' }} interval={0} />
              <YAxis hide />
              <Tooltip cursor={{ fill: 'rgba(106,63,181,.06)' }} contentStyle={TIP} formatter={(v) => [Number(v).toLocaleString(), t('visitors', '人')]} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                {modeBars.map((d) => (
                  <Cell key={d.id} fill={MODE_COLOURS[d.id]} />
                ))}
                <LabelList dataKey="value" position="top" formatter={(v) => compact(Number(v))} style={{ fill: '#1f1633', fontSize: 12, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title={t('Visitors by site', '地点別の来訪者')} className="txo-b">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={tree}
              dataKey="size"
              stroke="#ffffff"
              isAnimationActive={false}
              content={(p: { x?: number; y?: number; width?: number; height?: number; name?: string; size?: number; index?: number; id?: string }) => {
                const { x = 0, y = 0, width = 0, height = 0, name: n, size, id } = p
                const fill = PURPLE
                return (
                  <g style={{ cursor: id ? 'pointer' : undefined }} onClick={() => id && setSite(id)}>
                    <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={4} />
                    {width > 56 && height > 34 && (
                      <>
                        <text x={x + 8} y={y + 18} fill="#fff" stroke="none" fontSize={12.5} fontWeight={600}>
                          {fit(n ?? '', width - 14)}
                        </text>
                        <text x={x + 8} y={y + height - 8} fill="rgba(255,255,255,.85)" stroke="none" fontSize={12}>
                          {size != null ? compact(size) : ''}
                        </text>
                      </>
                    )}
                  </g>
                )
              }}
            />
          </ResponsiveContainer>
        </Card>

        <Card title={t(`Last bus back to Fukui Station · ${DAY_LABEL[day][0]}`, `福井駅への最終便・${DAY_LABEL[day][1]}`)} className="txo-c">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={backBars.map((b) => ({ ...b, value: b.value ?? 6 * 60 }))} layout="vertical" margin={{ top: 22, right: 56, left: 8, bottom: 8 }}>
              <XAxis type="number" domain={[6 * 60, 22 * 60]} ticks={[360, 600, 840, 1080, 1320]} tickFormatter={hhmm} tick={AXIS} tickLine={false} axisLine={{ stroke: '#ddd5ee' }} />
              <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={150} />
              <ReferenceLine x={EARLY_LAST_RETURN_MIN} stroke={EARLY} strokeDasharray="4 4" label={{ value: '17:30', position: 'top', fill: EARLY, fontSize: 11 }} />
              <Tooltip cursor={{ fill: 'rgba(106,63,181,.06)' }} contentStyle={TIP} formatter={(_, __, item) => [(item?.payload as { label?: string })?.label ?? '—', t('last bus', '最終便')]} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22} isAnimationActive={false} onClick={(d) => onOpenMap((d as unknown as { id: string }).id)} style={{ cursor: 'pointer' }}>
                {backBars.map((b) => (
                  <Cell key={b.id} fill={b.value == null ? 'transparent' : b.value <= EARLY_LAST_RETURN_MIN ? EARLY : PURPLE} />
                ))}
                <LabelList
                  dataKey="label"
                  position="right"
                  formatter={(v) => (v === '—' ? '' : String(v))}
                  style={{ fill: '#1f1633', fontSize: 12.5, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="txo-note">
            <i style={{ background: EARLY }}></i>
            {t('By 17:30: a visit ends early or needs a car', '17:30まで：滞在が早く終わるか車が必要')}
          </p>
        </Card>

        <Card title={t('How visitors travel, by site (%)', '地点別の交通手段（%）')} className="txo-d">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stacked} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barCategoryGap={8}>
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={150} />
              <Tooltip cursor={{ fill: 'rgba(106,63,181,.06)' }} contentStyle={TIP} formatter={(v, k) => [`${v}%`, t(...MODE_NAME[k as ModeId])]} />
              {MODE_ORDER.map((m) => (
                <Bar key={m} dataKey={m} stackId="s" fill={MODE_COLOURS[m]} isAnimationActive={false} stroke="#fff" strokeWidth={1.5}>
                  <LabelList dataKey={m} position="center" formatter={(v) => (Number(v) >= 10 ? `${Math.round(Number(v))}%` : '')} style={{ fill: '#fff', fontSize: 11.5, fontWeight: 600 }} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div className="txo-legend">
            {MODE_ORDER.map((m) => (
              <span key={m}>
                <i style={{ background: MODE_COLOURS[m] }}></i>
                {t(...MODE_NAME[m])}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="txo-slicers">
        <Slicer
          label={t('Period', '期間')}
          value={period}
          onChange={(v) => setPeriod(v as Period)}
          options={[
            ['last_30_days', t('Last 30 days', '直近30日')],
            ['year_2025', t('2025', '2025年')],
          ]}
        />
        <Slicer
          label={t('Timetable day', '時刻表の曜日')}
          value={day}
          onChange={(v) => setDay(v as DayType)}
          options={(Object.keys(DAY_LABEL) as DayType[]).map((k) => [k, t(...DAY_LABEL[k])])}
        />
        <Slicer label={t('Site', '地点')} value={site} onChange={setSite} options={[['all', t('All sites', 'すべて')], ...sites.map((id) => [id, name(id)] as [string, string])]} />
        <div className="txo-source">
          {t('Estimates from the Fukui Prefecture tourism survey × site visitor counts; bus timetables (GTFS-JP). See Notes.', '福井県観光アンケート×各地点の来訪者数による推計、バス時刻表（GTFS-JP）。注記参照。')}
        </div>
      </div>
    </div>
  )
}
