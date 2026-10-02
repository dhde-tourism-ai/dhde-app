import { useState } from 'react'
import type { ReactNode } from 'react'
import type { NodeRegistry } from '../../types/nodes'
import type { DayType, TransportFile, TransportModesFile, TransportTrendsFile } from '../../types/transport'
import { useJsonResource } from '../../hooks/useJsonResource'
import { useLang } from '../../lib/i18n'
import { Loading, LoadError } from '../../components/StateMsg'
import { DAY_LABEL, EARLY_LAST_RETURN_MIN, clockLabel, clockMinutes, fmtMinutes } from '../../lib/transport'
import { sparkPath } from '../../lib/market'
import { ModeShare, modeTotals } from './ModeShare'
import { TransportOverview } from './TransportOverview'
import '../../styles/pages.css'
import '../../styles/transport.css'

/** Day timeline from 06:00 to 24:00. */
const T0 = 6 * 60
const T1 = 24 * 60
const pos = (m: number) => `${(Math.max(0, Math.min(1, (m - T0) / (T1 - T0))) * 100).toFixed(2)}%`
const TICKS = [6, 9, 12, 15, 18, 21, 24]
const NAV: [Tab, string, string][] = [
  ['overview', 'Overview', '概要'],
  ['findings', 'Key findings', '要点'],
  ['modes', 'How visitors travel', '交通手段'],
  ['lastbus', 'Last bus back', '最終便'],
  ['service', 'Service by site', '地点別の運行'],
  ['notes', 'Notes and sources', '注記と出典'],
]
const TERM_JA: Record<string, string> = {
  'Echizen Railway': 'えちぜん鉄道',
  'Keifuku Bus': '京福バス',
  'Hokuriku Shinkansen Fukui': '北陸新幹線 福井',
  'Car rental Fukui': 'レンタカー 福井',
  'Bike rental Fukui': 'レンタサイクル 福井',
}

/** One exhibit: number, action title (the finding), what is measured, the body, and its source. */
function Exhibit({
  n,
  title,
  sub,
  actions,
  source,
  children,
}: {
  n: number
  title: string
  sub: string
  actions?: ReactNode
  source: ReactNode
  children: ReactNode
}) {
  const { t } = useLang()
  return (
    <section className="tx-exhibit" aria-labelledby={`tx-ex-${n}`} id={`tx-exhibit-${n}`}>
      <header className="tx-ex-head">
        <div>
          <div className="tx-ex-n">{t(`Exhibit ${n}`, `図表${n}`)}</div>
          <h2 id={`tx-ex-${n}`} className="tx-ex-title">
            {title}
          </h2>
          <p className="tx-ex-sub">{sub}</p>
        </div>
        {actions}
      </header>
      <div className="tx-ex-body">{children}</div>
      <footer className="tx-ex-source">{source}</footer>
    </section>
  )
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="tx-seg" role="tablist" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  )
}

type Tab = 'overview' | 'findings' | 'modes' | 'lastbus' | 'service' | 'notes'

/**
 * Transport view, laid out as a report canvas with a side navigation:
 * Overview (KPI row, charts, slicers), then detail pages. The detail pages keep
 * the briefing structure: an executive summary of three
 * findings, then one exhibit per finding (mode split, last way back, service
 * level), then notes and sources. Every exhibit title states its finding.
 */
