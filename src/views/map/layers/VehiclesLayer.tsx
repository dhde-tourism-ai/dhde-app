import { useEffect, useMemo, useState } from 'react'
import type { TransportTripsFile } from '../../../types/transport'
import { MODE_COLOUR, RAIL_LINE_COLOUR } from '../../../lib/transport'
import { dayTypeOf, vehicleClock } from '../../../lib/vehicleClock'
import type { RailRun } from '../../../lib/railModel'
import { VehicleCanvas } from '../canvas/VehicleCanvas'
import type { BusTrip } from '../canvas/VehicleCanvas'
import { useLeafletLayer } from '../canvas/useLeafletLayer'

/** Timeline step while playing (MapView's interval at 1x), in seconds. */
const STEP_S = 0.9

/** JST date of timeline hour t (hours after `start`, a JST date at 00:00). */
function dateOfHour(start: string, t: number): string {
  return new Date(Date.parse(`${start}T00:00:00+09:00`) + t * 3600000 + 9 * 3600000).toISOString().slice(0, 10)
}

/**
 * Moving buses (bus timetables) and trains (illustrative rail model) on the
 * shared vehicleClock: live at Now (real time, today's timetable), otherwise a
 * preview of the timeline hour.
 */
export function VehiclesLayer({
  trips,
  runs,
  start,
  t,
  live,
  playing,
  speed,
}: {
  trips: TransportTripsFile | null
  runs: RailRun[]
  start: string
  t: number
  /** At Now and not playing: real time. */
  live: boolean
  playing: boolean
  speed: number
}) {
  const canvas = useLeafletLayer(() => new VehicleCanvas({ bus: MODE_COLOUR.bus, train: RAIL_LINE_COLOUR }))
  const iso = dateOfHour(start, t)

  useEffect(() => {
    // Live: real clock. Preview: a minute a second, or the whole hour per timeline step while playing.
    vehicleClock.set(live ? 'live' : 'preview', iso, (t % 24) * 60, playing ? (60 * speed) / STEP_S : 1)
  }, [live, iso, t, playing, speed])

  // The live clock can cross midnight: check the timetable day once a minute.
  const [, tick] = useState(0)
  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => tick((n) => n + 1), 60000)
    return () => window.clearInterval(id)
  }, [live])
  const day = dayTypeOf(live ? vehicleClock.date() : iso)

  const buses = useMemo<BusTrip[]>(() => (trips ? (trips.trips[day] ?? []).map(([, s, min]) => ({ pts: s.map((i) => trips.stops[i]), min })) : []), [trips, day])

  useEffect(() => {
    canvas.setData(buses, runs)
  }, [canvas, buses, runs])

  return null
}
