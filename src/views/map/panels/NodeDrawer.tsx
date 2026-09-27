import { Area, Bar, BarChart, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { LiveData } from '../../../types/live'
import type { RoutesFile } from '../../../types/routes'
import type { DashboardData } from '../../../types/dashboard'
import type { EconomicsFigures, Metric, RegionalEconomics } from '../../../types/economics'
import type { MapNode } from '../../../lib/nodes'
import { MEASURE_LABEL, isEstimatedMeasure } from '../../../lib/nodes'
import type { NodeFrame } from '../../../lib/live'
import { CONDITION_LABEL, dailyArrivals, dayLabel, routeCongestion, sentimentColour, sentimentLabel, trafficTier } from '../../../lib/live'
import { routesTouching } from '../../../lib/routes'
import { econNodeFor, fmtLost } from '../../../lib/economics'
import { fmtCompact, fmtMetric } from '../../../lib/format'
import { useLang } from '../../../lib/i18n'
import { Icon, WeatherIcon } from '../../../components/icons'
import { StatusPill } from '../../../components/StatusPill'
import { StatusTag } from '../../../components/StatusTag'
import { DemoBadge } from '../../../components/DemoBadge'

const S1 = '#3987e5'
const AXIS = { fill: '#7f8ba3', fontSize: 10, fontFamily: 'IBM Plex Mono' }
const TIP = { background: '#17233a', border: '1px solid rgba(160,185,230,.2)', borderRadius: 8, fontSize: 12, color: '#e9eef8' }

interface Props {
  node: MapNode
  frame: NodeFrame | undefined
  live: LiveData | null
  routes: RoutesFile | null
  dashboard: DashboardData | null
  economics: RegionalEconomics | null
  t: number
  onClose: () => void
  onOpenNode: (id: string) => void
}

function MetricRow({ label, m, kind }: { label: string; m: Metric; kind?: 'yen' | 'count' }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <span className="kv-v">
        <span className="num">{fmtMetric(m, kind)}</span> <StatusPill status={m.status} />
      </span>
    </div>
  )
}

function Econ({ f }: { f: EconomicsFigures }) {
  const { t } = useLang()
  const o = f.opportunity_lost_yen
  return (
    <>
      <MetricRow label={t('Visitors', '来訪者')} m={f.visitors} />
      <MetricRow label={t('Revenue', '観光収入')} m={f.revenue_yen} kind="yen" />
      <div className="kv">
        <span>{t('Opportunity lost', '機会損失')}</span>
        <span className="kv-v num">{fmtLost(f)}</span>
      </div>
      <MetricRow label={t('· overnight gap', '・宿泊ギャップ')} m={o.overnight_gap} kind="yen" />
      <MetricRow label={t('· weather', '・天候')} m={o.weather} kind="yen" />
      <MetricRow label={t('· idle rooms', '・空室')} m={o.idle_rooms} kind="yen" />
    </>
  )
}

