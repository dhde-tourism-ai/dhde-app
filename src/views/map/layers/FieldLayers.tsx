import { useEffect } from 'react'
import { FieldCanvas } from '../canvas/FieldCanvas'
import { useLeafletLayer } from '../canvas/useLeafletLayer'
import type { NodeFrame } from '../../../lib/live'
import type { MapNode } from '../../../lib/nodes'

/** Regional density: soft warm glow per node, sized and weighted by people on site; neighbours merge. */
export function DensityLayer({ nodes, frame }: { nodes: MapNode[]; frame: Record<string, NodeFrame> }) {
  const canvas = useLeafletLayer(() => new FieldCanvas('dhde-field', 350))
  useEffect(() => {
    canvas.setBlobs(
      nodes
        .filter((n) => frame[n.id] && !frame[n.id].noEstimate)
        .map((n) => {
          const f = frame[n.id]
          return {
            lat: n.lat,
            lon: n.lon,
            radius: 3500 + Math.sqrt(f.onSite) * 260,
            rgb: '236,131,90',
            alpha: Math.min(0.8, 0.25 + 0.5 * Math.min(1.1, f.load)),
          }
        }),
    )
  }, [canvas, nodes, frame])
  return null
}

/** Precipitation tint: blue cells around each node's JMA point, stronger with mm/h. */
export function PrecipLayer({ nodes, frame }: { nodes: MapNode[]; frame: Record<string, NodeFrame> }) {
  const canvas = useLeafletLayer(() => new FieldCanvas('dhde-precip', 360))
  useEffect(() => {
    canvas.setBlobs(
      nodes
        .filter((n) => frame[n.id] && (frame[n.id].weather.mm > 0.1 || frame[n.id].weather.pop >= 50))
        .map((n) => {
          const w = frame[n.id].weather
          return {
            lat: n.lat,
            lon: n.lon,
            radius: 11000 + w.mm * 700,
            rgb: w.mm >= 8 ? '120,170,255' : '70,140,230',
            alpha: Math.min(0.6, 0.12 + w.mm / 18 + w.pop / 500),
          }
        }),
    )
  }, [canvas, nodes, frame])
  return null
}
