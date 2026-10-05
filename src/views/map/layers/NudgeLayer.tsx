import { Fragment, useMemo } from 'react'
import { Marker, Polyline, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { RoutesFile } from '../../../types/routes'
import type { Nudge } from '../../../lib/nudges'
import { LOOP_LABEL, PRIORITY, priorityOf } from '../../../lib/nudges'
import { routeById, reversePath } from '../../../lib/routes'
import { dayLabel, escapeHtml } from '../../../lib/live'
import type { LiveData } from '../../../types/live'
import { iconSvg } from '../../../lib/icons'
import { useLang } from '../../../lib/i18n'

const ROUTE_COLOUR = '#3fd8c4'
/** How many days after the selected one an upcoming flag looks ahead. */
const AHEAD_DAYS = 6

const SEV_ORDER = { crit: 3, serious: 2, warn: 1, info: 0 } as const
const worstOf = (g: Nudge[]) => [...g].sort((a, b) => SEV_ORDER[b.sev] - SEV_ORDER[a.sev])[0]

/**
 * Map annotations for the action nudges: a flag per location for the selected day, the suggested
 * route for weather-route nudges, and a smaller dated flag where the next action is later in the
 * week, so the map is never empty on a quiet day. Clicking an upcoming flag jumps to its day.
 */
export function NudgeLayer({ nudges, routes, day, live, activeId, onPick }: { nudges: Nudge[]; routes: RoutesFile | null; day: number; live: LiveData | null; activeId?: string; onPick: (n: Nudge) => void }) {
  const { t, lang } = useLang()
  const today = useMemo(() => nudges.filter((n) => n.day === day), [nudges, day])

  // One flag per location: stack the count, colour by the most urgent.
  const groups = useMemo(() => {
    const m = new Map<string, Nudge[]>()
    for (const n of today) {
      const k = n.focus.join(',')
      m.set(k, [...(m.get(k) ?? []), n])
    }
    return [...m.values()]
  }, [today])

  // Locations with nothing on the selected day: the week ahead's most urgent day there (the
  // soonest on a tie), so a High-priority warning on Wednesday beats a Low one on Monday.
  const upcoming = useMemo(() => {
    const taken = new Set(today.map((n) => n.focus.join(',')))
    const byPlaceDay = new Map<string, Map<number, Nudge[]>>()
    for (const n of nudges) {
      if (n.day <= day || n.day > day + AHEAD_DAYS) continue
      const k = n.focus.join(',')
      if (taken.has(k)) continue
      const days = byPlaceDay.get(k) ?? new Map<number, Nudge[]>()
      days.set(n.day, [...(days.get(n.day) ?? []), n])
      byPlaceDay.set(k, days)
    }
    return [...byPlaceDay.values()].map((days) =>
      [...days.values()].sort((a, b) => SEV_ORDER[worstOf(b).sev] - SEV_ORDER[worstOf(a).sev] || a[0].day - b[0].day)[0],
    )
  }, [nudges, today, day])

  return (
    <>
      {today
        .filter((n) => n.route)
        .map((n) => {
          const legs = n.route!.map((l) => {
            const r = routeById(routes, l.id)
            return r ? (l.reverse ? reversePath(r.path) : r.path) : []
          })
          const path = legs.flat()
          if (path.length < 2) return null
          const mid = path[Math.floor(path.length * 0.62)]
          return (
            <Fragment key={`r-${n.id}`}>
              <Polyline positions={path} pathOptions={{ color: '#0a1120', weight: 8, opacity: 0.55, lineCap: 'round' }} interactive={false} />
              <Polyline positions={path} pathOptions={{ color: ROUTE_COLOUR, weight: 4, opacity: 0.95, dashArray: '10 8', lineCap: 'round' }}>
                <Tooltip pane="tooltipPane" sticky className="map-tip">
                  <strong>{t(n.route_label_en ?? '', n.route_label_ja)}</strong>
                  <div className="tip-row">{t(n.action_en, n.action_ja)}</div>
                </Tooltip>
              </Polyline>
              <Marker
                position={mid}
                interactive={false}
                icon={L.divIcon({ className: 'map-divicon', html: `<div class="route-flag nudge-route">${escapeHtml(lang === 'ja' ? (n.route_label_ja ?? '') : (n.route_label_en ?? ''))}</div>`, iconSize: [0, 0] })}
              />
            </Fragment>
          )
        })}
      {upcoming.map((g) => {
        const worst = worstOf(g)
        const when = live ? dayLabel(live, g[0].day, lang, true) : ''
        const icon = L.divIcon({
          className: 'map-divicon',
          html: `<div class="nudge-flag ahead" style="--c:${PRIORITY[priorityOf(worst.sev)].colour}">${iconSvg('flag', 11)}<span class="when">${escapeHtml(when)}</span></div>`,
          iconSize: [0, 0],
        })
        return (
          <Marker key={`a-${g[0].focus.join(',')}`} position={g[0].focus} icon={icon} eventHandlers={{ click: () => onPick(worst) }} zIndexOffset={400}>
            <Tooltip pane="tooltipPane" className="map-tip wide" direction="top" offset={[-12, -30]}>
              <div className="tip-row">{t(`Coming up ${when}: click to jump there`, `${when}の予定：クリックで表示`)}</div>
              {g.map((n) => (
                <div key={n.id} className="tt-nudge">
                  <div className="tt-nudge-h">
                    <i style={{ background: PRIORITY[priorityOf(n.sev)].colour }}></i>
                    {t(PRIORITY[priorityOf(n.sev)].en, PRIORITY[priorityOf(n.sev)].ja)} · {t(LOOP_LABEL[n.loop].en, LOOP_LABEL[n.loop].ja)}
                  </div>
                  <div className="tt-nudge-t">{t(n.title_en, n.title_ja)}</div>
                </div>
              ))}
            </Tooltip>
          </Marker>
        )
      })}
      {groups.map((g) => {
        const top = g[0]
        const worst = worstOf(g)
        const active = g.some((n) => n.id === activeId)
        const icon = L.divIcon({
          className: 'map-divicon',
          html: `<div class="nudge-flag${active ? ' on' : ''}" style="--c:${PRIORITY[priorityOf(worst.sev)].colour}">${iconSvg('flag', 13)}<span class="num">${g.length}</span></div>`,
          iconSize: [0, 0],
        })
        return (
          <Marker key={top.focus.join(',')} position={top.focus} icon={icon} eventHandlers={{ click: () => onPick(worst) }} zIndexOffset={500}>
            <Tooltip pane="tooltipPane" className="map-tip wide" direction="top" offset={[-12, -34]}>
              {g.map((n) => (
                <div key={n.id} className="tt-nudge">
                  <div className="tt-nudge-h">
                    <i style={{ background: PRIORITY[priorityOf(n.sev)].colour }}></i>
                    {t(PRIORITY[priorityOf(n.sev)].en, PRIORITY[priorityOf(n.sev)].ja)} · {t(LOOP_LABEL[n.loop].en, LOOP_LABEL[n.loop].ja)}
                  </div>
                  <div className="tt-nudge-t">{t(n.title_en, n.title_ja)}</div>
                  <div className="tip-row">{t(n.action_en, n.action_ja)}</div>
                </div>
              ))}
            </Tooltip>
          </Marker>
        )
      })}
    </>
  )
}
