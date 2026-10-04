/** Bus stop schedules from transport_trips.json (the operators' GTFS-JP timetables). */
import type { DayType, TransportTripsFile } from '../types/transport'

export interface BusDeparture {
  min: number
  route: string
  to: string
}

/** The next buses leaving a stop (by GTFS stop id) at or after minute m, on a day type's timetable. */
export function nextBuses(trips: TransportTripsFile, day: DayType, stopId: string, m: number, n = 6): BusDeparture[] {
  const idx = trips.stop_ids?.indexOf(stopId) ?? -1
  if (idx < 0) return []
  const out: BusDeparture[] = []
  for (const [r, stops, mins] of trips.trips[day] ?? []) {
    const i = stops.indexOf(idx)
    // Leaving here, so not the trip's last stop.
    if (i < 0 || i === stops.length - 1 || mins[i] < m) continue
    out.push({ min: mins[i], route: trips.routes[r]?.name ?? '', to: trips.stop_names?.[stops[stops.length - 1]] ?? '' })
  }
  return out.sort((a, b) => a.min - b.min).slice(0, n)
}
