import { useEffect } from 'react'
import { LEVEL, dayRadius } from '../../../lib/briefing'
import type { DayFigure } from '../../../lib/briefing'
import type { MapNode } from '../../../lib/nodes'
import { PresenceCanvas } from '../canvas/PresenceCanvas'
import { useLeafletLayer } from '../canvas/useLeafletLayer'

/** Visitors a figure stands for. */
export const PER_DOT = 100
const MAX_DOTS = 40
const NEUTRAL = '#7a8aa6'

/**
 * People flow: small figures walking in to and out of each site, from the day's visitor figure
 * (estimated, or forecast for later days). Sites without a visitor number (Fukui Station's
 * camera busyness, or no figure yet) get no dots.
 */
export function PeopleFlowLayer({ nodes, figures }: { nodes: MapNode[]; figures: Record<string, DayFigure> }) {
  const canvas = useLeafletLayer(() => new PresenceCanvas())
  useEffect(() => {
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
          },
        ]
      }),
    )
  }, [canvas, nodes, figures])
  return null
}
