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
import { fmtCompact, fmtDate, fmtMetric } from '../../../lib/format'
import { useLang } from '../../../lib/i18n'
import { Icon, WeatherIcon } from '../../../components/icons'
import { StatusPill } from '../../../components/StatusPill'
import { StatusTag } from '../../../components/StatusTag'
import { DemoBadge } from '../../../components/DemoBadge'
import { Stars } from '../../../components/Stars'
import { SourceBadge } from '../../../components/SourceBadge'
import { KddiPending } from '../../../components/KddiPending'
import { measureLabel } from '../../../lib/real'
import type { MarketVoiceData } from '../../../types/market'
import type { TransportFile } from '../../../types/transport'
import { AccessCard } from './AccessCard'

const S1 = '#3987e5'
const AXIS = { fill: '#7f8ba3', fontSize: 10, fontFamily: 'IBM Plex Mono' }

/** Screens waiting for KDDI location data; `only` limits a row to the sites it covers. */
const KDDI_ROWS: { en: string; ja: string; only?: string[] }[] = [
  { en: 'Measured daily count', ja: '実測の日別人数', only: ['eiheiji', 'katsuyama'] },
  { en: 'Where visitors come from (home prefecture or country)', ja: '来訪者の居住地（都道府県・国）' },
  { en: 'Time spent on site', ja: '滞在時間' },
  { en: 'Age and gender', ja: '年齢・性別' },
]
const TIP = { background: '#17233a', border: '1px solid rgba(160,185,230,.2)', borderRadius: 8, fontSize: 12, color: '#e9eef8' }

