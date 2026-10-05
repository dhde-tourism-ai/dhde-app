import { useState } from 'react'
import type { DayType, TransportFile } from '../../../types/transport'
import { useLang } from '../../../lib/i18n'
import { isHoliday } from '../../../lib/holidays'
import { Icon } from '../../../components/icons'
import { Itinerary } from '../../../components/Itinerary'
import { placeEn } from '../../../lib/transportNames'
import {
  DAY_LABEL,
  EARLY_LAST_RETURN_MIN,
  MODE_COLOUR,
  MODE_LABEL,
  clockLabel,
  clockMinutes,
  dayTypeOf,
  fmtMinutes,
  sourcesFor,
  worstStatus,
} from '../../../lib/transport'

const STATUS_BADGE = {
  ok: { cls: 'real', en: 'Real · timetable', ja: '実データ・時刻表' },
  check: { cls: 'mixed', en: 'Real · licence to confirm', ja: '実データ・利用許諾確認中' },
  research_only: { cls: 'mixed', en: 'Research timetable', ja: '研究用時刻表' },
} as const

const todayIso = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

/**
 * "Getting here" card in the node drawer: how to reach the node by public
 * transport, from transport.json. Scheduled times, not live.
 */
export function AccessCard({ data, nodeId, hubName }: { data: TransportFile; nodeId: string; hubName: [string, string] }) {
  const { t: tr, lang } = useLang()
  const [day, setDay] = useState<DayType>(() => dayTypeOf(new Date(`${todayIso()}T12:00:00`), (d) => isHoliday(d.toISOString().slice(0, 10))))
  const node = data.nodes[nodeId]
  if (!node) return null
  const d = node.days[day]
  const isHub = nodeId === data.hub
  const sources = sourcesFor(data, node)
  const status = STATUS_BADGE[worstStatus(sources)]
  const hub = tr(hubName[0], hubName[1])
  const back = d?.to_hub
  const early = back ? (clockMinutes(back.leave) ?? 9999) <= EARLY_LAST_RETURN_MIN : false
  const modes = Object.entries(d?.departures_by_mode ?? {}) as [keyof typeof MODE_LABEL, number][]
  const nearest = node.stops?.slice().sort((a, b) => a.distance_m - b.distance_m)[0]
  const caveats = sources.filter((s) => s.caveat)
  const noRail = !data.sources.some((s) => s.mode === 'rail')

  return (
    <>
      <h3 className="drawer-h">
        {tr('Getting here', 'アクセス')}{' '}
        <span className={`src-badge ${status.cls}`} title={tr(data.note, data.note)}>
          <span className="src-dot" aria-hidden="true"></span>
          {tr(status.en, status.ja)}
        </span>
      </h3>
      <div className="access-days" role="tablist" aria-label={tr('Day type', '曜日区分')}>
        {(Object.keys(DAY_LABEL) as DayType[]).map((k) => (
          <button key={k} role="tab" aria-selected={day === k} onClick={() => setDay(k)}>
            {tr(...DAY_LABEL[k])}
          </button>
        ))}
      </div>

      {noRail && !isHub && (
        <p className="access-expired">
          <Icon name="alert" size={12} />{' '}
          {tr(
            'Buses only: Echizen Railway and Fukui Railway have no open timetable, so trips that would use the train show the slower bus-only route.',
            'バスのみ：えちぜん鉄道・福井鉄道にはオープンな時刻表がないため、鉄道を使う移動はバスのみの遅い経路で表示。',
          )}
        </p>
      )}

      {!d || d.departures === 0 ? (
        <div className="banner banner-warn small">
          <Icon name="car" size={14} />{' '}
          {tr('No scheduled bus or train serves this site on this day: car only.', 'この日は路線バス・鉄道の運行なし：車のみ。')}
        </div>
      ) : (
        early &&
        back && (
          <div className="banner banner-warn small">
            <Icon name="car" size={14} />{' '}
            {tr(
              `The last bus or train back to ${hub} leaves at ${clockLabel(back.leave)}. After that, car only.`,
              `${hub}へ戻る最終のバス・鉄道は${clockLabel(back.leave)}発。それ以降は車のみ。`,
            )}
          </div>
        )
      )}

      {d && d.departures > 0 && (
        <ul className="road-list access-list">
          <li className="kv">
            <span>{tr('Departures per day, any direction', '1日の出発本数（全方向）')}</span>
            <span className="kv-v">
              <span className="num">{d.departures}</span>{' '}
              {modes.map(([m, n]) => (
                <span key={m} className="mode-chip" style={{ borderColor: MODE_COLOUR[m] }}>
                  {tr(...MODE_LABEL[m])} {n}
                </span>
              ))}
            </span>
          </li>
          <li className="kv">
            <span>{tr('First / last departure, any direction', '始発 / 最終（全方向）')}</span>
            <span className="kv-v num">
              {clockLabel(d.first_departure)} – {clockLabel(d.last_departure)}
            </span>
          </li>
          {!isHub && (
            <li className="kv">
              <span>{tr(`Quickest trip from ${hub}`, `${hub}からの最短`)}</span>
              <span className="kv-v">
                {d.from_hub ? (
                  <>
                    <span className="num">{fmtMinutes(d.from_hub.fastest_min, lang)}</span>{' '}
                    <span className="muted small">
                      {tr(`${clockLabel(d.from_hub.fastest.depart)} → ${clockLabel(d.from_hub.fastest.arrive)}`, `${clockLabel(d.from_hub.fastest.depart)}発 → ${clockLabel(d.from_hub.fastest.arrive)}着`)}
                    </span>
                  </>
                ) : (
                  <span className="muted small">{tr(`no open timetable links it to ${hub}`, `${hub}とつながるオープンな時刻表なし`)}</span>
                )}
              </span>
            </li>
          )}
          {!isHub && d.from_hub?.after_0900 && (
            <li className="kv">
              <span>{tr('First trip leaving after 09:00', '9時以降の最初の便')}</span>
              <span className="kv-v">
                <span className="num">{clockLabel(d.from_hub.after_0900.depart)} → {clockLabel(d.from_hub.after_0900.arrive)}</span>{' '}
                <span className="muted small">{fmtMinutes(d.from_hub.after_0900.minutes, lang)}</span>
              </span>
            </li>
          )}
          {!isHub && (
            <li className="kv">
              <span>{tr(`Last bus or train back to ${hub}`, `${hub}へ戻る最終便`)}</span>
              <span className="kv-v">
                {back ? (
                  <>
                    <span className={`num${early ? ' warn-text' : ''}`}>{clockLabel(back.leave)}</span>{' '}
                    <span className="muted small">{tr(`arrive ${clockLabel(back.arrive_hub)} (${fmtMinutes(back.minutes, lang)})`, `${clockLabel(back.arrive_hub)}着（${fmtMinutes(back.minutes, lang)}）`)}</span>
                  </>
                ) : (
                  <span className="muted small">{tr(`no open timetable links it to ${hub}`, `${hub}とつながるオープンな時刻表なし`)}</span>
                )}
              </span>
            </li>
          )}
          {nearest && (
            <li className="kv">
              <span>{tr('Nearest stop', '最寄りの停留所・駅')}</span>
              <span className="kv-v">
                {lang === 'ja' ? nearest.name : placeEn(nearest.name)} <span className="muted small">{tr(`+ ${nearest.walk_min} min walk to the site`, `地点まで徒歩${nearest.walk_min}分`)}</span>
              </span>
            </li>
          )}
        </ul>
      )}

      {d && !isHub && (d.from_hub?.after_0900 || back) && (
        <details className="itin-more access-itins">
          <summary>{tr('Show the routes', '経路を表示')}</summary>
          {d.from_hub?.after_0900 && (
            <>
              <div className="eyebrow">{tr('Going: first trip after 09:00', '行き：9時以降の最初の便')}</div>
              <Itinerary legs={d.from_hub.after_0900.legs} />
            </>
          )}
          {back && (
            <>
              <div className="eyebrow">{tr('Coming back: the last trip', '帰り：最終便')}</div>
              <Itinerary legs={back.legs} />
            </>
          )}
        </details>
      )}

      <ul className="road-list access-list">
        {Object.entries(d?.from_far ?? {}).map(([id, f]) => (
          <li key={id} className="kv" title={f.basis}>
            <span>{tr(`From ${f.name}`, `${f.name_ja}から`)}</span>
            <span className="kv-v">
              <span className="num">{f.minutes != null ? `≈ ${fmtMinutes(f.minutes, lang)}` : '—'}</span>
              {f.minutes != null && f.via && <span className="muted small">{tr(`via ${f.via}`, `${f.via_ja}経由`)}</span>}{' '}
              <span className="tt-demo">{tr('Estimated', '推計')}</span>
            </span>
          </li>
        ))}
        <li className="kv">
          <span>{tr('How visitors arrive (mode share)', '来訪手段の割合')}</span>
          <span className="kv-v muted small">{tr('[pending] Survey v2 question', '[pending] アンケートv2の設問')}</span>
        </li>
      </ul>

      {node.note && <p className="muted small access-note">{tr(node.note, node.note_ja ?? node.note)}</p>}
      <p className="muted small access-note">
        {tr('Timetables: ', '時刻表：')}
        {sources.map((s, i) => (
          <span key={s.id}>
            {i > 0 && ', '}
            <a href={s.page} target="_blank" rel="noreferrer">
              {tr(s.name, s.name_ja)}
            </a>
          </span>
        ))}
        {'. '}
        {caveats.map((s) => (
          <span key={s.id}>{tr(s.caveat ?? '', s.caveat_ja ?? s.caveat ?? '')} </span>
        ))}
      </p>
    </>
  )
}
