import { Fragment, useMemo } from 'react'
import { Marker, Polyline, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { RoutesFile } from '../../../types/routes'
import type { Nudge } from '../../../lib/nudges'
import { LOOP_LABEL, PRIORITY, priorityOf } from '../../../lib/nudges'
import { routeById, reversePath } from '../../../lib/routes'
import { escapeHtml } from '../../../lib/live'
import { iconSvg } from '../../../lib/icons'
import { useLang } from '../../../lib/i18n'

const ROUTE_COLOUR = '#3fd8c4'

/** Map annotations for the action nudges on the selected day: a flag per nudge and the suggested route for weather-route nudges. */
export function NudgeLayer({ nudges, routes, day, activeId, onPick }: { nudges: Nudge[]; routes: RoutesFile | null; day: number; activeId?: string; onPick: (n: Nudge) => void }) {
  const { t, lang } = useLang()
  const today = nudges.filter((n) => n.day === day)

  // One flag per location: stack the count, colour by the most urgent.
  const groups = useMemo(() => {
    const m = new Map<string, Nudge[]>()
    for (const n of today) {
      const k = n.focus.join(',')
      m.set(k, [...(m.get(k) ?? []), n])
    }
    return [...m.values()]
  }, [today])

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
                <Tooltip sticky className="map-tip">
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
      {groups.map((g) => {
        const top = g[0]
        const worst = [...g].sort((a, b) => ({ crit: 3, serious: 2, warn: 1, info: 0 })[b.sev] - ({ crit: 3, serious: 2, warn: 1, info: 0 })[a.sev])[0]
        const active = g.some((n) => n.id === activeId)
        const icon = L.divIcon({
          className: 'map-divicon',
          html: `<div class="nudge-flag${active ? ' on' : ''}" style="--c:${PRIORITY[priorityOf(worst.sev)].colour}">${iconSvg('flag', 13)}<span class="num">${g.length}</span></div>`,
          iconSize: [0, 0],
        })
        return (
          <Marker key={top.focus.join(',')} position={top.focus} icon={icon} eventHandlers={{ click: () => onPick(worst) }} zIndexOffset={500}>
            <Tooltip className="map-tip wide" direction="top" offset={[-12, -34]}>
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
