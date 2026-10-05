import { useEffect, useMemo, useState } from 'react'
import type { TransportMapFile, TransportTripsFile } from '../../../types/transport'
import { snapTrip } from '../../../lib/busPath'
import type { SnappedTrip } from '../../../lib/busPath'
import { MODE_COLOUR, RAIL_LINE_COLOUR } from '../../../lib/transport'
import { dayTypeOf, vehicleClock } from '../../../lib/vehicleClock'
import type { RailRun } from '../../../lib/railModel'
import { VehicleCanvas } from '../canvas/VehicleCanvas'
import type { BusTrip } from '../canvas/VehicleCanvas'
import { useLeafletLayer } from '../canvas/useLeafletLayer'

/** Simulated minutes a second when the timeline is scrubbed off Now. */
const SIM_RATE = 2


/** JST date of timeline hour t (hours after `start`, a JST date at 00:00). */
function dateOfHour(start: string, t: number): string {
  return new Date(Date.parse(`${start}T00:00:00+09:00`) + t * 3600000 + 9 * 3600000).toISOString().slice(0, 10)
}

/**
 * Moving buses (bus timetables) and trains (illustrative rail model) on the
 * shared vehicleClock: live at Now (real time, today's timetable); scrubbed to
 * another hour, a simulation running on from that hour.
 */
export function VehiclesLayer({
  trips,
  lines,
  runs,
  start,
  t,
  live,
  playing,
}: {
  trips: TransportTripsFile | null
  /** Drawn bus lines: buses run along their route's line, and routes without one get no buses. */
  lines: TransportMapFile['lines']
  runs: RailRun[]
  start: string
  t: number
  /** At Now and not playing: real time. */
  live: boolean
  playing: boolean
}) {
  const canvas = useLeafletLayer(() => new VehicleCanvas({ bus: MODE_COLOUR.bus, train: RAIL_LINE_COLOUR }))
  const iso = dateOfHour(start, t)

  // Where the vehicles' run started when ▶ was pressed: while the timeline plays they keep running
  // from there at SIM_RATE. Keeping pace with the timeline (an hour per step) made them race.
  const [playFrom, setPlayFrom] = useState<{ iso: string; min: number } | null>(null)
  if (playing && !playFrom) setPlayFrom({ iso, min: (t % 24) * 60 })
  else if (!playing && playFrom) setPlayFrom(null)

  useEffect(() => {
    // At Now: the real clock. Scrubbed to another hour: the vehicles run on from that hour at
    // SIM_RATE minutes a second (a simulation, so they visibly travel their routes). While the
    // timeline plays: the same speed, from the hour play started.
    const from = playing ? playFrom : null
    if (live) vehicleClock.set('live', iso, 0, 1)
    else if (from) vehicleClock.set('run', from.iso, from.min, SIM_RATE)
    else vehicleClock.set('run', iso, (t % 24) * 60, SIM_RATE)
  }, [live, iso, t, playing, playFrom])

  // The live clock can cross midnight: check the timetable day once a minute.
  const [, tick] = useState(0)
  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => tick((n) => n + 1), 60000)
    return () => window.clearInterval(id)
  }, [live])
  const day = dayTypeOf(live ? vehicleClock.date() : (playFrom?.iso ?? iso))

  // Each stop pattern is placed on its line once (a few dozen patterns behind hundreds of trips).
  const buses = useMemo<BusTrip[]>(() => {
    if (!trips) return []
    const lineOf = new Map(lines.map((l) => [l.id, l.path]))
    const snaps = new Map<string, SnappedTrip | null>()
    const out: BusTrip[] = []
    for (const [r, s, min] of trips.trips[day] ?? []) {
      const path = lineOf.get(trips.routes[r]?.id ?? '')
      if (!path) continue // not drawn on the map: a bus there would float off the network
      const pts = s.map((i) => trips.stops[i])
      const key = `${r}:${s.join(',')}`
      if (!snaps.has(key)) snaps.set(key, snapTrip(path, pts))
      out.push({ pts, min, snap: snaps.get(key) ?? null })
    }
    return out
  }, [trips, lines, day])

  useEffect(() => {
    canvas.setData(buses, runs)
  }, [canvas, buses, runs])

  return null
}
