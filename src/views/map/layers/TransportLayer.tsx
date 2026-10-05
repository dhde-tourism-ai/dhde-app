import { Fragment, useState } from 'react'
import { CircleMarker, Pane, Polygon, Polyline, useMapEvents } from 'react-leaflet'
import type { TransportMapFile, TransportTripsFile } from '../../../types/transport'
import type { RailRun } from '../../../lib/railModel'
import { BusStopSchedule, StationSchedule } from './Schedules'
import { MODE_COLOUR, MODE_LABEL, RAIL_LINE_COLOUR } from '../../../lib/transport'
import { useLang } from '../../../lib/i18n'
import { Tip } from './Tip'
import { placeEn, routeEn } from '../../../lib/transportNames'
import { busRouteUrl, busStopUrl, railLineUrl, stationUrl } from '../../../lib/googleMaps'
import { useIsNarrow } from '../../../hooks/useIsNarrow'

/** All red: the Shinkansen wider, the Fukui Railway tram dashed. Kept thin so the map stays readable. */
const RAIL_STYLE = {
  shinkansen: { color: RAIL_LINE_COLOUR, weight: 3 },
  rail: { color: RAIL_LINE_COLOUR, weight: 2 },
  tram: { color: RAIL_LINE_COLOUR, weight: 1.6, dashArray: '4 3' },
}

/** The dots are tiny; an invisible ring this size around each takes the hover, so they stay easy to point at. */
const HIT_R = 7
const HIT_STYLE = { stroke: false, fillColor: '#000', fillOpacity: 0 }

const WALK_STYLE: Record<string, { color: string; fillOpacity: number; dashArray?: string }> = {
  '15': { color: '#6fdc93', fillOpacity: 0.16 },
  '30': { color: '#6fdc93', fillOpacity: 0.06, dashArray: '4 6' },
}

/** Stop and station dots grow as you zoom in; bus stops only appear from street level, so the prefecture and city views aren't a carpet of dots. */
function useZoom() {
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const [zoom, setZoom] = useState(() => map.getZoom())
  return zoom
}

/**
 * Bus routes serving the six nodes with every stop on them and 15/30-minute
 * walking areas (the Bus routes layer), and railway lines and stations (the
 * Train routes layer), from transport_map.json. Bus lines come from the
 * operators' GTFS shapes where published, otherwise the stop sequence. Railway
 * lines and stations come from MLIT's railway data (track only, no timetables).
 */
