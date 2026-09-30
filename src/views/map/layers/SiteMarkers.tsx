import { useMemo } from 'react'
import { CircleMarker, Marker, Pane } from 'react-leaflet'
import L from 'leaflet'
import type { MapNode } from '../../../lib/nodes'
import { escapeHtml } from '../../../lib/live'
import { useLang } from '../../../lib/i18n'

const ACCENT = '#8b9dff'

interface Props {
  nodes: MapNode[]
  selectedId?: string
  onSelect: (id: string | undefined) => void
}

/**
 * The six priority sites as plain, clickable markers with their names, for when the People
 * layer is off (no layers are on by default), so the map is never empty and a
 * site can always be opened. No numbers: those belong to the layers.
 */
export function SiteMarkers({ nodes, selectedId, onSelect }: Props) {
  const { lang } = useLang()
  const labels = useMemo(() => {
    const out: Record<string, L.DivIcon> = {}
    for (const n of nodes) {
      const name = escapeHtml(lang === 'ja' ? n.name_ja : n.name.replace(' East Entrance', ''))
      out[n.id] = L.divIcon({
        className: 'map-divicon',
        html: `<div class="node-tag dir-${n.label_dir ?? 'right'}${n.id === selectedId ? ' sel' : ''}" style="--r:11px"><span class="nt-name">${name}</span></div>`,
        iconSize: [0, 0],
      })
    }
    return out
  }, [nodes, selectedId, lang])

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
      {nodes.map((n) => (
        <Marker key={`lbl-${n.id}`} position={[n.lat, n.lon]} icon={labels[n.id]} eventHandlers={{ click: () => onSelect(n.id === selectedId ? undefined : n.id) }} keyboard={false} />
      ))}
    </Pane>
  )
}
