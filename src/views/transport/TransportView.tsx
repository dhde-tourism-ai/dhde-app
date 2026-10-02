import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NodeRegistry } from '../../types/nodes'
import type { DayType, TransportFile, TransportMode, TransportTrendsFile } from '../../types/transport'
import { useJsonResource } from '../../hooks/useJsonResource'
import { useLang } from '../../lib/i18n'
import { isHoliday } from '../../lib/holidays'
import { Icon } from '../../components/icons'
import { Loading, LoadError } from '../../components/StateMsg'
import {
  DAY_LABEL,
  EARLY_LAST_RETURN_MIN,
  MODE_COLOUR,
  MODE_LABEL,
  clockLabel,
  clockMinutes,
  dayTypeOf,
  fmtMinutes,
} from '../../lib/transport'
import '../../styles/pages.css'
import '../../styles/transport.css'

const AXIS = { fill: '#7f8ba3', fontSize: 11, fontFamily: 'IBM Plex Mono' }
const TIP = { background: '#17233a', border: '1px solid rgba(160,185,230,.2)', borderRadius: 8, fontSize: 12, color: '#e9eef8' }
/** One colour per term: two of them are rail, so mode colours alone would clash. */
const TREND_COLOURS = ['#f0a43a', '#4fb3ff', '#ff6f91', '#9aa7c0', '#c39bff']
const TERM_JA: Record<string, string> = {
  'Echizen Railway': 'えちぜん鉄道',
  'Keifuku Bus': '京福バス',
  'Hokuriku Shinkansen Fukui': '北陸新幹線 福井',
  'Car rental Fukui': 'レンタカー 福井',
  'Bike rental Fukui': 'レンタサイクル 福井',
}
const PUBLISH = {
  ok: { cls: 'ok', en: 'Open licence', ja: 'オープンライセンス' },
  check: { cls: 'check', en: 'Licence to confirm', ja: '利用許諾を確認中' },
  research_only: { cls: 'research', en: 'Research use only', ja: '研究目的のみ' },
} as const
/** Day timeline from 05:00 to 25:00 (01:00 next day). */
const T0 = 5 * 60
const T1 = 25 * 60
const pct = (m: number) => `${(Math.max(0, Math.min(1, (m - T0) / (T1 - T0))) * 100).toFixed(2)}%`
const TICKS = [6, 9, 12, 15, 18, 21, 24]

const todayIso = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

/**
 * Transport view: how visitors reach the six priority sites without a car,
 * from transport.json (open GTFS-JP timetables). The headline is the last
 * public transport back to Fukui Station: early last services push visitors
 * to leave the same day.
 */
