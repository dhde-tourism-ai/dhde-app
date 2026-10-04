import { CircleMarker, Pane } from 'react-leaflet'
import type { MapNode } from '../../../lib/nodes'

const ACCENT = '#8b9dff'

interface Props {
  nodes: MapNode[]
  selectedId?: string
  onSelect: (id: string | undefined) => void
}

/**
 * The six priority sites as plain, clickable markers with their names, for when the People
 * layer is off (no layers are on by default), so the map is never empty and a
 * site can always be opened. The name is on the site's card (SiteCards.tsx).
 */
export function SiteMarkers({ nodes, selectedId, onSelect }: Props) {
  return (
    <Pane name="dhde-sites" style={{ zIndex: 500 }}>
      {nodes.map((n) => {
        const selected = n.id === selectedId
        const click = { click: () => onSelect(selected ? undefined : n.id) }
        return (
          <CircleMarker
            key={n.id}
            center={[n.lat, n.lon]}
            radius={6}
            eventHandlers={click}
            pathOptions={{ color: selected ? ACCENT : '#c9d4ff', weight: selected ? 2.5 : 1.8, fillColor: '#0a1120', fillOpacity: 0.85 }}
          />
        )
      })}
    </Pane>
  )
}
