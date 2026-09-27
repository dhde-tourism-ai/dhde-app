import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, LayerGroup, LayersControl, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { DashboardData } from '../../types/dashboard'
import type { NodeRegistry, Prefecture } from '../../types/nodes'
import type { RegionalEconomics } from '../../types/economics'
import { buildMapNodes, congestionTier, isEstimatedMeasure, latestReading } from '../../lib/nodes'
import type { MapNode } from '../../lib/nodes'
import { EconomicsLayer } from './EconomicsLayer'
import { econCaveats } from '../../lib/economics'
import { MapLegend } from './MapLegend'
import { NodePanel } from './NodePanel'

const FALLBACK_BOUNDS: Prefecture['bounds'] = [[35.3, 135.35], [36.65, 137.05]]

/** Marker radius from a 0-100 index (same curve as the demo map). */
function radiusFor(index: number): number {
  return 7 + Math.sqrt(Math.max(index, 1)) * 2.0
}

const LABEL_OFFSET: Record<'left' | 'right' | 'top' | 'bottom', [number, number]> = {
  left: [-10, 0],
  right: [10, 0],
  top: [0, -10],
  bottom: [0, 10],
}

function FitBounds({ bounds }: { bounds: Prefecture['bounds'] }) {
  const map = useMap()
  useEffect(() => {
    // The container can still be settling (lazy chunk, banners above it), so
    // re-measure before fitting.
    const t = window.setTimeout(() => {
      map.invalidateSize()
      map.fitBounds(bounds, { padding: [8, 8] })
    }, 60)
    return () => window.clearTimeout(t)
  }, [map, bounds])
  return null
}

interface MapViewProps {
  registry: NodeRegistry | null
  dashboard: DashboardData | null
  economics: RegionalEconomics | null
  economicsError: Error | null
  selectedId?: string
  onSelect: (id: string | undefined) => void
  onOpenNode: (id: string) => void
}

export default function MapView({ registry, dashboard, economics, economicsError, selectedId, onSelect, onOpenNode }: MapViewProps) {
  const [prefecture, setPrefecture] = useState('fukui')
  const [showSecondary, setShowSecondary] = useState(false)
  // ?layer=economics opens the map with the economics layer on (shareable link).
  const [showEconomics, setShowEconomics] = useState(() => new URLSearchParams(window.location.search).get('layer') === 'economics')

  const allNodes = useMemo(() => buildMapNodes(registry, dashboard), [registry, dashboard])
  const prefectures = registry?.prefectures ?? []
  const bounds = prefectures.find((p) => p.id === prefecture)?.bounds ?? FALLBACK_BOUNDS
  const visible = allNodes.filter((n) => n.prefecture === prefecture && (n.priority || showSecondary || n.id === selectedId))
  const selected = allNodes.find((n) => n.id === selectedId)

  return (
    <section className="map-wrap">
      <div className="map-toolbar">
        <div className="seg" role="group" aria-label="Prefecture">
          {prefectures.map((p) => (
            <button key={p.id} className={`seg-btn ${prefecture === p.id ? 'active' : ''}`} onClick={() => setPrefecture(p.id)}>
              {p.name} <span className="ja">{p.name_ja}</span>
            </button>
          ))}
        </div>
        <label className="toggle">
          <input type="checkbox" checked={showSecondary} onChange={(e) => setShowSecondary(e.target.checked)} />
          Show all nodes
        </label>
        <label className="toggle">
          <input type="checkbox" checked={showEconomics} onChange={(e) => setShowEconomics(e.target.checked)} />
          Economics layer
        </label>
      </div>

      {showEconomics && economics?.sample && (
        <div className="sample-banner" role="status">
          <strong>Sample data.</strong> regional_economics.json is a placeholder in the agreed contract shape; every figure is illustrative or pending and must not be quoted.
        </div>
      )}
      {showEconomics &&
        economics &&
        econCaveats(economics).map((c) => (
          <div key={c} className="caveat-banner" role="note">
            <strong>Check before quoting:</strong> {c}
          </div>
        ))}
      {showEconomics && economicsError && (
        <div className="sample-banner">Economics layer unavailable: {economicsError.message}</div>
      )}

      <div className="map-layout">
        <div className="map-box">
          <MapContainer bounds={bounds} scrollWheelZoom className="leaflet-host" zoomControl>
            <FitBounds bounds={bounds} />
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Light grey (Esri)">
                <LayerGroup>
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                    attribution="&copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
                    maxZoom={16}
                  />
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                    maxZoom={16}
                  />
                </LayerGroup>
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="OpenStreetMap">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                  maxZoom={18}
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            {showEconomics && economics && <EconomicsLayer economics={economics} nodes={allNodes} selectedId={selectedId} />}

            {visible.map((n) => (
              <NodeMarker key={n.id} node={n} selected={n.id === selectedId} onSelect={onSelect} />
            ))}
          </MapContainer>
          <MapLegend showEconomics={showEconomics && Boolean(economics)} />
        </div>

        <NodePanel
          node={selected}
          nodes={visible}
          dashboard={dashboard}
          economics={showEconomics ? economics : null}
          onSelect={onSelect}
          onOpenNode={onOpenNode}
        />
      </div>
    </section>
  )
}

