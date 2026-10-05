import { useState } from 'react'
import { CircleMarker, Pane, Polygon, Polyline, useMapEvents } from 'react-leaflet'
import type { TransportMapFile, TransportTripsFile } from '../../../types/transport'
import type { RailRun } from '../../../lib/railModel'
import { BusStopSchedule, StationSchedule } from './Schedules'
import { MODE_COLOUR, MODE_LABEL, RAIL_LINE_COLOUR } from '../../../lib/transport'
import { useLang } from '../../../lib/i18n'
import { Tip } from './Tip'
import { useBriefing } from '../../../lib/briefing'

/** All red: the Shinkansen wider, the Fukui Railway tram dashed. */
const RAIL_STYLE = {
  shinkansen: { color: RAIL_LINE_COLOUR, weight: 5 },
  rail: { color: RAIL_LINE_COLOUR, weight: 3 },
  tram: { color: RAIL_LINE_COLOUR, weight: 2.5, dashArray: '5 4' },
}

/** Light dashes running along the track and bus lines (styles/map-layers.css animates them), so the routes read as moving. */
const FLOW_STYLE = { color: '#ffffff', lineCap: 'round' as const }

const WALK_STYLE: Record<string, { color: string; fillOpacity: number; dashArray?: string }> = {
  '15': { color: '#6fdc93', fillOpacity: 0.16 },
  '30': { color: '#6fdc93', fillOpacity: 0.06, dashArray: '4 6' },
}

/** Stop and station dots grow as you zoom in, so the whole prefecture view isn't a carpet of dots. */
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
  const { t: tr } = useLang()
  const zoom = useZoom()
  const stopR = zoom >= 13 ? 5 : zoom >= 11 ? 4 : 2.6
  // Briefing keeps the overview to the routes; stops appear from zoom 11, where they can be told apart.
  const briefing = useBriefing()
  const showStops = !briefing || zoom >= 11
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
            pathOptions={{ color: '#0a1120', weight: RAIL_STYLE[l.kind].weight + 2.5, opacity: 0.75 }} />
        ))}
        {rail?.lines.map((l) => (
          <Polyline key={l.id} positions={l.paths} pathOptions={{ ...RAIL_STYLE[l.kind], opacity: 0.95 }}>
            <Tip sticky>
              <strong>{tr(l.name, l.name_ja)}</strong>
              <div className="tip-sub">{l.kind === 'shinkansen' ? 'Shinkansen' : tr(...MODE_LABEL.rail)}</div>
            </Tip>
          </Polyline>
        ))}
        {/* Briefing leaves out the running dashes: they suggest measured movement and add clutter. */}
        {!briefing && rail?.lines.map((l) => (
          <Polyline key={`${l.id}-flow`} positions={l.paths} className="route-flow route-flow--rail" interactive={false}
            pathOptions={{ ...FLOW_STYLE, weight: Math.max(1.5, RAIL_STYLE[l.kind].weight - 1.5), opacity: 0.85, dashArray: '2 14' }} />
        ))}
      </Pane>
      {bus && (
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
          {!briefing && data.lines.map((l) => (
            <Polyline key={`${l.id}-flow`} positions={l.path} className="route-flow route-flow--bus" interactive={false}
              pathOptions={{ ...FLOW_STYLE, weight: 1.6, opacity: 0.8, dashArray: '1 11' }} />
          ))}
        </Pane>
      )}
      {bus && showStops && (
        <Pane name="dhde-transport-stops" style={{ zIndex: 455 }}>
          {data.stops.map((s) => (
            <CircleMarker key={s.id} center={[s.lat, s.lon]} radius={stopR}
              pathOptions={{ color: '#0a1120', weight: stopR < 3 ? 1 : 1.5, fillColor: '#ffffff', fillOpacity: 1 }}>
              <Tip>
                <strong>{s.name}</strong>
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
          <CircleMarker key={s.id} center={[s.lat, s.lon]} radius={stopR + 1}
            pathOptions={{ color: RAIL_LINE_COLOUR, weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}>
            <Tip>
              <strong>{s.name_ja}</strong>
              <div className="tip-sub">{s.lines.map((id) => railName[id]).join(' · ')}</div>
              <StationSchedule runs={runs} stationId={s.id} />
            </Tip>
          </CircleMarker>
        ))}
      </Pane>
    </>
  )
}