export function TransportLayer({
  data,
  bus,
  rail: showRail,
  trips,
  runs,
}: {
  data: TransportMapFile
  bus: boolean
  rail: boolean
  /** Bus timetables, for each stop's next departures. */
  trips: TransportTripsFile | null
  /** Illustrative train service, for each station's next trains. */
  runs: RailRun[]
}) {
  const { t: tr, lang } = useLang()
  // Desktop: clicking a route, stop or station opens it in Google Maps, as does the link in its card.
  // Phones: a tap opens the card, which has the link.
  const narrow = useIsNarrow()
  const openOnClick = (url: string | null) => (narrow || !url ? undefined : { click: () => void window.open(url, '_blank', 'noopener,noreferrer') })
  // The cards linger (Tip lingers), so the link in them can be clicked on desktop as on phones.
  const gmaps = (url: string | null) =>
    url && (
      <a className="tip-gmaps" href={url} target="_blank" rel="noopener noreferrer">
        {tr('Open in Google Maps ↗', 'Google マップで開く ↗')}
      </a>
    )
  // In English: the English name, with the Japanese under it (what's on the signs).
  const named = (en: string, ja: string) => (
    <>
      <strong>{lang === 'ja' ? ja : en}</strong>
      {lang !== 'ja' && en !== ja && <div className="tip-ja">{ja}</div>}
    </>
  )
  const zoom = useZoom()
  /** Bus stops from zoom 12 (city streets); stations at every zoom, but small. */
  const showStops = zoom >= 12
  const stopR = zoom >= 14 ? 2.4 : zoom >= 13 ? 1.9 : 1.5
  const stationR = zoom >= 14 ? 3 : zoom >= 12 ? 2.3 : zoom >= 10.5 ? 1.8 : 1.5
  // Zoomed out, only the main stations (Shinkansen and interchanges); every station from zoom 11.
  const allStations = zoom >= 11
  const walk = data.walk_areas
  const rail = showRail ? data.rail : null
  const stationsOf = (lineId: string) => (rail?.stations ?? []).filter((st) => st.lines.includes(lineId))
  const railName = Object.fromEntries((rail?.lines ?? []).map((l) => [l.id, tr(l.name, l.name_ja)]))
  return (
    <>
      {bus && (
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
      )}
      <Pane name="dhde-transport-rail" style={{ zIndex: 425 }}>
        {/* dark outline first, so the track stands out from the roads on the base map */}
        {rail?.lines.map((l) => (
          <Polyline key={`${l.id}-casing`} positions={l.paths} interactive={false}
            pathOptions={{ color: '#0a1120', weight: RAIL_STYLE[l.kind].weight + 1.5, opacity: 0.7 }} />
        ))}
        {rail?.lines.map((l) => (
          <Polyline key={l.id} positions={l.paths} pathOptions={{ ...RAIL_STYLE[l.kind], opacity: 0.95 }} eventHandlers={openOnClick(railLineUrl(stationsOf(l.id)))}>
            <Tip sticky above lingers>
              <strong>{tr(l.name, l.name_ja)}</strong>
              <div className="tip-sub">{l.kind === 'shinkansen' ? 'Shinkansen' : tr(...MODE_LABEL.rail)}</div>
              {gmaps(railLineUrl(stationsOf(l.id)))}
            </Tip>
          </Polyline>
        ))}
      </Pane>
      {bus && (
        <Pane name="dhde-transport-lines" style={{ zIndex: 430 }}>
          {data.lines.map((l) => (
            <Polyline key={l.id} positions={l.path} eventHandlers={openOnClick(busRouteUrl(l.path))}
              pathOptions={{ color: l.mode === 'rail' ? (l.colour ?? MODE_COLOUR.rail) : MODE_COLOUR.bus, weight: l.mode === 'rail' ? 2.5 : 1.5, opacity: 0.85 }}>
              <Tip sticky above lingers>
                {named(routeEn(l.name), l.name)}
                <div className="tip-sub">{tr(...MODE_LABEL[l.mode])}</div>
                {gmaps(busRouteUrl(l.path))}
              </Tip>
            </Polyline>
          ))}
        </Pane>
      )}
      {bus && showStops && (
        <Pane name="dhde-transport-stops" style={{ zIndex: 455 }}>
          {data.stops.map((s) => (
            <Fragment key={s.id}>
              <CircleMarker center={[s.lat, s.lon]} radius={stopR} interactive={false}
                pathOptions={{ color: '#0a1120', weight: 0.6, fillColor: '#ffffff', fillOpacity: 1 }} />
              <CircleMarker center={[s.lat, s.lon]} radius={HIT_R} pathOptions={HIT_STYLE} eventHandlers={openOnClick(busStopUrl(s.name, s.lat, s.lon))}>
                <Tip above lingers>
                  {named(placeEn(s.name), s.name)}
                  <div className="tip-sub">{tr('Bus stop', 'バス停')}</div>
                  <BusStopSchedule trips={trips} stopId={s.id} />
                  {gmaps(busStopUrl(s.name, s.lat, s.lon))}
                </Tip>
              </CircleMarker>
            </Fragment>
          ))}
        </Pane>
      )}
      {/* stations above bus stops: fewer, and the main transfer points */}
      <Pane name="dhde-transport-stations" style={{ zIndex: 460 }}>
        {rail?.stations.filter((s) => allStations || s.lines.length > 1 || s.lines.includes('hokuriku_shinkansen')).map((s) => (
          <Fragment key={s.id}>
            <CircleMarker center={[s.lat, s.lon]} radius={stationR} interactive={false}
              pathOptions={{ color: RAIL_LINE_COLOUR, weight: 1, fillColor: '#ffffff', fillOpacity: 1 }} />
            <CircleMarker center={[s.lat, s.lon]} radius={HIT_R} pathOptions={HIT_STYLE} eventHandlers={openOnClick(stationUrl(s.name_ja, s.lat, s.lon))}>
              <Tip above lingers>
                {named(placeEn(s.name_ja), s.name_ja)}
                <div className="tip-sub">{s.lines.map((id) => railName[id]).join(' · ')}</div>
                <StationSchedule runs={runs} stationId={s.id} />
                {gmaps(stationUrl(s.name_ja, s.lat, s.lon))}
              </Tip>
            </CircleMarker>
          </Fragment>
        ))}
      </Pane>
    </>
  )
}
