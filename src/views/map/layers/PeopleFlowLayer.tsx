import { useEffect } from 'react'
import { LEVEL, dayRadius } from '../../../lib/briefing'
import type { DayFigure } from '../../../lib/briefing'
import type { MapNode } from '../../../lib/nodes'
import { PresenceCanvas } from '../canvas/PresenceCanvas'
import { useLeafletLayer } from '../canvas/useLeafletLayer'

/** Visitors a dot stands for. */
export const PER_DOT = 100
const MAX_DOTS = 40
const NEUTRAL = '#7a8aa6'
/** Sites on the coast or a lake shore: people come and go on the land side only (towards the hub). */
const COASTAL = new Set(['tojinbo', 'awara_onsen', 'rainbow_line'])
const HUB = 'fukui_station'

/**
 * People flow: coloured dots moving in to and out of each site, from the day's visitor figure
 * (estimated, or forecast for later days). Sites without a visitor number (Fukui Station's
 * camera busyness, or no figure yet) get no dots.
 */
export function PeopleFlowLayer({ nodes, figures }: { nodes: MapNode[]; figures: Record<string, DayFigure> }) {
  const canvas = useLeafletLayer(() => new PresenceCanvas())
  useEffect(() => {
    const hub = nodes.find((n) => n.id === HUB)
    canvas.setData(
      nodes.flatMap((n) => {
        const f = figures[n.id]
        if (!f || f.value === null || f.busyness) return []
        return [
          {
            lat: n.lat,
            lon: n.lon,
            dots: Math.min(MAX_DOTS, Math.max(3, Math.round(f.value / PER_DOT))),
            colour: f.level ? LEVEL[f.level].colour : NEUTRAL,
            inner: dayRadius(f.value) + 3,
            toward: COASTAL.has(n.id) && hub ? ([hub.lat, hub.lon] as [number, number]) : null,
          },
        ]
      }),
    )
  }, [canvas, nodes, figures])
  return null
}
