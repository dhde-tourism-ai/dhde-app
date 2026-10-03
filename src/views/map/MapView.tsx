import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap, ZoomControl } from 'react-leaflet'
import type L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../../styles/map.css'
import '../../styles/map-layers.css'
import type { DashboardData } from '../../types/dashboard'
import type { NodeRegistry } from '../../types/nodes'
import type { RegionalEconomics } from '../../types/economics'
import type { LiveData } from '../../types/live'
import type { RoutesFile } from '../../types/routes'
import type { MarketVoiceData } from '../../types/market'
import type { TransportFile, TransportMapFile } from '../../types/transport'
import { buildMapNodes } from '../../lib/nodes'
import { frameAt, timeLabel } from '../../lib/live'
import { computeAlerts, SEV_COLOUR, topAlert } from '../../lib/alerts'
import { computeNudges, topPerDay } from '../../lib/nudges'
import type { HotelThresholds, Nudge } from '../../lib/nudges'
import { useJsonResource } from '../../hooks/useJsonResource'
import { useLang } from '../../lib/i18n'
import { useIsNarrow } from '../../hooks/useIsNarrow'
import { Icon } from '../../components/icons'
import { DemoBadge } from '../../components/DemoBadge'
import { SourceBadge } from '../../components/SourceBadge'
import { DEFAULT_LAYERS, OVERVIEW_NOTE, readStoredLayers, readUrlState, storeLayers, TOWN_LAYERS } from './layers'
import type { BasemapId, LayerId } from './layers'
import { PeopleLayer } from './layers/PeopleLayer'
import { SiteMarkers } from './layers/SiteMarkers'
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
import { NudgesPanel } from './panels/NudgesPanel'
import { NudgeLayer } from './layers/NudgeLayer'
import { TransportLayer } from './layers/TransportLayer'
import { HotelsLayer, RsiLayer } from './layers/VoiceMarketLayers'
import { SiteCards } from './layers/SiteCards'
import { Declutter } from './Declutter'

/** Fukui's six priority nodes; the Kanazawa inflow enters from the top edge. */
const VIEW_BOUNDS: [[number, number], [number, number]] = [
  [35.57, 135.84],
  [36.3, 136.56],
]

function FitView({ narrow }: { narrow: boolean }) {
  const map = useMap()
  useEffect(() => {
    const id = window.setTimeout(() => {
      map.invalidateSize()
      map.fitBounds(VIEW_BOUNDS, narrow ? { paddingTopLeft: [8, 8], paddingBottomRight: [8, 150] } : { paddingTopLeft: [330, 64], paddingBottomRight: [440, 96] })
    }, 50)
    return () => window.clearTimeout(id)
  }, [map, narrow])
  return null
}

function FlyTo({ target }: { target: { at: [number, number]; key: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.flyTo(target.at, Math.max(map.getZoom(), 10.5), { animate: !reduce, duration: 0.8 })
  }, [map, target])
  return null
}

/**
 * Keep hover cards inside the visible map: below the status strip, above the
 * timeline and clear of the side panels (layers on the left, the board on the
 * right). Leaflet positions tooltips with a transform, so the nudge is a margin.
 */