export default function TransportView({ registry, onOpenMap }: { registry: NodeRegistry | null; onOpenMap: (id: string) => void }) {
  const { t, lang } = useLang()
  const res = useJsonResource<TransportFile>('transport.json')
  const trends = useJsonResource<TransportTrendsFile>('transport_trends.json').data
  const [day, setDay] = useState<DayType>(() => dayTypeOf(new Date(`${todayIso()}T12:00:00`), (d) => isHoliday(d.toISOString().slice(0, 10))))

  if (res.isLoading) return <Loading what={t('Loading transport…', '交通データを読み込み中…')} />
  if (res.error || !res.data) return <LoadError file="transport.json" error={res.error} />
  const data = res.data
  const names = Object.fromEntries((registry?.nodes ?? []).map((n) => [n.id, [n.name, n.name_ja] as [string, string]]))
  const name = (id: string) => (names[id] ? t(names[id][0], names[id][1]) : id)
  const hub = name(data.hub)
  const ids = Object.keys(data.nodes)
  const others = ids.filter((id) => id !== data.hub)
  // Earliest last return first: the sites that lose their public transport soonest.
  const ranked = others.slice().sort((a, b) => {
    const la = clockMinutes(data.nodes[a].days[day]?.to_hub?.leave) ?? -1
    const lb = clockMinutes(data.nodes[b].days[day]?.to_hub?.leave) ?? -1
    return la - lb
  })
  const early = ranked.filter((id) => {
    const m = clockMinutes(data.nodes[id].days[day]?.to_hub?.leave)
    return m != null && m <= EARLY_LAST_RETURN_MIN
  })
  const carOnly = ranked.filter((id) => !data.nodes[id].days[day]?.to_hub)
  const researchRail = data.sources.some((s) => s.publish_status === 'research_only')
  const trendRows =
    trends?.weeks.map((w, i) => Object.fromEntries([['week', w.slice(5)], ...trends.terms.map((x) => [x.label, x.values[i]])])) ?? []

  return (
    <div className="page transport">
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('Transport track', '交通トラック')}</div>
          <h1 className="page-title">{t('Getting to the sites without a car', '車なしで各地点へ')}</h1>
          <p className="page-sub">
            {t(
              `Scheduled bus and rail services to the six priority sites, and when the last one leaves for ${hub}. From the operators' open timetables (GTFS-JP), not live.`,
              `6つの重点地点へのバス・鉄道の運行と、${hub}へ戻る最終便の時刻。事業者のオープンな時刻表（GTFS-JP）に基づく予定で、リアルタイムではない。`,
            )}
          </p>
        </div>
        <div className="access-days tr-days" role="tablist" aria-label={t('Day type', '曜日区分')}>
          {(Object.keys(DAY_LABEL) as DayType[]).map((k) => (
            <button key={k} role="tab" aria-selected={day === k} onClick={() => setDay(k)}>
              {t(...DAY_LABEL[k])}
            </button>
          ))}
        </div>
      </div>

      {researchRail && (
        <div className="banner banner-warn tr-banner">
          <Icon name="alert" size={16} />
          <span>
            {t(
              'Rail times come from a research timetable (University of Tokyo, October 2024 timetable, research use only), and the Keifuku Bus licence still needs confirming with the company. Check both before these numbers go public.',
              '鉄道の時刻は研究用時刻表（東京大学、2024年10月ダイヤ、研究目的のみ）で、京福バスの利用許諾も会社に確認中。公開前に両方を確認すること。',
            )}
          </span>
        </div>
      )}

      <div className="card-grid">
        {/* Headline: when public transport runs out */}
        <section className="s-card" style={{ ['--span' as string]: 12 }}>
          <div className="s-card-head">
            <div>
              <h2 className="card-title">{t(`When public transport back to ${hub} runs out`, `${hub}へ戻る公共交通がなくなる時刻`)}</h2>
              <p className="card-sub">
                {t(
                  `Bar: from the first arrival from ${hub} to the last departure back. After the marker, the only way back is by car. ${DAY_LABEL[day][0]}, ${data.reference_days[day]}.`,
                  `バー：${hub}からの始発到着から、戻りの最終出発まで。印の後は車でしか戻れない。${DAY_LABEL[day][1]}（${data.reference_days[day]}）。`,
                )}
              </p>
            </div>
          </div>
          <div className="tr-timeline">
            <div className="tr-axis">
              {TICKS.map((h) => (
                <span key={h} style={{ left: pct(h * 60) }}>
                  {String(h % 24).padStart(2, '0')}:00
                </span>
              ))}
            </div>
            {ranked.map((id) => {
              const d = data.nodes[id].days[day]
              const from = clockMinutes(d?.from_hub?.first_arrival)
              const to = clockMinutes(d?.to_hub?.leave)
              const isEarly = to != null && to <= EARLY_LAST_RETURN_MIN
              return (
                <div key={id} className="tr-row">
                  <button className="tr-name" onClick={() => onOpenMap(id)} title={t('Show on the map', '地図で表示')}>
                    {name(id)}
                  </button>
                  <div className="tr-track">
                    <span className="tr-cut" style={{ left: pct(EARLY_LAST_RETURN_MIN) }} aria-hidden="true"></span>
                    {from != null && to != null ? (
                      <>
                        <span className={`tr-bar${isEarly ? ' early' : ''}`} style={{ left: pct(from), width: `calc(${pct(to)} - ${pct(from)})` }}></span>
                        <span className={`tr-mark${isEarly ? ' early' : ''}`} style={{ left: pct(to) }}>
                          {clockLabel(d?.to_hub?.leave)}
                        </span>
                      </>
                    ) : (
                      <span className="tr-none">
                        <Icon name="car" size={13} /> {d && d.departures > 0 ? t(`no public transport link to ${hub}: car only`, `${hub}との公共交通の接続なし：車のみ`) : t('no bus or train this day: car only', 'この日はバス・鉄道なし：車のみ')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="tr-finding">
            {early.length > 0 && (
              <>
                <strong>{early.map(name).join(t(', ', '、'))}</strong>
                {t(
                  `: the last way back without a car leaves at 17:30 or earlier, so a visit there cannot run into the evening.`,
                  `：車なしで戻る最終便が17時30分以前のため、夕方以降まで滞在できない。`,
                )}{' '}
              </>
            )}
            {carOnly.length > 0 && (
              <>
                <strong>{carOnly.map(name).join(t(', ', '、'))}</strong>
                {t(': reachable by car only on this day.', '：この日は車でのみ到達可能。')}
              </>
            )}
          </p>
        </section>

        {/* One card per site */}
        {ids.map((id) => {
          const n = data.nodes[id]
          const d = n.days[day]
          const isHub = id === data.hub
          const to = clockMinutes(d?.to_hub?.leave)
          const isEarly = to != null && to <= EARLY_LAST_RETURN_MIN
          const nearest = n.stops?.slice().sort((a, b) => a.distance_m - b.distance_m)[0]
          const modes = Object.entries(d?.departures_by_mode ?? {}) as [TransportMode, number][]
          return (
            <section key={id} className="s-card tr-node" style={{ ['--span' as string]: 4 }}>
              <div className="s-card-head">
                <div>
                  <h3 className="card-title">{name(id)}</h3>
                  <p className="card-sub">
                    {isHub
                      ? t('Hub: journeys are measured from here', '起点：所要時間はここから')
                      : n.anchor.label !== names[id]?.[0]
                        ? t(`Measured at: ${n.anchor.label}`, `基準点：${n.anchor.label_ja}`)
                        : t(`Stops within ${n.radius_m} m`, `${n.radius_m}m以内の停留所・駅`)}
                  </p>
                </div>
                <button className="btn btn-ghost tr-map" onClick={() => onOpenMap(id)}>
                  <Icon name="map" size={14} /> {t('Map', '地図')}
                </button>
              </div>
              <div className="tr-kpis">
                <div>
                  <div className="eyebrow">{t('Departures / day', '1日の出発本数')}</div>
                  <div className="tr-big num">{d?.departures ?? 0}</div>
                  <div className="tr-chips">
                    {modes.map(([m, c]) => (
                      <span key={m} className="mode-chip" style={{ borderColor: MODE_COLOUR[m] }}>
                        {t(...MODE_LABEL[m])} {c}
                      </span>
                    ))}
                  </div>
                </div>
                {!isHub && (
                  <div>
                    <div className="eyebrow">{t(`Last back to ${hub}`, `${hub}への最終`)}</div>
                    <div className={`tr-big num${isEarly ? ' warn-text' : ''}`}>{d?.to_hub ? clockLabel(d.to_hub.leave) : t('car only', '車のみ')}</div>
                    {d?.to_hub && <div className="muted small">{t(`arrive ${clockLabel(d.to_hub.arrive_hub)}`, `${clockLabel(d.to_hub.arrive_hub)}着`)}</div>}
                  </div>
                )}
              </div>
              <ul className="road-list access-list">
                <li className="kv">
                  <span>{t('First / last departure', '始発 / 最終')}</span>
                  <span className="kv-v num">
                    {d?.departures ? `${clockLabel(d.first_departure)} – ${clockLabel(d.last_departure)}` : '—'}
                  </span>
                </li>
                {!isHub && (
                  <li className="kv">
                    <span>{t(`Fastest from ${hub}`, `${hub}から最速`)}</span>
                    <span className="kv-v">
                      <span className="num">{d?.from_hub ? fmtMinutes(d.from_hub.fastest_min, lang) : '—'}</span>
                      {d?.from_hub?.leave_0900 && (
                        <span className="muted small">
                          {t(`09:00 → leave ${d.from_hub.leave_0900.depart}, arrive ${d.from_hub.leave_0900.arrive}`, `9時以降：${d.from_hub.leave_0900.depart}発 ${d.from_hub.leave_0900.arrive}着`)}
                        </span>
                      )}
                    </span>
                  </li>
                )}
                {nearest && (
                  <li className="kv">
                    <span>{t('Nearest stop', '最寄りの停留所・駅')}</span>
                    <span className="kv-v">
                      {nearest.name} <span className="muted small">{t(`${nearest.walk_min} min walk`, `徒歩${nearest.walk_min}分`)}</span>
                    </span>
                  </li>
                )}
                {Object.entries(n.from_far).map(([fid, f]) => (
                  <li key={fid} className="kv" title={f.basis}>
                    <span>{t(`From ${f.name}`, `${f.name_ja}から`)}</span>
                    <span className="kv-v">
                      <span className="num">{f.minutes != null ? `≈ ${fmtMinutes(f.minutes, lang)}` : '—'}</span>
                      <span className="tr-tag">{t('Estimated', '推計')}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {(d?.routes.length ?? 0) > 0 && (
                <p className="muted small tr-routes">
                  {t('Lines: ', '路線：')}
                  {Array.from(new Set(d!.routes.map((r) => r.name))).slice(0, 5).join(' · ')}
                  {new Set(d!.routes.map((r) => r.name)).size > 5 && t(` + ${new Set(d!.routes.map((r) => r.name)).size - 5} more`, ` ほか${new Set(d!.routes.map((r) => r.name)).size - 5}路線`)}
                </p>
              )}
              {n.note && <p className="muted small tr-routes">{t(n.note, n.note_ja ?? n.note)}</p>}
            </section>
          )
        })}

        {/* Search interest */}
        {trends && trends.terms.length > 0 && (
          <section className="s-card s-illustrative" style={{ ['--span' as string]: 8 }}>
            <div className="s-card-head">
              <div>
                <h2 className="card-title">{t('Search interest in getting around Fukui', '福井の移動手段への検索関心')}</h2>
                <p className="card-sub">
                  {t(
                    'Google Trends, Japan, weekly, last 12 months. 0-100 relative to the busiest week of any term here: an interest index, not traveller numbers.',
                    'Googleトレンド（日本・週次・直近12か月）。ここの語の中で最も多い週を100とした相対値で、利用者数ではない。',
                  )}
                </p>
              </div>
              <span className="tr-tag">{t('Illustrative', '参考')}</span>
            </div>
            <div className="tr-chart">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendRows} margin={{ top: 6, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(160,185,230,.08)" vertical={false} />
                  <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={{ stroke: '#34425e' }} interval={7} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={TIP} />
                  {trends.terms.map((x, i) => (
                    <Line key={x.term} dataKey={x.label} name={t(x.label, TERM_JA[x.label] ?? x.term)} stroke={TREND_COLOURS[i % TREND_COLOURS.length]}
                      strokeWidth={x.mode === 'car' ? 1.5 : 2} strokeDasharray={x.mode === 'car' ? '4 3' : undefined} dot={false} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-key tr-key">
              {trends.terms.map((x, i) => (
                <span key={x.term}>
                  <i className="tr-swatch" style={{ background: TREND_COLOURS[i % TREND_COLOURS.length] }}></i>
                  {t(x.label, TERM_JA[x.label] ?? x.term)}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Mode share: Step 3 */}
        <section className="s-card s-pending" style={{ ['--span' as string]: trends ? 4 : 12 }}>
          <div className="s-card-head">
            <h2 className="card-title">{t('How visitors actually arrive', '来訪者の実際の交通手段')}</h2>
          </div>
          <p className="tr-pending">[pending]</p>
          <p className="muted small">
            {t(
              'Share of visitors arriving by car, train, bus or bike, per site. Comes from the "How did you get here?" question in Survey v2 (live 6 Oct), multiplied by each site\'s daily visitors, labelled Modelled. Cycling and parking figures are a Federation request.',
              '地点ごとの車・鉄道・バス・自転車での来訪の割合。アンケートv2（10月6日開始）の「どうやって来ましたか？」の回答に各地点の日別来訪者数を掛けて推計（Modelled）。自転車・駐車場の数値は連盟に依頼。',
            )}
          </p>
        </section>

        {/* Sources */}
        <section className="s-card" style={{ ['--span' as string]: 12 }}>
          <div className="s-card-head">
            <div>
              <h2 className="card-title">{t('Sources and licences', 'データ出典と利用条件')}</h2>
              <p className="card-sub">{t(data.note, data.note)}</p>
            </div>
          </div>
          <div className="tr-table-wrap">
            <table className="sum-table tr-table">
              <thead>
                <tr>
                  <th>{t('Timetable', '時刻表')}</th>
                  <th>{t('Mode', '手段')}</th>
                  <th>{t('Valid', '有効期間')}</th>
                  <th>{t('Licence', '利用条件')}</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((s) => (
                  <tr key={s.id}>
                    <th>
                      <a href={s.page} target="_blank" rel="noreferrer">
                        {t(s.name, s.name_ja)}
                      </a>
                      {s.caveat && <div className="muted small tr-caveat">{t(s.caveat, s.caveat_ja ?? s.caveat)}</div>}
                    </th>
                    <td>{t(...MODE_LABEL[s.mode])}</td>
                    <td className="num">
                      {s.valid_from ?? '—'} – {s.valid_to ?? '—'}
                    </td>
                    <td>
                      <span className={`tr-lic ${PUBLISH[s.publish_status].cls}`}>{t(PUBLISH[s.publish_status].en, PUBLISH[s.publish_status].ja)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small tr-routes">
            {t(
              'Journeys: connection scan over all timetables together, with changes between stops up to 300 m apart (+3 min). Walking: straight line × 1.3 at 80 m/min. Kanazawa and Kyoto add an estimated JR leg (Shinkansen and JR timetables are not open data). Walking areas on the map: OpenStreetMap via Valhalla.',
              '所要時間：全時刻表を合わせた乗換探索（300m以内の停留所間の乗換、+3分）。徒歩：直線距離×1.3、分速80m。金沢・京都はJR区間を推計で加算（新幹線・JRの時刻表はオープンデータでない）。地図の徒歩圏：OpenStreetMap（Valhalla）。',
            )}
          </p>
        </section>
      </div>
    </div>
  )
}
