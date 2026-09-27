import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, useMap, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '../../styles/map.css'
import type { DashboardData } from '../../types/dashboard'
import type { NodeRegistry } from '../../types/nodes'
import type { RegionalEconomics } from '../../types/economics'
import type { LiveData } from '../../types/live'
import type { RoutesFile } from '../../types/routes'
import { buildMapNodes } from '../../lib/nodes'
import { frameAt, timeLabel } from '../../lib/live'
import { computeAlerts, SEV_COLOUR, topAlert } from '../../lib/alerts'
import { useLang } from '../../lib/i18n'
import { Icon } from '../../components/icons'
import { DemoBadge } from '../../components/DemoBadge'
import { DEFAULT_LAYERS, readUrlState } from './layers'
import type { BasemapId, LayerId } from './layers'
import { PeopleLayer } from './layers/PeopleLayer'
import { FlowLayer } from './layers/FlowLayer'
import { TrafficLayer } from './layers/TrafficLayer'
import { WeatherLayer } from './layers/WeatherLayer'
import { SentimentLayer } from './layers/SentimentLayer'
import { DensityLayer } from './layers/FieldLayers'
import { EconomicsLayer } from './layers/EconomicsLayer'
import { LayersPanel } from './panels/LayersPanel'
import { AlertsPanel } from './panels/AlertsPanel'
import { NodeDrawer } from './panels/NodeDrawer'
import { Timeline } from './panels/Timeline'

/** Fukui's six priority nodes; the Kanazawa inflow enters from the top edge. */
const VIEW_BOUNDS: [[number, number], [number, number]] = [
  [35.57, 135.84],
  [36.3, 136.56],
]

function useIsNarrow() {
  const q = '(max-width: 720px)'
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return narrow
}

function FitView({ narrow }: { narrow: boolean }) {
  const map = useMap()
  useEffect(() => {
    const id = window.setTimeout(() => {
      map.invalidateSize()
      map.fitBounds(VIEW_BOUNDS, narrow ? { paddingTopLeft: [8, 8], paddingBottomRight: [8, 150] } : { paddingTopLeft: [330, 64], paddingBottomRight: [420, 96] })
    }, 50)
    return () => window.clearTimeout(id)
  }, [map, narrow])
  return null
}

const ESRI_ATTR = 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community · Labels &copy; Esri'

function Basemap({ id }: { id: BasemapId }) {
  if (id === 'dark') {
    // CARTO dark matter now returns "API key required" tiles without a key, so the dark
    // basemap is Esri's key-free Dark Gray Canvas (base + labels).
    return (
      <>
        <TileLayer
          key="dark"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
          maxZoom={16}
        />
        <TileLayer key="dark-ref" url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" maxZoom={16} />
      </>
    )
  }
  if (id === 'streets') {
    return (
      <TileLayer
        key="streets"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
        className="tiles-streets"
      />
    )
  }
  return (
    <>
      <TileLayer key="img" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution={ESRI_ATTR} maxZoom={18} className="tiles-imagery" />
      <TileLayer key="roads" url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}" maxZoom={18} opacity={0.55} />
      <TileLayer key="ref" url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" maxZoom={18} />
    </>
  )
}

interface MapViewProps {
  registry: NodeRegistry | null
  dashboard: DashboardData | null
  economics: RegionalEconomics | null
  economicsError: Error | null
  live: LiveData | null
  liveError: Error | null
  routes: RoutesFile | null
  selectedId?: string
  onSelect: (id: string | undefined) => void
  onOpenNode: (id: string) => void
}