function KeepCardsInView() {
  const map = useMap()
  useEffect(() => {
    let el: HTMLElement | null = null
    let raf = 0
    const fit = () => {
      if (!el) return
      el.style.marginTop = ''
      el.style.marginLeft = ''
      const r = el.getBoundingClientRect()
      const mapBox = map.getContainer().getBoundingClientRect()
      const strip = document.querySelector('.status-strip')?.getBoundingClientRect()
      const timeline = document.querySelector('.map-bottom')?.getBoundingClientRect()
      const top = Math.max(mapBox.top, strip ? strip.bottom : mapBox.top) + 8
      const bottom = Math.min(mapBox.bottom, timeline ? timeline.top : mapBox.bottom) - 8
      let d = 0
      if (r.top < top) d = top - r.top
      else if (r.bottom > bottom) d = Math.max(top - r.top, bottom - r.bottom)
      if (d !== 0) el.style.marginTop = `${d}px`
      // Sideways: the visible part of the side panels (they're empty columns below their cards).
      const edge = (sel: string, side: 'right' | 'left') =>
        [...document.querySelectorAll<HTMLElement>(`${sel} > *`)]
          .map((x) => x.getBoundingClientRect())
          .filter((b) => b.width > 0 && b.height > 0 && b.bottom > r.top + d && b.top < r.bottom + d)
          .reduce<number | null>((a, b) => (a === null ? b[side] : side === 'right' ? Math.max(a, b.right) : Math.min(a, b.left)), null)
      const left = Math.max(mapBox.left, edge('.map-left', 'right') ?? mapBox.left) + 8
      const right = Math.min(mapBox.right, edge('.map-right', 'left') ?? mapBox.right) - 8
      let dx = 0
      if (r.width <= right - left) {
        if (r.left < left) dx = left - r.left
        else if (r.right > right) dx = right - r.right
      }
      if (dx !== 0) el.style.marginLeft = `${dx}px`
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(fit)
    }
    // React renders the card's content after Leaflet opens it, so refit when it resizes and shortly after.
    const ro = new ResizeObserver(schedule)
    const timers: number[] = []
    const open = (e: L.LeafletEvent) => {
      el = ((e as L.TooltipEvent).tooltip?.getElement() as HTMLElement | undefined) ?? null
      ro.disconnect()
      if (el) ro.observe(el)
      schedule()
      timers.push(window.setTimeout(fit, 60), window.setTimeout(fit, 200))
    }
    const close = () => {
      el = null
      ro.disconnect()
    }
    map.on('tooltipopen', open)
    map.on('tooltipclose', close)
    map.on('mousemove move zoomend', schedule)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      timers.forEach((x) => window.clearTimeout(x))
      map.off('tooltipopen', open)
      map.off('tooltipclose', close)
      map.off('mousemove move zoomend', schedule)
    }
  }, [map])
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
  market: MarketVoiceData | null
  selectedId?: string
  onSelect: (id: string | undefined) => void
  onOpenNode: (id: string) => void
}

