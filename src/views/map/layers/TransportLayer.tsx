import { CircleMarker, Pane, Polygon, Polyline } from 'react-leaflet'
import type { TransportMapFile } from '../../../types/transport'
import { MODE_COLOUR, MODE_LABEL } from '../../../lib/transport'
import { useLang } from '../../../lib/i18n'
import { Tip } from './Tip'

const WALK_STYLE: Record<string, { color: string; fillOpacity: number; dashArray?: string }> = {
  '15': { color: '#6fdc93', fillOpacity: 0.16 },
  '30': { color: '#6fdc93', fillOpacity: 0.06, dashArray: '4 6' },
}

/**
 * Bus and rail lines serving the six nodes, their stops, and 15/30-minute
 * walking areas around each node (transport_map.json). Lines come from the
 * operators' GTFS shapes where published, otherwise the stop sequence.
 */
export function TransportLayer({ data }: { data: TransportMapFile }) {
  const { t: tr } = useLang()
  const walk = data.walk_areas
  return (
    <>
      <Pane name="dhde-transport-walk" style={{ zIndex: 410 }}>
        {walk &&
          Object.entries(walk.nodes).flatMap(([node, rings]) =>
            Object.entries(rings)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([min, ring]) => (
                <Polygon key={`${node}-${min}`} positions={ring} interactive={false}
                  pathOptions={{ ...(WALK_STYLE[min] ?? WALK_STYLE['30']), weight: 1, fillColor: '#6fdc93' }} />
              )),
          )}
      </Pane>
      <Pane name="dhde-transport-lines" style={{ zIndex: 430 }}>
        {data.lines.map((l) => (
          <Polyline key={l.id} positions={l.path}
            pathOptions={{ color: l.mode === 'rail' ? (l.colour ?? MODE_COLOUR.rail) : MODE_COLOUR.bus, weight: l.mode === 'rail' ? 3.5 : 2.2, opacity: 0.85 }}>
            <Tip sticky>
              <strong>{l.name}</strong>
              <div className="tip-sub">{tr(...MODE_LABEL[l.mode])}</div>
            </Tip>
          </Polyline>
        ))}
      </Pane>
      <Pane name="dhde-transport-stops" style={{ zIndex: 460 }}>
        {data.stops.map((s) => (
          <CircleMarker key={s.id} center={[s.lat, s.lon]} radius={3.5}
            pathOptions={{ color: '#0a1120', weight: 1.2, fillColor: '#e9eef8', fillOpacity: 0.95 }}>
            <Tip>
              <strong>{s.name}</strong>
            </Tip>
          </CircleMarker>
        ))}
      </Pane>
    </>
  )
}
