import { useState } from 'react'
import { CircleMarker, Pane, Polygon, Polyline, useMapEvents } from 'react-leaflet'
import type { TransportMapFile, TransportTripsFile } from '../../../types/transport'
import type { RailRun } from '../../../lib/railModel'
import { BusStopSchedule, StationSchedule } from './Schedules'
import { MODE_COLOUR, MODE_LABEL, RAIL_LINE_COLOUR } from '../../../lib/transport'
import { useLang } from '../../../lib/i18n'
import { Tip } from './Tip'
import { placeEn, routeEn } from '../../../lib/transportNames'

/** All red: the Shinkansen wider, the Fukui Railway tram dashed. Kept thin so the map stays readable. */
const RAIL_STYLE = {
  shinkansen: { color: RAIL_LINE_COLOUR, weight: 3 },
  rail: { color: RAIL_LINE_COLOUR, weight: 2 },
  tram: { color: RAIL_LINE_COLOUR, weight: 1.6, dashArray: '4 3' },
}

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
  const stopR = zoom >= 14 ? 3.2 : zoom >= 13 ? 2.6 : 2
  const stationR = zoom >= 14 ? 4 : zoom >= 12 ? 3.2 : zoom >= 10.5 ? 2.6 : 2.2
  const walk = data.walk_areas
  const rail = showRail ? data.rail : null
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
          <Polyline key={l.id} positions={l.paths} pathOptions={{ ...RAIL_STYLE[l.kind], opacity: 0.95 }}>
            <Tip sticky above>
              <strong>{tr(l.name, l.name_ja)}</strong>
              <div className="tip-sub">{l.kind === 'shinkansen' ? 'Shinkansen' : tr(...MODE_LABEL.rail)}</div>
            </Tip>
          </Polyline>
        ))}
      </Pane>
      {bus && (
        <Pane name="dhde-transport-lines" style={{ zIndex: 430 }}>
          {data.lines.map((l) => (
            <Polyline key={l.id} positions={l.path}
              pathOptions={{ color: l.mode === 'rail' ? (l.colour ?? MODE_COLOUR.rail) : MODE_COLOUR.bus, weight: l.mode === 'rail' ? 2.5 : 1.5, opacity: 0.85 }}>
              <Tip sticky above>
                {named(routeEn(l.name), l.name)}
                <div className="tip-sub">{tr(...MODE_LABEL[l.mode])}</div>
              </Tip>
            </Polyline>
          ))}
        </Pane>
      )}
      {bus && showStops && (
        <Pane name="dhde-transport-stops" style={{ zIndex: 455 }}>
          {data.stops.map((s) => (
            <CircleMarker key={s.id} center={[s.lat, s.lon]} radius={stopR}
              pathOptions={{ color: '#0a1120', weight: 0.8, fillColor: '#ffffff', fillOpacity: 1 }}>
              <Tip above>
                {named(placeEn(s.name), s.name)}
                <div className="tip-sub">{tr('Bus stop', 'バス停')}</div>
                <BusStopSchedule trips={trips} stopId={s.id} />
              </Tip>
            </CircleMarker>
          ))}
        </Pane>
      )}
      {/* stations above bus stops: fewer, and the main transfer points */}
      <Pane name="dhde-transport-stations" style={{ zIndex: 460 }}>
        {rail?.stations.map((s) => (
          <CircleMarker key={s.id} center={[s.lat, s.lon]} radius={stationR}
            pathOptions={{ color: RAIL_LINE_COLOUR, weight: 1.2, fillColor: '#ffffff', fillOpacity: 1 }}>
            <Tip above>
              {named(placeEn(s.name_ja), s.name_ja)}
              <div className="tip-sub">{s.lines.map((id) => railName[id]).join(' · ')}</div>
              <StationSchedule runs={runs} stationId={s.id} />
            </Tip>
          </CircleMarker>
        ))}
      </Pane>
    </>
  )
}
