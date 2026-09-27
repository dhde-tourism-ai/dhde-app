import { useState } from 'react'
import { Circle, CircleMarker, Polyline, Tooltip, useMapEvents } from 'react-leaflet'
import type { EconomicsFigures, Metric, RegionalEconomics } from '../../../types/economics'
import { fmtMetric } from '../../../lib/format'
import { fmtLost, resolvePoint, sameNode } from '../../../lib/economics'
import type { MapNode } from '../../../lib/nodes'

const STATUS_STROKE: Record<Metric['status'], string> = {
  real: '#3dbb6e',
  modelled: '#5b9cf0',
  illustrative: '#e0a33a',
  pending: '#8a94a6',
}

function FiguresTooltip({ title, titleJa, f }: { title: string; titleJa: string; f: EconomicsFigures }) {
  const o = f.opportunity_lost_yen
  return (
    <div className="econ-tip">
      <strong>{title}</strong> <span className="ja">{titleJa}</span>
      <div>Visitors: {fmtMetric(f.visitors)} <em>({f.visitors.status})</em></div>
      <div>Revenue: {fmtMetric(f.revenue_yen, 'yen')} <em>({f.revenue_yen.status})</em></div>
      <div>
        Opportunity lost: {fmtLost(f)}
        <div className="econ-tip-sub">
          overnight gap {fmtMetric(o.overnight_gap, 'yen')} · weather {fmtMetric(o.weather, 'yen')} · idle rooms {fmtMetric(o.idle_rooms, 'yen')}
        </div>
      </div>
    </div>
  )
}

/**
 * Economics overlay: municipality circles sized by revenue, node annotations
 * and dashed visitor-flow lines. Null values are drawn as grey dashed shapes
 * and labelled "[pending]"; nothing is sized from a missing number.
 */
export function EconomicsLayer({ economics, nodes, selectedId }: { economics: RegionalEconomics; nodes: MapNode[]; selectedId?: string }) {
  // Annotations are permanent when zoomed in (or for the selected node); at
  // prefecture zoom the close northern nodes would overlap, so they show on hover.
  const [zoom, setZoom] = useState<number | null>(null)
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const zoomedIn = (zoom ?? map.getZoom()) >= 11
  const maxRevenue = Math.max(1, ...economics.regions.map((r) => r.revenue_yen.value ?? 0))
  const maxFlow = Math.max(1, ...economics.flows.map((f) => f.visitors.value ?? 0))

  return (
    <>
      {economics.regions.map((r) => {
        const v = r.revenue_yen.value
        const radius = v === null ? 2500 : 2500 + 9000 * Math.sqrt(v / maxRevenue)
        return (
          <Circle
            key={`region-${r.id}`}
            center={r.centroid}
            radius={radius}
            pathOptions={{
              color: STATUS_STROKE[r.revenue_yen.status],
              weight: 1.5,
              dashArray: r.revenue_yen.status === 'real' ? undefined : '5,4',
              fillColor: v === null ? '#8a94a6' : '#e0a33a',
              fillOpacity: v === null ? 0.08 : 0.16,
            }}
          >
            <Tooltip sticky className="map-tip">
              <FiguresTooltip title={r.name} titleJa={r.name_ja} f={r} />
              {economics.visitor_window?.regions && (
                <div className="econ-tip-sub">Visitors: JTA, {economics.visitor_window.regions}</div>
              )}
            </Tooltip>
          </Circle>
        )
      })}

      {economics.flows.map((f, i) => {
        const a = resolvePoint(economics, nodes, f.from, f.from_coord)
        const b = resolvePoint(economics, nodes, f.to, f.to_coord)
        if (!a || !b) return null
        const v = f.visitors.value
        return (
          <Polyline
            key={`flow-${i}`}
            positions={[a.latlng, b.latlng]}
            pathOptions={{
              color: v === null ? '#8a94a6' : '#c9d4ff',
              weight: v === null ? 1.5 : 1.5 + 4 * Math.sqrt(v / maxFlow),
              dashArray: '6,8',
              opacity: 0.8,
            }}
          >
            <Tooltip sticky className="map-tip">
              <div className="econ-tip">
                <strong>
                  {a.name} → {b.name}
                </strong>
                <div>Visitors: {fmtMetric(f.visitors)} <em>({f.status})</em></div>
                <div className="econ-tip-sub">{f.note}</div>
              </div>
            </Tooltip>
          </Polyline>
        )
      })}

      {economics.nodes
        .filter((n) => n.priority !== false)
        .map((n) => {
          const reg = nodes.find((r) => sameNode(r, n))
          const permanent = zoomedIn || (reg !== undefined && reg.id === selectedId)
          return (
            <CircleMarker
              key={`econ-node-${n.id}-${permanent ? 'p' : 'h'}`}
              center={reg ? [reg.lat, reg.lon] : [n.lat, n.lon]}
              radius={14}
              pathOptions={{ stroke: false, fillOpacity: 0 }}
            >
              <Tooltip permanent={permanent} direction="bottom" offset={[0, 12]} className="econ-note map-tip">
                {n.name}: {fmtMetric(n.visitors)} visitors · {fmtMetric(n.revenue_yen, 'yen')} · lost {fmtLost(n)}
              </Tooltip>
            </CircleMarker>
          )
        })}
    </>
  )
}