interface Props {
  node: MapNode
  frame: NodeFrame | undefined
  live: LiveData | null
  routes: RoutesFile | null
  transport?: TransportFile | null
  hubName?: [string, string]
  dashboard: DashboardData | null
  economics: RegionalEconomics | null
  market?: MarketVoiceData | null
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

export function NodeDrawer({ node, frame, live, routes, transport, hubName = ['Fukui Station', '福井駅'], dashboard, economics, market, t, onClose, onOpenNode }: Props) {
  const { t: tr, lang } = useLang()
  const measure = node.measure
  const est = isEstimatedMeasure(measure) || measure === 'vehicles'
  const hasDashboard = Boolean(dashboard?.nodes[node.id])
  const econ = econNodeFor(node, economics)
  const survey = market?.survey[node.id]
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
  const meta = live?.node_meta?.[node.id]
  const todayDay = live?.today_day ?? 0
  const daily =
    live && ln
      ? dailyArrivals(live, node.id).map((d) => {
          const realV = meta?.visitors_daily[d.d] ?? null
          const isReal = realV !== null && d.d < todayDay
          return { ...d, value: isReal ? realV : d.predicted, isReal, label: dayLabel(live, d.d, lang, true), day: live.days[d.d].date.slice(8).replace(/^0/, '') }
        })
      : []
  const lastSig = (() => {
    if (!meta) return null
    for (let k = Math.min(day, meta.signal_daily.length - 1); k >= 0; k--) if (meta.signal_daily[k] !== null) return { v: meta.signal_daily[k] as number, date: live?.days[k]?.date, index: meta.index_daily?.[k] ?? null }
    return null
  })()
  const CONF: Record<string, [string, string]> = { high: ['High', '高'], medium: ['Medium', '中'], low: ['Low', '低'], none: ['None', 'なし'] }

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
          {frame && live?.demo && (live.node_meta?.[node.id] ? <SourceBadge info={{ status: 'mixed', as_of: live.node_meta[node.id].visitors_as_of, real: [node.id] }} note={['Daily visitor totals for this site are real estimates; the hourly shape is simulated.', 'この地点の日別来訪者数は実推計。時間別の形は模擬。']} /> : <DemoBadge />)}
        </div>

        {!frame ? (
          <p className="muted">{tr('No live feed for this node yet. It is placed on the map from the node registry.', 'このノードのライブデータはまだありません。')}</p>
        ) : (
          <>
            {frame.noEstimate ? (
              <div className="real-card">
                <div className="rc-head">
                  <span className="eyebrow">{tr('Camera detections', 'カメラ検知数')}</span>
                  <span className="tt-real">{tr('Real signal', '実シグナル')}</span>
                </div>
                <span className="dk-val">{lastSig ? Math.round(lastSig.v).toLocaleString('en-US') : '—'}</span>
                {lastSig?.index != null && (
                  <div className="tt-kv">
                    <span>{tr('Busyness: % of an average 2025 day', '混雑度：2025年の平均日比')}</span>
                    <b className="num">{lastSig.index}%</b>
                  </div>
                )}
                <p className="muted small">
                  {tr('Detections in the day', '1日の検知数')} {lastSig?.date ? `(${lastSig.date})` : ''}.{' '}
                  {tr('Not unique visitors, and there is no official annual count for this site to scale to, so no visitor number is shown. The map keeps a simulated shape for flows only.', '延べ検知数で来訪者数ではありません。公式年間値がないため来訪者数は表示しません。')}
                </p>
              </div>
            ) : meta ? (
              <div className="real-card">
                <div className="rc-head">
                  <span className="eyebrow">{frame.realDay?.visitors != null ? tr('Visitors this day (modelled)', 'この日の来訪者数（推計）') : tr('Visitors this day (forecast)', 'この日の来訪者数（予測）')}</span>
                  {frame.realDay?.visitors != null ? <span className="tt-real">{tr('Real', '実データ')}</span> : <span className="tt-demo">{tr('Forecast', '予測')}</span>}
                </div>
                <span className="dk-val">{Math.round(frame.realDay?.visitors ?? daily[day]?.predicted ?? 0).toLocaleString('en-US')}</span>
                <div className="tt-grid">
                  <span className="tt-k">{tr('Method', '方法')}</span>
                  <span className="tt-v">{meta.method_text ? tr(meta.method_text, meta.method_text_ja ?? meta.method_text) : tr(`${measureLabel(meta.measure)} scaled to the 2025 official annual count`, `${measureLabel(meta.measure)}を2025年公式年間値に換算`)}</span>
                  <span className="tt-k">{tr(`Official ${meta.official_period_label ?? '2025'}`, `${meta.official_period_label_ja ?? '2025年'}公式`)}</span>
                  <span className="tt-v num">{meta.official_2025?.toLocaleString('en-US') ?? '—'}</span>
                  <span className="tt-k">{tr('Confidence', '信頼度')}</span>
                  <span className="tt-v">
                    <span className={`conf conf-${meta.confidence}`}>{tr(CONF[meta.confidence][0], CONF[meta.confidence][1])}</span>
                  </span>
                  {frame.realDay?.signal != null && (
                    <>
                      <span className="tt-k">{tr('Raw signal', '元シグナル')}</span>
                      <span className="tt-v num">{Math.round(frame.realDay.signal).toLocaleString('en-US')}</span>
                    </>
                  )}
                </div>
                <p className="muted small">{frame.realDay?.visitors != null ? tr('The hourly figures below are a simulated shape scaled to this total.', '下の時間別は、この合計に合わせた模擬の形です。') : tr(meta.forecast_method, '直近4週の同曜日平均（実推計）を模擬の時間分布で配分。')}</p>
              </div>
            ) : null}
            {!frame.noEstimate && (
            <>
            <div className="drawer-kpis">
              <div className="dk">
                <span className="eyebrow">{frame.observed ? tr('On site now', '現在の人数') : tr('Forecast on site', '予測人数')}</span>
                <span className={`dk-val ${frame.observed ? '' : 'fc'}`}>{Math.round(frame.onSite).toLocaleString('en-US')}</span>
                <StatusTag tier={frame.tier} />
              </div>
              <div className="dk">
                <span className="eyebrow">{tr('Forecast', '予測')}</span>
                <span className="dk-val sm">{Math.round(frame.predicted).toLocaleString('en-US')}</span>
                {frame.lo !== null && frame.hi !== null && (
                  <span className="muted num">
                    {frame.lo.toLocaleString('en-US')}–{frame.hi.toLocaleString('en-US')}
                  </span>
                )}
              </div>
            </div>
            <div className="meter" role="img" aria-label={`${Math.round(frame.load * 100)}% ${tr('of comfortable capacity', '（快適容量比）')}`}>
              <span className="meter-fill" style={{ width: `${Math.min(100, frame.load * 100)}%`, background: frame.tier.colour }}></span>
              <span className="meter-cap" style={{ left: `${Math.min(100, 100 / Math.max(1, frame.load))}%` }}></span>
            </div>
            <p className="meter-lab muted">
              {Math.round(frame.load * 100)}% {tr('of comfortable capacity', 'の快適容量')} ({ln?.comfortable_capacity.toLocaleString('en-US')})
            </p>
            <h3 className="drawer-h">{tr('Today’s rhythm, people on site', '1日の推移（現地人数）')}</h3>
            <div className="mini-chart">
              <ResponsiveContainer width="100%" height={130}>
                <ComposedChart data={hourly} margin={{ top: 6, right: 6, left: -4, bottom: 0 }}>
                  <XAxis dataKey="h" tick={AXIS} tickLine={false} axisLine={{ stroke: '#34425e' }} ticks={[0, 6, 12, 18, 23]} tickFormatter={(h: number) => `${h}:00`} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => fmtCompact(v)} />
                  <Tooltip contentStyle={TIP} labelFormatter={(h) => `${h}:00`} formatter={(v: unknown, n: unknown) => [Array.isArray(v) ? v.map((x) => Number(x).toLocaleString('en-US')).join('–') : Number(v).toLocaleString('en-US'), String(n)]} />
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

            <h3 className="drawer-h">{meta ? tr('Daily visitors: last 7 days (real) and next 7 (forecast)', '1日の来訪者数：直近7日（実）と今後7日（予測）') : tr('Daily arrivals, next 7 days (forecast)', '1日の来訪者数（7日間予測）')}</h3>
            <div className="mini-chart">
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={daily} margin={{ top: 6, right: 6, left: -4, bottom: 0 }}>
                  <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={{ stroke: '#34425e' }} interval={0} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => fmtCompact(v)} />
                  <Tooltip contentStyle={TIP} cursor={{ fill: 'rgba(139,157,255,.08)' }} labelFormatter={(_l, p) => String((p?.[0]?.payload as { label?: string } | undefined)?.label ?? '')} formatter={(v: unknown, _n: unknown, it: { payload?: { isReal?: boolean } }) => [Math.round(Number(v)).toLocaleString('en-US'), it?.payload?.isReal ? tr('Visitors (real estimate)', '来訪者（実推計）') : tr('Forecast', '予測')]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false}>
                    {daily.map((d) => (
                      <Cell key={d.d} fill={d.d === day ? '#8b9dff' : d.isReal ? S1 : '#6d86ad'} fillOpacity={d.d === day ? 1 : d.isReal ? 0.9 : 0.55} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {meta && (
                <div className="chart-key">
                  <span><i className="k-band" style={{ background: S1 }}></i>{tr('Real estimate', '実推計')}</span>
                  <span><i className="k-band" style={{ background: '#6d86ad', opacity: 0.6 }}></i>{tr('Forecast', '予測')}</span>
                  <span><i className="k-band" style={{ background: '#8b9dff' }}></i>{tr('Selected day', '選択日')}</span>
                </div>
              )}
            </div>
            </>
            )}

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
                {frame.wxDay.real && (
                  <div className="muted num small">
                    {tr('Day', '日')}: {frame.wxDay.temp?.toFixed(1)}°C · {frame.wxDay.precip?.toFixed(1)} mm · {frame.wxDay.wind?.toFixed(1)} m/s
                    {frame.wxDay.humidity !== null ? ` · ${tr('humidity', '湿度')} ${Math.round(frame.wxDay.humidity)}%` : ''}
                    {frame.wxDay.sun !== null ? ` · ${tr('sun', '日照')} ${frame.wxDay.sun.toFixed(2)} h` : ''}
                    {frame.wxDay.snow !== null ? ` · ${tr('snow', '積雪')} ${frame.wxDay.snow} cm` : ''}
                  </div>
                )}
                <div className="muted small">
                  {tr('JMA point', '観測点')}: {tr(frame.weather.station, frame.weather.station_ja)} · {frame.wxDay.real ? <span className="tt-real">{tr('Real daily', '実データ（日別）')}</span> : <span className="tt-demo">{tr('Demo', 'デモ')}</span>}
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

        {transport?.nodes[node.id] && <AccessCard data={transport} nodeId={node.id} hubName={hubName} />}

        {market && (market.reviews[node.id] || market.survey[node.id]) && (
          <>
            <h3 className="drawer-h">
              {tr('Voice of visitor and market', '来訪者の声と市場')} <DemoBadge compact />
            </h3>
            <div className="voice-grid">
              {market.reviews[node.id] && (
                <div className="vg-cell">
                  <span className="eyebrow">{tr('Reviews', 'レビュー')}</span>
                  <span className="vg-val num">{market.reviews[node.id].rating.toFixed(1)}</span>
                  <Stars value={market.reviews[node.id].rating} />
                  <span className="muted small num">
                    {market.reviews[node.id].count.toLocaleString('en-US')} {tr('reviews', '件')}
                  </span>
                </div>
              )}
              {survey && (
                <div className="vg-cell">
                  <span className="eyebrow">{tr('Survey', 'アンケート')}</span>
                  <span className="vg-val num">{survey.satisfaction.toFixed(1)}</span>
                  <span className="muted small">
                    {survey.nps !== null && `NPS ${survey.nps > 0 ? '+' : ''}${survey.nps} · `}
                    n={survey.responses_30d}
                  </span>
                </div>
              )}
              {market.social[node.id] && (
                <div className="vg-cell">
                  {market.social[node.id].real ? (
                    <>
                      <span className="eyebrow">{tr(`Instagram, ${market.social[node.id].real!.days} days`, `Instagram（${market.social[node.id].real!.days}日間）`)}</span>
                      <span className="vg-val num">{market.social[node.id].real!.posts}</span>
                      <span className="muted small">
                        {market.social[node.id].real!.photos} {tr('photos', '写真')} · {tr('to', '〜')} {fmtDate(market.social[node.id].real!.as_of, lang)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="eyebrow">{tr('Social, 24h', 'SNS（24時間）')}</span>
                      <span className="vg-val num">{market.social[node.id].posts_24h}</span>
                      <span className="muted small">
                        {market.social[node.id].images_24h} {tr('images', '画像')}
                      </span>
                    </>
                  )}
                </div>
              )}
              {market.hotels
                .filter((h) => h.node === node.id)
                .slice(0, 1)
                .map((h) => (
                  <div key={h.id} className="vg-cell">
                    <span className="eyebrow">{tr('Hotels tonight', '本日の宿泊')}</span>
                    <span className="vg-val num">{h.occupancy_pct[Math.min(h.occupancy_pct.length - 1, day)]}%</span>
                    <span className="muted small">
                      {h.rooms_left[Math.min(h.rooms_left.length - 1, day)]} {tr('rooms left', '室空き')}
                    </span>
                  </div>
                ))}
            </div>
          </>
        )}

        <h3 className="drawer-h">{tr('Visitor profile', '来訪者の特徴')}</h3>
        <ul className="kddi-list">
          {KDDI_ROWS.filter((r) => !r.only || r.only.includes(node.id)).map((r) => (
            <li key={r.en}>
              <span>{tr(r.en, r.ja)}</span>
              <KddiPending />
            </li>
          ))}
        </ul>

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