function NodeMarker({ node, selected, onSelect }: { node: MapNode; selected: boolean; onSelect: (id: string | undefined) => void }) {
  const reading = latestReading(node.live)
  const estimated = isEstimatedMeasure(node.measure ?? node.live?.measure, node.live)
  const handlers = { click: () => onSelect(selected ? undefined : node.id) }
  const dir = node.label_dir ?? 'right'
  const label = (
    <span>
      {node.name} <span className="ja">{node.name_ja}</span>
      {estimated && <span className="est-tag">est.</span>}
    </span>
  )
  const tooltip = (
    <Tooltip
      permanent={node.priority}
      sticky={!node.priority}
      direction={dir}
      offset={LABEL_OFFSET[dir]}
      className="node-label"
    >
      {label}
    </Tooltip>
  )

  if (!reading) {
    // No live feed yet: a small hollow grey marker so the node is placed but clearly not measured.
    return (
      <CircleMarker
        center={[node.lat, node.lon]}
        radius={6}
        pathOptions={{ color: selected ? '#12202C' : '#7a8595', weight: 2, dashArray: '2,3', fillColor: '#c3cad4', fillOpacity: 0.5 }}
        eventHandlers={handlers}
      >
        {tooltip}
      </CircleMarker>
    )
  }

  const tier = congestionTier(reading.congestionIndex)
  const rActual = radiusFor(reading.actualIndex)
  const rPred = radiusFor(reading.forecastIndex)
  return (
    <>
      {/* Predicted: dashed ring */}
      <CircleMarker
        center={[node.lat, node.lon]}
        radius={rPred}
        interactive={false}
        pathOptions={{ color: tier.colour, weight: 2, dashArray: '2,5', fillOpacity: 0, opacity: 0.85 }}
      />
      {selected && (
        <CircleMarker
          center={[node.lat, node.lon]}
          radius={Math.max(rActual, rPred) + 6}
          interactive={false}
          pathOptions={{ color: '#12202C', weight: 2.5, dashArray: '3,4', fillOpacity: 0 }}
        />
      )}
      {/* Actual: solid fill. Estimated (proxy / reservations) nodes get a paler fill and dashed outline. */}
      <CircleMarker
        center={[node.lat, node.lon]}
        radius={rActual}
        pathOptions={{
          color: estimated ? tier.colour : '#ffffff',
          weight: 2.5,
          dashArray: estimated ? '4,3' : undefined,
          fillColor: tier.colour,
          fillOpacity: estimated ? 0.4 : 0.92,
        }}
        eventHandlers={handlers}
      >
        {tooltip}
      </CircleMarker>
    </>
  )
}