export default function TransportView({ registry, onOpenMap }: { registry: NodeRegistry | null; onOpenMap: (id: string) => void }) {
  const { t, lang } = useLang()
  const res = useJsonResource<TransportFile>('transport.json')
  const modes = useJsonResource<TransportModesFile>('transport_modes.json').data
  const trends = useJsonResource<TransportTrendsFile>('transport_trends.json').data
  const [day, setDay] = useState<DayType>('saturday')
  const [tab, setTab] = useState<Tab>('overview')

  if (res.isLoading) return <Loading what={t('Loading transport…', '交通データを読み込み中…')} />
  if (res.error || !res.data) return <LoadError file="transport.json" error={res.error} />
  const data = res.data
  const names = Object.fromEntries((registry?.nodes ?? []).map((n) => [n.id, [n.name, n.name_ja] as [string, string]]))
  const name = (id: string) => (names[id] ? t(names[id][0], names[id][1]) : id)
  const hub = t('Fukui Station', '福井駅')
  const sites = Object.keys(data.nodes).filter((id) => id !== data.hub)
  const lastBack = (id: string, d: DayType) => clockMinutes(data.nodes[id].days[d]?.to_hub?.leave)
  const linked = (d: DayType) => sites.filter((id) => lastBack(id, d) != null)
  const early = (d: DayType) => linked(d).filter((id) => (lastBack(id, d) ?? 9999) <= EARLY_LAST_RETURN_MIN)
  const noLink = sites.filter((id) => (['weekday', 'saturday', 'sunday'] as DayType[]).every((d) => lastBack(id, d) == null))
  const thin = sites
    .filter((id) => !noLink.includes(id))
    .map((id) => ({ id, deps: data.nodes[id].days.weekday?.departures ?? 0 }))
    .sort((a, b) => a.deps - b.deps)[0]
  const satEarly = early('saturday')
  const satLinked = linked('saturday')
  const mt = modes ? modeTotals(modes) : null
  const noRail = !data.sources.some((s) => s.mode === 'rail')
  const ranked = sites.slice().sort((a, b) => (lastBack(a, day) ?? -1) - (lastBack(b, day) ?? -1))
  const asOf = data.reference_days[day]
  const dayOptions: [DayType, string][] = (Object.keys(DAY_LABEL) as DayType[]).map((k) => [k, t(...DAY_LABEL[k])])
  const ON_DAY: Record<DayType, string> = {
    weekday: 'On weekdays',
    saturday: 'On Saturdays',
    sunday: 'On Sundays and holidays',
  }
  const dayEn = ON_DAY[day]
  const tlTitle =
    early(day).length === linked(day).length && linked(day).length > 0
      ? t(
          `${dayEn}, the last bus back to ${hub} leaves by 17:30 at every site it serves`,
          `${DAY_LABEL[day][1]}は、バスが通るすべての地点で${hub}への最終便が17時30分までに出る`,
        )
      : t(
          `${dayEn}, the last bus back to ${hub} leaves by 17:30 at ${early(day).length} of ${linked(day).length} sites`,
          `${DAY_LABEL[day][1]}は${linked(day).length}地点中${early(day).length}地点で最終便が17時30分まで`,
        )

  const findings = [
    mt && {
      big: `${Math.round(mt.car * 100)}%`,
      text: t(`of visitors arrive by car. Bus and train carry ${Math.round(mt.pt * 100)}%.`, `の来訪者が車で来訪。バス・鉄道は${Math.round(mt.pt * 100)}%。`),
      href: 'modes',
    },
    satLinked.length > 0 && {
      big: `${satEarly.length} / ${satLinked.length}`,
      text: t(
        `sites lose their last bus back to ${hub} by 17:30 on Saturdays, so a visit ends early or needs a car.`,
        `地点で土曜の${hub}への最終バスが17時30分まで。滞在は早く終わるか車が必要。`,
      ),
      href: 'lastbus',
    },
    noLink.length > 0 && {
      big: name(noLink[0]),
      text: thin
        ? t(
            `has no public transport at all, and ${name(thin.id)} has ${thin.deps} buses a day.`,
            `には公共交通が一切なく、${name(thin.id)}は1日${thin.deps}本。`,
          )
        : t('has no public transport at all.', 'には公共交通が一切ない。'),
      href: 'service',
    },
  ].filter(Boolean) as { big: string; text: string; href: string }[]

  return (
    <div className="page tx-page">
      <div className="tx-canvas">
        <aside className="tx-side" aria-label={t('Report pages', 'レポートのページ')}>
          <div className="tx-brand">
            <span className="tx-brand-mark">DHDE</span>
            <span className="tx-brand-sub">{t('Transport', '交通')}</span>
          </div>
          <nav className="tx-nav">
            {NAV.map(([id, en, ja]) => (
              <button key={id} className="tx-nav-btn" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
                {t(en, ja)}
              </button>
            ))}
          </nav>
          <p className="tx-side-foot">{t(`Timetables: week of ${data.reference_days.weekday}`, `時刻表：${data.reference_days.weekday}の週`)}</p>
        </aside>
        <main className="tx-main">
          <header className="tx-banner">
            <h1>{t('Visitor Transport Dashboard · Fukui priority sites', '来訪者交通ダッシュボード・福井の重点地点')}</h1>
          </header>

          {tab === 'overview' && <TransportOverview data={data} modes={modes} name={name} onOpenMap={onOpenMap} />}

          {tab === 'findings' && (
            <section className="tx-summary" aria-label={t('Key findings', '要点')}>
              <h2 className="tx-summary-h">{t('Key findings', '要点')}</h2>
              <ol className="tx-findings">
                {findings.map((f, i) => (
                  <li key={i}>
                    <a
                      href={`#/transport`}
                      className="tx-finding"
                      onClick={(e) => {
                        e.preventDefault()
                        setTab(f.href as Tab)
                      }}
                    >
                      <span className="tx-finding-n">{i + 1}</span>
                      <span className="tx-finding-big num">{f.big}</span>
                      <span className="tx-finding-text">{f.text}</span>
                    </a>
                  </li>
                ))}
              </ol>
              <p className="tx-implication">
                <strong>{t('So what', '示唆')}</strong>
                {t(
                  'Without a car, visitors have a short window at each site, which makes a day trip the default. Later weekend buses on the Tojinbo, Eiheiji and Katsuyama routes are the clearest lever to test for longer stays.',
                  '車なしの来訪者は各地点に滞在できる時間が短く、日帰りが前提になる。東尋坊・永平寺・勝山方面の週末の最終バスの延長が、滞在延長に向けて最初に検証すべき施策。',
                )}
              </p>
            </section>
          )}

          {tab === 'modes' && modes && (
            <Exhibit
              n={1}
              title={t('Three in four visitors arrive by car; one in five by bus or train', '来訪者の4人に3人が車、5人に1人がバス・鉄道')}
              sub={t(
                `Estimated visitors by mode, last 30 days (${modes.totals.last_30_days.period?.[0]} to ${modes.totals.last_30_days.period?.[1]}), five sites`,
                `交通手段別の推計来訪者数（直近30日、${modes.totals.last_30_days.period?.[0]}〜${modes.totals.last_30_days.period?.[1]}、5地点）`,
              )}
              source={
                <>
                  {t('Estimate. Source: ', '推計値。出典：')}
                  <a href={modes.survey.url} target="_blank" rel="noreferrer">
                    {t('Fukui Prefecture tourism survey', '福井県観光アンケート')}
                  </a>
                  {t(
                    ` (${modes.survey.from} to ${modes.survey.to}) × DHDE site visitor estimates. Fukui Station: shares only. Note 1.`,
                    `（${modes.survey.from}〜${modes.survey.to}）×DHDE各地点の来訪者推計。福井駅は割合のみ。注1。`,
                  )}
                </>
              }
            >
              <ModeShare data={modes} name={name} />
            </Exhibit>
          )}

          {tab === 'lastbus' && (
            <Exhibit
              n={2}
              title={tlTitle}
              sub={t(
                `When a visitor can get from ${hub} to each site and back by bus (${DAY_LABEL[day][0]} timetable, ${asOf})`,
                `${hub}から各地点へバスで往復できる時間帯（${DAY_LABEL[day][1]}、${asOf}）`,
              )}
              actions={<Segmented value={day} options={dayOptions} onChange={setDay} label={t('Day', '曜日')} />}
              source={t(
                'Source: operators’ open bus timetables (GTFS-JP), Fukui Prefecture open data. Scheduled times. Note 2.',
                '出典：事業者のオープンなバス時刻表（GTFS-JP、福井県オープンデータ）。予定時刻。注2。',
              )}
            >
              <div className="tx-tl">
                <div className="tx-tl-axis" aria-hidden="true">
                  {TICKS.map((h) => (
                    <span key={h} style={{ left: pos(h * 60) }}>
                      {String(h % 24).padStart(2, '0')}:00
                    </span>
                  ))}
                </div>
                {ranked.map((id) => {
                  const d = data.nodes[id].days[day]
                  const from = clockMinutes(d?.from_hub?.first_arrival)
                  const to = lastBack(id, day)
                  const isEarly = to != null && to <= EARLY_LAST_RETURN_MIN
                  return (
                    <div key={id} className="tx-tl-row">
                      <button className="tx-tl-name" onClick={() => onOpenMap(id)} title={t('Show on the map', '地図で表示')}>
                        {name(id)}
                      </button>
                      <div className="tx-tl-track">
                        <span className="tx-tl-ref" style={{ left: pos(EARLY_LAST_RETURN_MIN) }} aria-hidden="true"></span>
                        {from != null && to != null ? (
                          <>
                            <span
                              className={`tx-tl-bar${isEarly ? ' hi' : ''}`}
                              style={{
                                left: pos(from),
                                width: `calc(${pos(to)} - ${pos(from)})`,
                              }}
                            ></span>
                            <span className={`tx-tl-end num${isEarly ? ' hi' : ''}`} style={{ left: pos(to) }}>
                              {clockLabel(d?.to_hub?.leave)}
                            </span>
                          </>
                        ) : (
                          <span className="tx-tl-none">
                            {d?.departures ? t(`No bus link to ${hub}`, `${hub}へのバス接続なし`) : t('No bus or train: car only', 'バス・鉄道なし：車のみ')}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div className="tx-tl-row tx-tl-foot" aria-hidden="true">
                  <span></span>
                  <div className="tx-tl-legend">
                    <span>
                      <i className="tx-key-bar hi"></i>
                      {t('Last bus back by 17:30', '最終便が17時30分まで')}
                    </span>
                    <span>
                      <i className="tx-key-bar"></i>
                      {t('Later', 'それ以降')}
                    </span>
                    <span>
                      <i className="tx-key-ref"></i>
                      {t('17:30', '17時30分')}
                    </span>
                  </div>
                </div>
              </div>
            </Exhibit>
          )}

          {tab === 'service' && (
            <Exhibit
              n={3}
              title={
                noLink.length && thin
                  ? t(
                      `${name(noLink[0])} has no public transport; ${name(thin.id)} has ${thin.deps} buses a day`,
                      `${name(noLink[0])}は公共交通なし、${name(thin.id)}は1日${thin.deps}本`,
                    )
                  : t('Bus service varies widely between sites', '地点によってバスの運行は大きく異なる')
              }
              sub={t(`Public transport service level per site, by bus from ${hub}`, `${hub}からのバスによる各地点の公共交通の水準`)}
              source={t(
                'Source: operators’ open bus timetables (GTFS-JP). Trip times stop to stop. Kanazawa: estimated Shinkansen leg plus the quickest local bus. Notes 2 and 3.',
                '出典：事業者のオープンなバス時刻表（GTFS-JP）。所要時間は停留所間。金沢：新幹線区間の推計＋最短の地元バス。注2・3。',
              )}
            >
              <div className="tx-table-wrap">
                <table className="tx-table">
                  <thead>
                    <tr>
                      <th>{t('Site', '地点')}</th>
                      <th>
                        {t('Buses a day', 'バス本数/日')}
                        <span>{t('weekday', '平日')}</span>
                      </th>
                      <th>
                        {t(`Quickest from ${hub}`, `${hub}から最短`)}
                        <span>{t('weekday', '平日')}</span>
                      </th>
                      <th>
                        {t('Last bus back', '最終便')}
                        <span>{t('weekday', '平日')}</span>
                      </th>
                      <th>
                        {t('Last bus back', '最終便')}
                        <span>{t('Saturday', '土曜')}</span>
                      </th>
                      <th>
                        {t('From Kanazawa', '金沢から')}
                        <span>{t('estimate', '推計')}</span>
                      </th>
                      <th aria-label={t('Map', '地図')}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((id) => {
                      const wk = data.nodes[id].days.weekday
                      const sat = data.nodes[id].days.saturday
                      const back = (d: typeof wk) => {
                        const m = clockMinutes(d?.to_hub?.leave)
                        return m == null ? (
                          <span className="tx-dim">{t('none', 'なし')}</span>
                        ) : (
                          <span className={m <= EARLY_LAST_RETURN_MIN ? 'tx-hi' : ''}>{clockLabel(d?.to_hub?.leave)}</span>
                        )
                      }
                      const far = wk?.from_far?.kanazawa?.minutes
                      return (
                        <tr key={id}>
                          <th>{name(id)}</th>
                          <td className="num">{wk?.departures ? wk.departures : <span className="tx-dim">0</span>}</td>
                          <td className="num">{wk?.from_hub ? fmtMinutes(wk.from_hub.fastest_min, lang) : <span className="tx-dim">—</span>}</td>
                          <td className="num">{back(wk)}</td>
                          <td className="num">{back(sat)}</td>
                          <td className="num">{far != null ? `≈ ${fmtMinutes(far, lang)}` : <span className="tx-dim">—</span>}</td>
                          <td>
                            <button className="tx-link" onClick={() => onOpenMap(id)}>
                              {t('Map', '地図')} →
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="tx-table-note">
                <span className="tx-hi">{t('Amber', '橙色')}</span>
                {t(': last bus back to Fukui Station at or before 17:30.', '：福井駅への最終便が17時30分以前。')}
              </p>
            </Exhibit>
          )}

          {tab === 'notes' && trends && trends.terms.length > 0 && (
            <section className="tx-aside" aria-label={t('Search interest', '検索関心')}>
              <h2 className="tx-aside-h">{t('Context: search interest in transport, last 12 months', '参考：交通に関する検索関心（直近12か月）')}</h2>
              <ul className="tx-sparks">
                {trends.terms.map((x) => (
                  <li key={x.term}>
                    <span className="tx-spark-name">{t(x.label, TERM_JA[x.label] ?? x.term)}</span>
                    <svg viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden="true">
                      <path d={sparkPath(x.values, 120, 24)} />
                    </svg>
                    <span className="tx-spark-val num">{Math.round(x.values.reduce((a, v) => a + v, 0) / x.values.length)}</span>
                  </li>
                ))}
              </ul>
              <p className="tx-aside-note">
                {t(
                  `Google Trends, Japan, weekly. Number: the year’s average index (100 = the busiest week of any term). Relative interest, not traveller numbers. Collected ${trends.generated_at.slice(0, 10)}.`,
                  `Googleトレンド（日本・週次）。数値は年間平均の指数（いずれかの語の最多週＝100）。相対的な関心で利用者数ではない。${trends.generated_at.slice(0, 10)}取得。`,
                )}
              </p>
            </section>
          )}

          {tab === 'notes' && (
            <section className="tx-notes" aria-label={t('Notes and sources', '注記と出典')}>
              <h2 className="tx-aside-h">{t('Notes and sources', '注記と出典')}</h2>
              <ol>
                <li>
                  {t(
                    'Visitors by mode: each site’s visitor estimate (its camera, booking or hotel signal scaled to the official 2025 count) split by how that site’s respondents to the Fukui Prefecture tourism survey got around in Fukui. Several answers count equally; walking only when it was the only answer. Answers are voluntary, so treat the split as an estimate. Awara Onsen counts hotel guests; Fukui Station has no visitor estimate.',
                    '交通手段別の来訪者：各地点の来訪者推計（カメラ・予約・宿泊の指標を2025年の公式入込数に換算）を、その地点での福井県観光アンケートの「福井県内での交通手段」の回答割合で分けた推計。複数回答は均等配分、徒歩は単独回答のみ。回答は任意。あわら温泉は宿泊客、福井駅は来訪者推計なし。',
                  )}
                </li>
                <li>
                  {t(
                    `Timetables: ${data.sources.map((s) => s.name).join(', ')} (Fukui Prefecture open data). ${noRail ? 'Echizen Railway and Fukui Railway publish no open timetable, so trips are by bus only and look longer than by train at Katsuyama, Awara Onsen and Tojinbo. ' : ''}The Keifuku Bus licence is to be confirmed with the company before publication.`,
                    `時刻表：${data.sources.map((s) => s.name_ja).join('、')}（福井県オープンデータ）。${noRail ? 'えちぜん鉄道・福井鉄道はオープンな時刻表を公開していないため、移動はバスのみで、勝山・あわら温泉・東尋坊では鉄道より所要時間が長めに出る。' : ''}京福バスの利用許諾は公開前に会社へ確認予定。`,
                  )}
                </li>
                <li>
                  {t(
                    'Kanazawa: an estimated Hokuriku Shinkansen leg (25 min to Fukui or Awara-Onsen station; JR timetables are not open data), 5 min to change, then the quickest local bus that day.',
                    '金沢：北陸新幹線区間の推計（福井駅・芦原温泉駅まで25分。JRの時刻表はオープンデータでない）、乗換5分、その日の最短の地元バス。',
                  )}
                </li>
              </ol>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