export default function MapView({ registry, dashboard, economics, economicsError, live, liveError, routes, selectedId, onSelect, onOpenNode }: MapViewProps) {
  const { t: tr, lang } = useLang()
  const narrow = useIsNarrow()
  const [url] = useState(readUrlState)
  const [basemap, setBasemap] = useState<BasemapId>(url.base ?? 'hybrid')
  const [active, setActive] = useState<Set<LayerId>>(() => new Set(url.layers ?? DEFAULT_LAYERS))
  const [showPrecip, setShowPrecip] = useState(true)
  const [tIdx, setT] = useState<number | null>(url.t)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [sheet, setSheet] = useState<'layers' | 'alerts' | null>(null)

  const t = Math.max(0, Math.min((live?.hours ?? 1) - 1, tIdx ?? live?.observed_until ?? 0))

  useEffect(() => {
    if (!playing || !live) return
    const id = window.setInterval(() => {
      setT((cur) => {
        const c = cur ?? live.observed_until
        return c + 1 >= live.hours ? 0 : c + 1
      })
    }, 900 / speed)
    return () => window.clearInterval(id)
  }, [playing, speed, live])

  const toggle = (l: LayerId) =>
    setActive((s) => {
      const n = new Set(s)
      if (n.has(l)) n.delete(l)
      else n.add(l)
      return n
    })

  const allNodes = useMemo(() => buildMapNodes(registry, dashboard), [registry, dashboard])
  const nodes = useMemo(() => allNodes.filter((n) => n.prefecture === 'fukui'), [allNodes])
  const frame = useMemo(() => (live ? frameAt(live, t) : null), [live, t])
  const alerts = useMemo(() => (live && frame ? computeAlerts(live, routes, frame, registry?.nodes ?? [], t) : null), [live, routes, frame, registry, t])
  const top = alerts ? topAlert(alerts) : null
  const selected = allNodes.find((n) => n.id === selectedId)
  const kanazawa = registry?.nodes.find((n) => n.id === 'kanazawa')
  const isDemo = Boolean(live?.demo)
  const observed = live ? t <= live.observed_until : true
  const layerOn = (l: LayerId) => active.has(l)
  const paused = false

  const rightPanel = selected ? (
    <NodeDrawer
      node={selected}
      frame={frame?.[selected.id]}
      live={live}
      routes={routes}
      dashboard={dashboard}
      economics={economics}
      t={t}
      onClose={() => onSelect(undefined)}
      onOpenNode={onOpenNode}
    />
  ) : alerts ? (
    <AlertsPanel alerts={alerts} nodes={nodes} frame={frame} isDemo={isDemo} onSelect={(id) => onSelect(id)} onClose={narrow ? () => setSheet(null) : undefined} />
  ) : null

  const sheetState = narrow ? (selected ? 'right' : sheet === 'layers' ? 'left' : sheet === 'alerts' ? 'right' : 'none') : 'none'

  return (
    <section className={`mapview sheet-${sheetState}`}>
      <MapContainer bounds={VIEW_BOUNDS} zoomSnap={0.25} zoomDelta={0.5} zoomControl={false} scrollWheelZoom className="map-canvas" preferCanvas={false} worldCopyJump={false}>
        <FitView narrow={narrow} />
        {!narrow && <ZoomControl position="bottomright" />}
        <Basemap id={basemap} />

        {live && frame && routes && (
          <>
            {layerOn('density') && <DensityLayer nodes={nodes} frame={frame} />}
            {layerOn('traffic') && <TrafficLayer live={live} routes={routes} t={t} paused={paused} />}
            {layerOn('flow') && <FlowLayer live={live} routes={routes} t={t} paused={paused} />}
            {layerOn('sentiment') && <SentimentLayer nodes={nodes} frame={frame} />}
          </>
        )}
        {layerOn('economics') && economics && <EconomicsLayer economics={economics} nodes={allNodes} selectedId={selectedId} />}
        {(layerOn('people') || layerOn('flow')) && (
          <PeopleLayer
            nodes={layerOn('people') ? nodes : []}
            frame={frame}
            selectedId={selectedId}
            onSelect={onSelect}
            showCounts={layerOn('people')}
            kanazawa={layerOn('flow') && kanazawa ? { lat: kanazawa.lat, lon: kanazawa.lon } : undefined}
          />
        )}
        {layerOn('weather') && frame && <WeatherLayer nodes={nodes} frame={frame} showPrecip={showPrecip} />}
      </MapContainer>

      <div className="map-ui">
        {live && (
          <div className="status-strip" role="status" aria-live="polite">
            <span className={`ss-tag ${observed ? 'live' : 'fc'}`}>{observed ? tr('LIVE', 'ライブ') : tr('FORECAST', '予測')}</span>
            <span className="ss-time">{timeLabel(live, t, lang)}</span>
            {top ? (
              <span className="ss-msg">
                <span className="ss-sev" style={{ background: SEV_COLOUR[top.sev] }} aria-hidden="true"></span>
                {tr(top.en, top.ja)}
              </span>
            ) : (
              <span className="ss-msg">
                <span className="ss-sev" style={{ background: '#0ca30c' }} aria-hidden="true"></span>
                {tr('All conditions normal.', 'すべて平常です。')}
              </span>
            )}
            {isDemo && <DemoBadge />}
          </div>
        )}
        {liveError && <div className="banner banner-warn status-strip">live_demo.json: {liveError.message}</div>}

        <div className="map-left">
          <LayersPanel
            basemap={basemap}
            setBasemap={setBasemap}
            active={active}
            toggle={toggle}
            showPrecip={showPrecip}
            setShowPrecip={setShowPrecip}
            isDemo={isDemo}
            economics={economics}
            economicsError={economicsError}
            onClose={narrow ? () => setSheet(null) : undefined}
          />
        </div>

        <div className="map-right">{rightPanel}</div>

        <div className="map-bottom">
          {live && <Timeline live={live} t={t} setT={(i) => setT(i)} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} />}
          {narrow && (
            <div className="sheet-tabs" role="group" aria-label={tr('Panels', 'パネル')}>
              <button className="btn" aria-pressed={sheetState === 'left'} onClick={() => { onSelect(undefined); setSheet(sheet === 'layers' ? null : 'layers') }}>
                <Icon name="layers" /> {tr('Layers', 'レイヤー')} <span className="count-badge">{active.size}</span>
              </button>
              <button className="btn" aria-pressed={sheetState === 'right' && !selected} onClick={() => { onSelect(undefined); setSheet(sheet === 'alerts' ? null : 'alerts') }}>
                <Icon name="alert" /> {tr('Live board', 'ライブボード')}
                {alerts && alerts.traffic.length + alerts.weather.length + alerts.crowd.length > 0 && (
                  <span className="count-badge warn">{alerts.traffic.length + alerts.weather.length + alerts.crowd.length}</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
