/**
 * Illustrative train service on the map (rail timetables are not open data):
 * each line's trains leave both ends every `interval_min` from `first` to `last`,
 * run at `speed_kmh` along the real track (MLIT railway data) and stop for
 * DWELL_MIN at every station on the way. Used for the moving trains and for a
 * station's "next trains" list, which are labelled illustrative.
 */
import type { RailLines } from '../types/transport'

/** Rail paths shorter than this (spurs, twin-track pieces) get no trains. */
export const MIN_RUN_KM = 15
const DWELL_MIN = 0.5
/** A station counts as on a path when within this of its track. */
const STATION_SNAP_KM = 0.6

export interface RailStop {
  id: string
  name: string
  km: number
}

export interface RailRun {
  key: string
  lineId: string
  lineName: [string, string]
  path: [number, number][]
  km: number[]
  /** Stations on this path, in path order. */
  stops: RailStop[]
  intervalMin: number
  speedKmh: number
  firstMin: number
  lastMin: number
  offsetMin: number
}

const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))

function cumKm(path: [number, number][]): number[] {
  const out = [0]
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]]
    const dy = (b[0] - a[0]) * 111.2
    const dx = (b[1] - a[1]) * 111.2 * Math.cos((a[0] * Math.PI) / 180)
    out.push(out[i - 1] + Math.hypot(dx, dy))
  }
  return out
}

export function buildRuns(rail: RailLines | null | undefined): RailRun[] {
  if (!rail) return []
  return rail.lines.flatMap((l, li) => {
    const svc = l.service
    if (!svc) return []
    return l.paths.flatMap((path, pi) => {
      const km = cumKm(path)
      if (km[km.length - 1] < MIN_RUN_KM) return []
      const stops: RailStop[] = []
      for (const s of rail.stations) {
        if (!s.lines.includes(l.id)) continue
        let best = Infinity
        let at = 0
        for (let i = 0; i < path.length; i++) {
          const dy = (path[i][0] - s.lat) * 111.2
          const dx = (path[i][1] - s.lon) * 111.2 * Math.cos((s.lat * Math.PI) / 180)
          const d = Math.hypot(dx, dy)
          if (d < best) {
            best = d
            at = km[i]
          }
        }
        if (best <= STATION_SNAP_KM) stops.push({ id: s.id, name: s.name_ja, km: at })
      }
      stops.sort((a, b) => a.km - b.km)
      return [
        {
          key: `${l.id}:${pi}`,
          lineId: l.id,
          lineName: [l.name, l.name_ja] as [string, string],
          path,
          km,
          stops,
          intervalMin: svc.interval_min,
          speedKmh: svc.speed_kmh,
          firstMin: hm(svc.first),
          lastMin: hm(svc.last),
          offsetMin: (li * 7) % svc.interval_min,
        },
      ]
    })
  })
}

/** One trip's timing: distance (km from its origin) and minutes after departure, at each stop, arrive and leave. */
interface Leg {
  d: number
  arr: number
  dep: number
}

function legs(r: RailRun, dir: 0 | 1): Leg[] {
  const total = r.km[r.km.length - 1]
  const ds = r.stops.map((s) => (dir ? total - s.km : s.km)).filter((d) => d > 0.05 && d < total - 0.05)
  ds.sort((a, b) => a - b)
  const out: Leg[] = [{ d: 0, arr: 0, dep: 0 }]
  for (const d of [...ds, total]) {
    const prev = out[out.length - 1]
    const arr = prev.dep + ((d - prev.d) / r.speedKmh) * 60
    out.push({ d, arr, dep: d === total ? arr : arr + DWELL_MIN })
  }
  return out
}

function departures(r: RailRun, dir: 0 | 1): number[] {
  const first = r.firstMin + r.offsetMin + (dir ? r.intervalMin / 2 : 0)
  const out: number[] = []
  for (let t0 = first; t0 <= r.lastMin; t0 += r.intervalMin) out.push(t0)
  return out
}

/** [lat, lon] at a distance (km) along a path. */
function along(r: RailRun, d: number): [number, number] {
  const k = r.km
  let lo = 0
  let hi = k.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (k[mid] <= d) lo = mid
    else hi = mid
  }
  const seg = k[hi] - k[lo] || 1
  const f = Math.max(0, Math.min(1, (d - k[lo]) / seg))
  const a = r.path[lo]
  const b = r.path[hi]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

/** Every train on the run at minute m (after midnight), as [lat, lon]. */
export function trainsAt(r: RailRun, m: number, cache: Map<string, Leg[]>): [number, number][] {
  const total = r.km[r.km.length - 1]
  const out: [number, number][] = []
  for (const dir of [0, 1] as const) {
    const key = `${r.key}:${dir}`
    let L = cache.get(key)
    if (!L) {
      L = legs(r, dir)
      cache.set(key, L)
    }
    const run = L[L.length - 1].arr
    for (const t0 of departures(r, dir)) {
      const x = m - t0
      if (x < 0 || x > run) continue
      let i = 0
      while (i < L.length - 1 && L[i + 1].arr <= x) i++
      let d: number
      if (x <= L[i].dep) d = L[i].d // standing at a station
      else {
        const nxt = L[Math.min(i + 1, L.length - 1)]
        const span = nxt.arr - L[i].dep || 1
        d = L[i].d + ((x - L[i].dep) / span) * (nxt.d - L[i].d)
      }
      out.push(along(r, dir ? total - d : d))
    }
  }
  return out
}

/** The next trains leaving a station after minute m, across every run serving it. */
export function nextTrains(runs: RailRun[], stationId: string, m: number, n = 6): { min: number; line: [string, string]; to: string }[] {
  const out: { min: number; line: [string, string]; to: string }[] = []
  for (const r of runs) {
    const s = r.stops.find((x) => x.id === stationId)
    if (!s) continue
    const total = r.km[r.km.length - 1]
    for (const dir of [0, 1] as const) {
      const d = dir ? total - s.km : s.km
      if (d >= total - 0.05) continue // a train's last stop: nothing leaves from here in this direction
      const L = legs(r, dir)
      const leg = L.reduce((best, x) => (Math.abs(x.d - d) < Math.abs(best.d - d) ? x : best), L[0])
      const ends = dir ? r.stops[0] : r.stops[r.stops.length - 1]
      for (const t0 of departures(r, dir)) {
        const at = t0 + leg.dep
        if (at >= m) out.push({ min: at, line: r.lineName, to: ends?.name ?? '' })
      }
    }
  }
  return out.sort((a, b) => a.min - b.min).slice(0, n)
}
