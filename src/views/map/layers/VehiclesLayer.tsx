import { useEffect, useMemo } from 'react'
import type { DayType, RailLines, TransportTripsFile } from '../../../types/transport'
import { useJsonResource } from '../../../hooks/useJsonResource'
import { isHoliday } from '../../../lib/holidays'
import { MODE_COLOUR, RAIL_LINE_COLOUR } from '../../../lib/transport'
import { VehicleCanvas } from '../canvas/VehicleCanvas'
import type { BusTrip, RailRun } from '../canvas/VehicleCanvas'
import { useLeafletLayer } from '../canvas/useLeafletLayer'

/** Rail paths shorter than this (spurs, twin-track pieces) get no trains. */
const MIN_RUN_KM = 15
/** Timeline step while playing (MapView's interval at 1x), in seconds. */
const STEP_S = 0.9

const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))

function km(path: [number, number][]): number[] {
  const out = [0]
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]]
    const dy = (b[0] - a[0]) * 111.2
    const dx = (b[1] - a[1]) * 111.2 * Math.cos((a[0] * Math.PI) / 180)
    out.push(out[i - 1] + Math.hypot(dx, dy))
  }
  return out
}

/** Weekday, Saturday or Sunday/holiday timetable for a JST date (YYYY-MM-DD). */
function dayType(iso: string): DayType {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay()
  if (dow === 0 || isHoliday(iso)) return 'sunday'
  return dow === 6 ? 'saturday' : 'weekday'
}

/**
 * Moving buses (from the bus timetables) and trains (illustrative interval per
 * line) for the timeline hour `t` (hours after `start`, a JST date at 00:00).
 */
export function VehiclesLayer({ start, t, playing, speed, bus, rail }: { start: string; t: number; playing: boolean; speed: number; bus: boolean; rail: RailLines | null }) {
  const trips = useJsonResource<TransportTripsFile>('transport_trips.json').data
  const canvas = useLeafletLayer(() => new VehicleCanvas({ bus: MODE_COLOUR.bus, train: RAIL_LINE_COLOUR }))
  const iso = new Date(Date.parse(`${start}T00:00:00+09:00`) + t * 3600000 + 9 * 3600000).toISOString().slice(0, 10)
  const day = dayType(iso)

  const buses = useMemo<BusTrip[]>(
    () => (bus && trips ? (trips.trips[day] ?? []).map(([, s, min]) => ({ pts: s.map((i) => trips.stops[i]), min })) : []),
    [bus, trips, day],
  )
  const runs = useMemo<RailRun[]>(
    () =>
      (rail?.lines ?? []).flatMap((l, li) =>
        l.service
          ? l.paths
              .map((path, pi) => ({ path, k: km(path), pi }))
              .filter((p) => p.k[p.k.length - 1] >= MIN_RUN_KM)
              .map((p) => ({
                key: `${l.id}:${p.pi}`,
                path: p.path,
                km: p.k,
                intervalMin: l.service!.interval_min,
                speedKmh: l.service!.speed_kmh,
                firstMin: hm(l.service!.first),
                lastMin: hm(l.service!.last),
                offsetMin: (li * 7) % l.service!.interval_min,
              }))
          : [],
      ),
    [rail],
  )

  useEffect(() => {
    canvas.setData(buses, runs)
  }, [canvas, buses, runs])

  useEffect(() => {
    // Paused: a minute a second (60x). Playing: the whole hour per timeline step.
    canvas.setClock((t % 24) * 60, playing ? (60 * speed) / STEP_S : 1)
  }, [canvas, t, playing, speed])

  return null
}