export default function MapView({ registry, dashboard, economics, economicsError, live, liveError, routes, market, selectedId, onSelect, onOpenNode }: MapViewProps) {
  const { t: tr, lang } = useLang()
  const narrow = useIsNarrow()
  const [url] = useState(readUrlState)
  const [basemap, setBasemap] = useState<BasemapId>(url.base ?? 'hybrid')
  const [active, setActive] = useState<Set<LayerId>>(() => new Set(url.layers ?? readStoredLayers() ?? DEFAULT_LAYERS))
  const [showPrecip, setShowPrecip] = useState(true)
  const [tIdx, setT] = useState<number | null>(url.t)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [sheet, setSheet] = useState<'layers' | 'alerts' | 'nudges' | null>(null)
  const [rightTab, setRightTab] = useState<'board' | 'nudges'>(url.panel ?? 'board')
  const [showAllNudges, setShowAllNudges] = useState(false)
  const [activeNudge, setActiveNudge] = useState<string | undefined>(undefined)
  const [fly, setFly] = useState<{ at: [number, number]; key: number } | null>(null)

  const t = Math.max(0, Math.min((live?.hours ?? 1) - 1, tIdx ?? live?.now_index ?? live?.observed_until ?? 0))

  // A shared ?t=2026-10-02T14 is a JST date and hour: once the timeline is known, turn it into
  // its index (ignored when that hour isn't in the timeline any more).
  const tAt = useRef(url.tAt)
  useEffect(() => {
    if (!tAt.current || !live) return
    const i = Math.round((Date.parse(`${tAt.current}:00:00+09:00`) - Date.parse(`${live.start}T00:00:00+09:00`)) / 3600000)
    tAt.current = null
    if (i >= 0 && i < live.hours) setT(i)
  }, [live])

  // The timeline follows the clock, so at midnight it starts a day later. A picked hour is an
  // index into it: shift it back by the same hours so it stays on the same date and hour.
  const prevStart = useRef(live?.start)
  useEffect(() => {
    const from = prevStart.current
    prevStart.current = live?.start
    if (!from || !live?.start || from === live.start) return
    const hours = Math.round((Date.parse(`${live.start}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 3600000)
    setT((cur) => (cur === null ? null : Math.max(0, cur - hours)))
  }, [live?.start])

  useEffect(() => {
    if (!playing || !live) return
    const id = window.setInterval(() => {
      setT((cur) => {
        const c = cur ?? live.now_index ?? live.observed_until
        return c + 1 >= live.hours ? 0 : c + 1
      })
    }, 900 / speed)
    return () => window.clearInterval(id)
  }, [playing, speed, live])

  // Saved only when the viewer toggles a layer: a ?layers= link or a picked
  // nudge turning a layer on doesn't replace the viewer's own choice.
  const toggle = (l: LayerId) => {
    const n = new Set(active)
    if (n.has(l)) n.delete(l)
    else {
      n.add(l)
      // Town-level layers draw cards on the towns: one at a time, so they don't pile up.
      for (const other of TOWN_LAYERS) if (other !== l && TOWN_LAYERS.includes(l)) n.delete(other)
    }
    setActive(n)
    storeLayers(n)
  }

  const allNodes = useMemo(() => buildMapNodes(registry, dashboard), [registry, dashboard])
  const nodes = useMemo(() => allNodes.filter((n) => n.prefecture === 'fukui'), [allNodes])
  const frame = useMemo(() => (live ? frameAt(live, t) : null), [live, t])
  const alerts = useMemo(() => (live && frame ? computeAlerts(live, routes, frame, registry?.nodes ?? [], t) : null), [live, routes, frame, registry, t])
  const top = alerts ? topAlert(alerts) : null
  const day = Math.floor(t / 24)
  // Optional: without hotel_thresholds.json loop #3 keeps its demo rule.
  const hotelThresholds = useJsonResource<HotelThresholds>('hotel_thresholds.json').data
  // Optional: public transport access (transport/build_transport.py). Without it the card and layer just don't show.
  const transport = useJsonResource<TransportFile>('transport.json').data
  const transportMap = useJsonResource<TransportMapFile>('transport_map.json').data
  const nudges = useMemo(
    () => (live ? computeNudges(live, market, registry?.nodes ?? [], live.today_day ?? 0, hotelThresholds) : []),
    [live, market, registry, hotelThresholds],
  )
  const nudgesShown = useMemo(() => (showAllNudges ? nudges : topPerDay(nudges, 3)), [nudges, showAllNudges])
  const nudgesFrom = useMemo(() => nudgesShown.filter((n) => n.day >= day), [nudgesShown, day])
  const nudgesFromAll = useMemo(() => nudges.filter((n) => n.day >= day).length, [nudges, day])
  const pickNudge = (n: Nudge) => {
    setPlaying(false)
    setT(n.start)
    setActiveNudge(n.id)
    setFly({ at: n.focus, key: Date.now() })
    setActive((s) => (s.has('nudges') ? s : new Set([...s, 'nudges'])))
    if (narrow) setSheet(null)
  }
  const selected = allNodes.find((n) => n.id === selectedId)
  const kanazawa = registry?.nodes.find((n) => n.id === 'kanazawa')
  const hubNode = registry?.nodes.find((n) => n.id === (transport?.hub ?? 'fukui_station'))
  const hubName: [string, string] = hubNode ? [hubNode.name, hubNode.name_ja] : ['Fukui Station', '福井駅']
  const isDemo = Boolean(live?.demo)
  const observed = live ? t <= live.observed_until : true
  const layerOn = (l: LayerId) => active.has(l)
  const cardLayers = useMemo(
    () => ({ people: active.has('people'), weather: active.has('weather'), reviews: active.has('reviews'), survey: active.has('survey'), social: active.has('social') }),
    [active],
  )
  const paused = false

  const tabs = (
    <div className="panel-tabs" role="tablist" aria-label={tr('Right panel', 'パネル')}>
      <button role="tab" aria-selected={rightTab === 'board'} onClick={() => setRightTab('board')}>
        <Icon name="alert" size={14} /> {tr('Live board', 'ライブボード')}
      </button>
      <button role="tab" aria-selected={rightTab === 'nudges'} onClick={() => setRightTab('nudges')}>
        <Icon name="flag" size={14} /> {tr('Action nudges', '推奨アクション')} <span className="count-badge">{nudgesFrom.length}</span>
      </button>
    </div>
  )
  const showNudges = narrow ? sheet === 'nudges' : rightTab === 'nudges'
  const nudgeTitle = (
    <h2 className="fp-title">
      <Icon name="flag" /> {tr('Action nudges', '推奨アクション')}
    </h2>
  )

  const rightPanel = selected ? (
    <NodeDrawer
      node={selected}
      frame={frame?.[selected.id]}
      live={live}
      routes={routes}
      transport={transport}
      hubName={hubName}
      dashboard={dashboard}
      economics={economics}
      market={market}
      t={t}
      onClose={() => onSelect(undefined)}
      onOpenNode={onOpenNode}
    />
  ) : showNudges && live ? (
    <NudgesPanel source={live?.sources?.nudges} nudges={nudgesFrom} total={nudgesFromAll} showAll={showAllNudges} setShowAll={setShowAllNudges} live={live} day={day} activeId={activeNudge} onPick={pickNudge} tabs={narrow ? nudgeTitle : tabs} onClose={narrow ? () => setSheet(null) : undefined} />
  ) : alerts ? (
    <AlertsPanel source={live?.sources?.people} alerts={alerts} nodes={nodes} frame={frame} isDemo={isDemo} onSelect={(id) => onSelect(id)} onClose={narrow ? () => setSheet(null) : undefined} tabs={narrow ? undefined : tabs} />
  ) : null

  const sheetState = narrow ? (selected ? 'right' : sheet === 'layers' ? 'left' : sheet === 'alerts' || sheet === 'nudges' ? 'right' : 'none') : 'none'

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
        {market && layerOn('hotels') && <HotelsLayer data={market} day={day} nodes={registry?.nodes ?? []} />}
        {market && layerOn('rsi') && <RsiLayer data={market} />}
        {layerOn('transport') && transportMap && <TransportLayer data={transportMap} />}
        {layerOn('economics') && economics && <EconomicsLayer economics={economics} nodes={allNodes} selectedId={selectedId} />}
        {(layerOn('people') || layerOn('flow')) && (
          <PeopleLayer
            nodes={layerOn('people') ? nodes : []}
            frame={frame}
            selectedId={selectedId}
            onSelect={onSelect}
            meta={live?.node_meta}
            day={day}
            kanazawa={layerOn('flow') && kanazawa ? { lat: kanazawa.lat, lon: kanazawa.lon } : undefined}
          />
        )}
        {!layerOn('people') && <SiteMarkers nodes={nodes.filter((n) => n.priority)} selectedId={selectedId} onSelect={onSelect} />}
        {layerOn('weather') && frame && <WeatherLayer nodes={nodes} frame={frame} showPrecip={showPrecip} />}
        {/* One card per site: its name, then a row per active layer (weather, reviews, survey, posts). */}
        <SiteCards
          nodes={layerOn('people') ? nodes.filter((n) => frame?.[n.id]) : nodes.filter((n) => n.priority)}
          extra={nodes}
          frame={frame}
          market={market}
          layers={cardLayers}
          selectedId={selectedId}
          onSelect={onSelect}
          meta={live?.node_meta}
          day={day}
        />
        {layerOn('nudges') && <NudgeLayer nudges={nudgesShown} routes={routes} day={day} activeId={activeNudge} onPick={pickNudge} />}
        <FlyTo target={fly} />
        <KeepCardsInView />
        <Declutter />
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
            {isDemo && (live?.sources && Object.values(live.sources).some((x) => x && x.status !== 'demo') ? <SourceBadge info={{ status: 'mixed', as_of: live.shared_date ?? null, real: [] }} note={OVERVIEW_NOTE} /> : <DemoBadge />)}
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
            market={market}
            sources={live?.sources}
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
              <button className="btn" aria-pressed={sheet === 'alerts' && !selected} onClick={() => { onSelect(undefined); setSheet(sheet === 'alerts' ? null : 'alerts') }}>
                <Icon name="alert" /> {tr('Live', 'ライブ')}
                {alerts && alerts.traffic.length + alerts.weather.length + alerts.crowd.length > 0 && (
                  <span className="count-badge warn">{alerts.traffic.length + alerts.weather.length + alerts.crowd.length}</span>
                )}
              </button>
              <button className="btn" aria-pressed={sheet === 'nudges' && !selected} onClick={() => { onSelect(undefined); setSheet(sheet === 'nudges' ? null : 'nudges') }}>
                <Icon name="flag" /> {tr('Actions', 'アクション')} <span className="count-badge">{nudgesFrom.length}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