export function NodeDrawer({ node, frame, live, routes, dashboard, economics, t, onClose, onOpenNode }: Props) {
  const { t: tr, lang } = useLang()
  const measure = node.measure
  const est = isEstimatedMeasure(measure) || measure === 'vehicles'
  const hasDashboard = Boolean(dashboard?.nodes[node.id])
  const econ = econNodeFor(node, economics)
  const day = Math.floor(t / 24)
  const ln = live?.nodes[node.id]

  const hourly = ln
    ? Array.from({ length: 24 }, (_, h) => {
        const i = day * 24 + h
        return {
          h,
          actual: ln.on_site.actual[i],
          forecast: ln.on_site.predicted[i],
          band: ln.on_site.lo && ln.on_site.hi ? [ln.on_site.lo[i], ln.on_site.hi[i]] : null,
        }
      })
    : []
  const daily = live && ln ? dailyArrivals(live, node.id).map((d) => ({ ...d, label: dayLabel(live, d.d, lang, true), day: live.days[d.d].date.slice(8).replace(/^0/, '') })) : []

  return (
    <section className="float-panel drawer" aria-label={tr(node.name, node.name_ja)}>
      <header className="fp-head drawer-head">
        <div className="drawer-title">
          <h2 className="fp-title">{tr(node.name, node.name_ja)}</h2>
          <div className="drawer-sub">
            {lang === 'en' && <span className="ja-sub">{node.name_ja}</span>}
            {node.role && <span>{tr(node.role, node.role_ja)}</span>}
          </div>
        </div>
        <button className="icon-btn fp-close" onClick={onClose} aria-label={tr('Close', '閉じる')}>
          <Icon name="close" />
        </button>
      </header>

      <div className="fp-body">
        <div className="drawer-tags">
          {measure ? (
            <span className={`measure-tag ${est ? 'est' : ''}`}>{MEASURE_LABEL[measure]}</span>
          ) : (
            <span className="measure-tag est">{tr('Not measured yet', '未計測')}</span>
          )}
          {frame && live?.demo && <DemoBadge />}
        </div>

        {!frame ? (
          <p className="muted">{tr('No live feed for this node yet. It is placed on the map from the node registry.', 'このノードのライブデータはまだありません。')}</p>
        ) : (
          <>
            <div className="drawer-kpis">
              <div className="dk">
                <span className="eyebrow">{frame.observed ? tr('On site now', '現在の人数') : tr('Forecast on site', '予測人数')}</span>
                <span className={`dk-val ${frame.observed ? '' : 'fc'}`}>{Math.round(frame.onSite).toLocaleString()}</span>
                <StatusTag tier={frame.tier} />
              </div>
              <div className="dk">
                <span className="eyebrow">{tr('Forecast', '予測')}</span>
                <span className="dk-val sm">{Math.round(frame.predicted).toLocaleString()}</span>
                {frame.lo !== null && frame.hi !== null && (
                  <span className="muted num">
                    {frame.lo.toLocaleString()}–{frame.hi.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <div className="meter" role="img" aria-label={`${Math.round(frame.load * 100)}% ${tr('of comfortable capacity', '（快適容量比）')}`}>
              <span className="meter-fill" style={{ width: `${Math.min(100, frame.load * 100)}%`, background: frame.tier.colour }}></span>
              <span className="meter-cap" style={{ left: `${Math.min(100, 100 / Math.max(1, frame.load))}%` }}></span>
            </div>
            <p className="meter-lab muted">
              {Math.round(frame.load * 100)}% {tr('of comfortable capacity', 'の快適容量')} ({ln?.comfortable_capacity.toLocaleString()})
            </p>

            <h3 className="drawer-h">{tr('Today’s rhythm, people on site', '1日の推移（現地人数）')}</h3>
            <div className="mini-chart">
              <ResponsiveContainer width="100%" height={130}>
                <ComposedChart data={hourly} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <XAxis dataKey="h" tick={AXIS} tickLine={false} axisLine={{ stroke: '#34425e' }} ticks={[0, 6, 12, 18, 23]} tickFormatter={(h: number) => `${h}:00`} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => fmtCompact(v)} />
                  <Tooltip contentStyle={TIP} labelFormatter={(h) => `${h}:00`} formatter={(v: unknown, n: unknown) => [Array.isArray(v) ? v.map((x) => Number(x).toLocaleString()).join('–') : Number(v).toLocaleString(), String(n)]} />
                  <Area dataKey="band" name={tr('Range', '予測幅')} stroke="none" fill={S1} fillOpacity={0.12} isAnimationActive={false} />
                  <Line dataKey="forecast" name={tr('Forecast', '予測')} stroke={S1} strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
                  <Line dataKey="actual" name={tr('Counted', '実測')} stroke="#e9eef8" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                  {t >= day * 24 && t < day * 24 + 24 && <ReferenceLine x={t % 24} stroke="#8b9dff" strokeWidth={1.5} />}
                </ComposedChart>
              </ResponsiveContainer>
              <div className="chart-key">
                <span><i className="k-line" style={{ borderColor: '#e9eef8' }}></i>{tr('Counted', '実測')}</span>
                <span><i className="k-line dash" style={{ borderColor: S1 }}></i>{tr('Forecast', '予測')}</span>
                <span><i className="k-band" style={{ background: 'rgba(57,135,229,.25)' }}></i>{tr('Range', '予測幅')}</span>
              </div>
            </div>

            <h3 className="drawer-h">{tr('Daily arrivals, next 7 days (forecast)', '1日の来訪者数（7日間予測）')}</h3>
            <div className="mini-chart">
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={daily} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={{ stroke: '#34425e' }} interval={0} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => fmtCompact(v)} />
                  <Tooltip contentStyle={TIP} cursor={{ fill: 'rgba(139,157,255,.08)' }} labelFormatter={(_l, p) => String((p?.[0]?.payload as { label?: string } | undefined)?.label ?? '')} formatter={(v: unknown) => [Math.round(Number(v)).toLocaleString(), tr('Forecast arrivals', '予測来訪者数')]} />
                  <Bar dataKey="predicted" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false}>
                    {daily.map((d) => (
                      <Cell key={d.d} fill={d.d === day ? '#8b9dff' : S1} fillOpacity={d.d === day ? 1 : 0.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <h3 className="drawer-h">{tr('Weather', '気象')}</h3>
            <div className="wx-block">
              <WeatherIcon cond={frame.weather.cond} size={34} />
              <div>
                <div className="wx-big">
                  {Math.round(frame.weather.temp)}°C <span className="muted">{tr(CONDITION_LABEL[frame.weather.cond].en, CONDITION_LABEL[frame.weather.cond].ja)}</span>
                </div>
                <div className="muted num">
                  {tr('Rain', '降水確率')} {frame.weather.pop}% · {frame.weather.mm} mm/h · {tr('wind', '風')} {frame.weather.wind} m/s
                </div>
                <div className="muted small">
                  {tr('JMA point', '観測点')}: {tr(frame.weather.station, frame.weather.station_ja)}
                </div>
              </div>
            </div>
            {frame.alerts.map((a) => (
              <div key={a.id} className="banner banner-warn">
                <Icon name="alert" />
                <span>
                  <strong>{tr(a.title_en, a.title_ja)}.</strong> {tr(a.detail_en, a.detail_ja)}
                </span>
              </div>
            ))}

            <h3 className="drawer-h">{tr('Roads in', '接続道路')}</h3>
            <ul className="road-list">
              {routesTouching(routes, node.id)
                .filter((r) => live?.traffic[r.id])
                .map((r) => {
                  const c = live ? routeCongestion(live, r.id, t) : 0
                  return (
                    <li key={r.id} className="kv">
                      <span>{tr(r.label, r.label_ja)}</span>
                      <span className="kv-v">
                        <StatusTag tier={trafficTier(c)} suffix={` ${Math.round(c * 100)}%`} />
                      </span>
                    </li>
                  )
                })}
            </ul>

            <h3 className="drawer-h">{tr('Sentiment today', '本日の感情')}</h3>
            <div className="sent-block">
              <div className="div-bar" role="img" aria-label={`${tr('Score', 'スコア')} ${frame.sentiment.score.toFixed(2)}`}>
                <span className="div-mid"></span>
                <span
                  className="div-fill"
                  style={{
                    background: sentimentColour(frame.sentiment.score),
                    left: frame.sentiment.score < 0 ? `${50 + frame.sentiment.score * 50}%` : '50%',
                    width: `${Math.abs(frame.sentiment.score) * 50}%`,
                  }}
                ></span>
              </div>
              <div className="kv">
                <span>{tr(sentimentLabel(frame.sentiment.score).en, sentimentLabel(frame.sentiment.score).ja)}</span>
                <span className="kv-v num">
                  {frame.sentiment.score > 0 ? '+' : ''}
                  {frame.sentiment.score.toFixed(2)} · {frame.sentiment.posts} {tr('posts', '件')}
                </span>
              </div>
              <div className="chips">
                {frame.sentiment.keywords.map((k) => (
                  <span key={k.en} className="chip">
                    {tr(k.en, k.ja)}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {econ && (
          <>
            <h3 className="drawer-h">
              {tr('Economics', '経済')}
              {economics?.visitor_window?.nodes ? <span className="muted small"> · {economics.visitor_window.nodes}</span> : null}
            </h3>
            <Econ f={econ} />
            {econ.annotation && <p className="muted small">{econ.annotation}</p>}
          </>
        )}

        {hasDashboard && (
          <button className="btn btn-accent drawer-open" onClick={() => onOpenNode(node.id)}>
            {tr('Open node dashboard', 'ノードのダッシュボードを開く')} <Icon name="chevron" />
          </button>
        )}
      </div>
    </section>
  )
}
