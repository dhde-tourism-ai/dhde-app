import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NodeRegistry } from '../../types/nodes'
import type { DayType, TransportFile, TransportMode, TransportModesFile, TransportTrendsFile } from '../../types/transport'
import { useJsonResource } from '../../hooks/useJsonResource'
import { useLang } from '../../lib/i18n'
import { isHoliday } from '../../lib/holidays'
import { Icon } from '../../components/icons'
import { Loading, LoadError } from '../../components/StateMsg'
import { Itinerary } from '../../components/Itinerary'
import { ModeShare } from './ModeShare'
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
  const modes = useJsonResource<TransportModesFile>('transport_modes.json').data
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
  // No service at all this day, vs buses that run but no open timetable links them to the hub.
  const noService = ranked.filter((id) => !data.nodes[id].days[day]?.departures)
  const noLink = ranked.filter((id) => (data.nodes[id].days[day]?.departures ?? 0) > 0 && !data.nodes[id].days[day]?.to_hub)
  const keifukuCheck = data.sources.some((s) => s.publish_status === 'check')
  const noRail = !data.sources.some((s) => s.mode === 'rail')
  const trendRows =
    trends?.weeks.map((w, i) => Object.fromEntries([['week', w.slice(5)], ...trends.terms.map((x) => [x.label, x.values[i]])])) ?? []

  return (
    <div className="page transport">
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('Transport track', '交通トラック')}</div>
          <h1 className="page-title">{t('Getting to the sites', '各地点への交通')}</h1>
          <p className="page-sub">
            {t('How visitors reach the six priority sites, and how long the trip takes without a car.', '6つの重点地点への来訪者の交通手段と、車なしで行く場合の所要時間。')}
          </p>
        </div>
      </div>

      {modes && (
        <div className="tr-top">
          <ModeShare data={modes} name={name} />
        </div>
      )}

      <h2 className="tr-section-h">{t('Getting there without a car', '車なしで行く')}</h2>
      <div className="tr-day-row">
        <span className="muted small">{t('Timetable day', '時刻表の曜日')}</span>
        <div className="access-days tr-days" role="tablist" aria-label={t('Day type', '曜日区分')}>
          {(Object.keys(DAY_LABEL) as DayType[]).map((k) => (
            <button key={k} role="tab" aria-selected={day === k} onClick={() => setDay(k)}>
              {t(...DAY_LABEL[k])}
            </button>
          ))}
        </div>
      </div>

      {(noRail || keifukuCheck) && (
        <div className="banner banner-warn tr-banner">
          <Icon name="alert" size={16} />
          <div>
            {noRail && (
              <p className="tr-banner-p">
                <strong>{t('Buses only: no rail.', 'バスのみ：鉄道なし。')}</strong>{' '}
                {t(
                  'Echizen Railway and Fukui Railway have no open timetable, so every trip on this page is by bus. Where visitors would normally take the train (Katsuyama, Awara Onsen, Tojinbo), the trips shown are much longer than by rail. Rail is Pending until the operators publish a timetable.',
                  'えちぜん鉄道・福井鉄道にはオープンな時刻表がないため、このページの移動はすべてバス。通常は鉄道を使う地点（勝山・あわら温泉・東尋坊）では、表示の所要時間は鉄道よりかなり長い。事業者が時刻表を公開するまで鉄道は「データ待ち」。',
                )}
              </p>
            )}
            {keifukuCheck && (
              <p className="tr-banner-p">
                {t(
                  'The Keifuku Bus licence still needs confirming with the company before these numbers go public.',
                  '京福バスの利用許諾は、公開前に会社への確認が必要。',
                )}
              </p>
            )}
          </div>
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
                  `Bar: from the first possible arrival from ${hub} to the last bus or train back that still reaches it. After the marker, the only way back is by car. Dashed line: 17:30. ${DAY_LABEL[day][0]}, ${data.reference_days[day]}.`,
                  `バー：${hub}からの最も早い到着から、${hub}へ戻れる最終のバス・鉄道まで。印の後は車でしか戻れない。破線：17時30分。${DAY_LABEL[day][1]}（${data.reference_days[day]}）。`,
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
                        <Icon name="car" size={13} />{' '}
                        {d && d.departures > 0
                          ? t(`buses run here, but no open timetable links them to ${hub}`, `バスはあるが、${hub}とつながるオープンな時刻表がない`)
                          : t('no bus or train this day: car only', 'この日はバス・鉄道なし：車のみ')}
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
            {noService.length > 0 && (
              <>
                <strong>{noService.map(name).join(t(', ', '、'))}</strong>
                {t(': no bus or train at all on this day, so car only.', '：この日はバス・鉄道が一切なく、車のみ。')}{' '}
              </>
            )}
            {noLink.length > 0 && (
              <>
                <strong>{noLink.map(name).join(t(', ', '、'))}</strong>
                {t(
                  `: a local bus runs, but no open timetable connects it to ${hub} (JR lines are not open data), so the trip there can't be measured here.`,
                  `：地元のバスはあるが、${hub}とつながるオープンな時刻表がない（JR線はオープンデータでない）ため、ここでは所要時間を計測できない。`,
                )}
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
          const fh = d?.from_hub
          const lines = Array.from(new Set(d?.routes.map((r) => r.name) ?? []))
          return (
            <section key={id} className="s-card tr-node" style={{ ['--span' as string]: 4 }}>
              <div className="s-card-head">
                <div>
                  <h3 className="card-title">{name(id)}</h3>
                  <p className="card-sub">
                    {isHub
                      ? t('Starting point: journeys are measured from here', '起点：所要時間はここから')
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
                  <div className="eyebrow">{t('Departures / day, any direction', '1日の出発本数（全方向）')}</div>
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
                    <div className="eyebrow">{t(`Last bus or train back to ${hub}`, `${hub}へ戻る最終便`)}</div>
                    <div className={`tr-big num${isEarly ? ' warn-text' : ''}`}>
                      {d?.to_hub ? clockLabel(d.to_hub.leave) : d?.departures ? t('no link', '接続なし') : t('car only', '車のみ')}
                    </div>
                    {d?.to_hub && (
                      <div className="muted small">
                        {t(`arrive ${clockLabel(d.to_hub.arrive_hub)} (${fmtMinutes(d.to_hub.minutes, lang)})`, `${clockLabel(d.to_hub.arrive_hub)}着（${fmtMinutes(d.to_hub.minutes, lang)}）`)}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <ul className="road-list access-list">
                <li className="kv">
                  <span>{t('First / last departure, any direction', '始発 / 最終（全方向）')}</span>
                  <span className="kv-v num">{d?.departures ? `${clockLabel(d.first_departure)} – ${clockLabel(d.last_departure)}` : '—'}</span>
                </li>
                {!isHub && (
                  <li className="kv">
                    <span>{t(`Quickest trip from ${hub}`, `${hub}からの最短`)}</span>
                    <span className="kv-v">
                      {fh ? (
                        <>
                          <span className="num">{fmtMinutes(fh.fastest_min, lang)}</span>
                          <span className="muted small">{t(`leave ${clockLabel(fh.fastest.depart)} → arrive ${clockLabel(fh.fastest.arrive)}`, `${clockLabel(fh.fastest.depart)}発 → ${clockLabel(fh.fastest.arrive)}着`)}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </span>
                  </li>
                )}
                {!isHub && fh?.after_0900 && (
                  <li className="kv">
                    <span>{t('First trip leaving after 09:00', '9時以降の最初の便')}</span>
                    <span className="kv-v">
                      <span className="num">{t(`${clockLabel(fh.after_0900.depart)} → ${clockLabel(fh.after_0900.arrive)}`, `${clockLabel(fh.after_0900.depart)}発 → ${clockLabel(fh.after_0900.arrive)}着`)}</span>
                      <span className="muted small">{fmtMinutes(fh.after_0900.minutes, lang)}</span>
                    </span>
                  </li>
                )}
                {nearest && (
                  <li className="kv">
                    <span>{t('Nearest stop', '最寄りの停留所・駅')}</span>
                    <span className="kv-v">
                      {nearest.name} <span className="muted small">{t(`+ ${nearest.walk_min} min walk to the site`, `地点まで徒歩${nearest.walk_min}分`)}</span>
                    </span>
                  </li>
                )}
                {Object.entries(d?.from_far ?? {}).map(([fid, f]) => (
                  <li key={fid} className="kv" title={f.basis}>
                    <span>{t(`From ${f.name}`, `${f.name_ja}から`)}</span>
                    <span className="kv-v">
                      <span className="num">{f.minutes != null ? `≈ ${fmtMinutes(f.minutes, lang)}` : '—'}</span>
                      {f.minutes != null && f.via && (
                        <span className="muted small">
                          {f.local_min
                            ? t(`via ${f.via}: JR ${f.jr_min} + change ${f.change_min} + local ${f.local_min} min`, `${f.via_ja}経由：JR ${f.jr_min}＋乗換${f.change_min}＋地元${f.local_min}分`)
                            : t(`JR to ${f.via}`, `${f.via_ja}までJR`)}
                        </span>
                      )}
                      <span className="tr-tag">{t('Estimated', '推計')}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {!isHub && (fh?.after_0900 || d?.to_hub) && (
                <details className="itin-more tr-itins">
                  <summary>{t('Show the routes', '経路を表示')}</summary>
                  {fh?.after_0900 && (
                    <>
                      <div className="eyebrow tr-itin-h">{t(`Going: first trip after 09:00`, '行き：9時以降の最初の便')}</div>
                      <Itinerary legs={fh.after_0900.legs} />
                    </>
                  )}
                  {d?.to_hub && (
                    <>
                      <div className="eyebrow tr-itin-h">{t(`Coming back: the last trip`, '帰り：最終便')}</div>
                      <Itinerary legs={d.to_hub.legs} />
                    </>
                  )}
                </details>
              )}
              {lines.length > 0 && (
                <p className="muted small tr-routes">
                  {t('Lines: ', '路線：')}
                  {lines.slice(0, 5).join(' · ')}
                  {lines.length > 5 && t(` + ${lines.length - 5} more`, ` ほか${lines.length - 5}路線`)}
                </p>
              )}
              {n.note && <p className="muted small tr-routes">{t(n.note, n.note_ja ?? n.note)}</p>}
            </section>
          )
        })}

        {/* Search interest */}
        {trends && trends.terms.length > 0 && (
          <section className="s-card s-illustrative" style={{ ['--span' as string]: 12 }}>
            <div className="s-card-head">
              <div>
                <h2 className="card-title">{t('Search interest in getting around Fukui', '福井の移動手段への検索関心')}</h2>
                <p className="card-sub">
                  {t(
                    `Real Google Trends data (Japan, weekly, last 12 months), collected ${trends.generated_at.slice(0, 10)}. Marked Illustrative because it is a relative index (100 = the busiest week of any term here), not a count of travellers.`,
                    `Googleトレンドの実データ（日本・週次・直近12か月、${trends.generated_at.slice(0, 10)}取得）。相対指数（ここの語で最も多い週＝100）で利用者数ではないため「参考」と表示。`,
                  )}
                </p>
              </div>
              <span className="tr-tag">{t('Illustrative · index', '参考・指数')}</span>
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
              'Journeys run stop to stop over all timetables together, changing between stops up to 300 m apart (walk + 3 min). Trip minutes are arrive minus depart, so they match the times shown. Walking to the site: straight line × 1.3 at 80 m/min, shown separately. Kanazawa and Kyoto: a fixed JR estimate to Fukui or Awara-Onsen station (Shinkansen timetables are not open data), 5 min to change, then the quickest local trip on the selected day; the faster gateway is used.',
              '所要時間は全時刻表を合わせた停留所間の探索（300m以内の乗換は徒歩＋3分）。分数は到着時刻－出発時刻で、表示時刻と一致。地点までの徒歩（直線×1.3、分速80m）は別表示。金沢・京都：福井駅または芦原温泉駅までのJRの固定推計（新幹線の時刻表はオープンデータでない）＋乗換5分＋選択日の最短の地元交通。速い方の駅を使用。',
            )}
          </p>
        </section>
      </div>
    </div>
  )
}
