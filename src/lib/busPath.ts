/**
 * Moving buses follow the drawn bus line (the operator's GTFS shape) rather than
 * cutting straight between stops: each stop of a trip is placed at a distance
 * along its route's line, and the bus moves along the line between them.
 */

/** A trip's stops placed on its route's line: km along the line at each stop. */
export interface SnappedTrip {
  path: [number, number][]
  /** Cumulative km at each path point. */
  cum: number[]
  /** km along the path at each stop, in calling order (falls when the trip runs the line backwards); NaN for a stop off the line. */
  d: number[]
}

/** A stop further than this from its line (km) is off it (a short spur the shape leaves out): the legs to and from it run straight. */
const MAX_SNAP_KM = 0.35
/** When the line passes a stop more than once (loops), take the first pass within this of the closest (km). */
const TIE_KM = 0.05

const kmScale = (lat: number) => [111.2, 111.2 * Math.cos((lat * Math.PI) / 180)] as const

function cumKm(path: [number, number][]): number[] {
  const out = [0]
  for (let i = 1; i < path.length; i++) {
    const [ky, kx] = kmScale(path[i - 1][0])
    out.push(out[i - 1] + Math.hypot((path[i][0] - path[i - 1][0]) * ky, (path[i][1] - path[i - 1][1]) * kx))
  }
  return out
}

/** Closest point on segment i to p: its distance from p and its km along the path. */
function onSegment(path: [number, number][], cum: number[], i: number, p: [number, number]): { dist: number; at: number } {
  const [ky, kx] = kmScale(p[0])
  const ax = (path[i][1] - p[1]) * kx
  const ay = (path[i][0] - p[0]) * ky
  const bx = (path[i + 1][1] - p[1]) * kx
  const by = (path[i + 1][0] - p[0]) * ky
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const f = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0
  return { dist: Math.hypot(ax + dx * f, ay + dy * f), at: cum[i] + (cum[i + 1] - cum[i]) * f }
}

/** Place stops along the path in order, walking forwards (or backwards) so loops resolve to the right pass. */
function place(path: [number, number][], cum: number[], stops: [number, number][], backwards: boolean): { d: number[]; err: number } | null {
  const n = path.length - 1
  const d: number[] = []
  let err = 0
  let from = backwards ? n - 1 : 0
  for (const s of stops) {
    const cands: { seg: number; dist: number; at: number }[] = []
    if (backwards) for (let i = from; i >= 0; i--) cands.push({ seg: i, ...onSegment(path, cum, i, s) })
    else for (let i = from; i < n; i++) cands.push({ seg: i, ...onSegment(path, cum, i, s) })
    if (!cands.length) return null
    const best = Math.min(...cands.map((c) => c.dist))
    if (best > MAX_SNAP_KM) {
      d.push(NaN)
      continue
    }
    const pick = cands.find((c) => c.dist <= best + TIE_KM)!
    d.push(pick.at)
    err += pick.dist
    from = pick.seg
  }
  return { d, err }
}

/** A trip's stops on its line, or null when they don't sit on it (then the caller draws straight legs). */
export function snapTrip(path: [number, number][], stops: [number, number][]): SnappedTrip | null {
  if (path.length < 2 || stops.length < 2) return null
  const cum = cumKm(path)
  const fwd = place(path, cum, stops, false)
  const bwd = place(path, cum, stops, true)
  // Prefer the direction that puts more stops on the line, then the closer fit.
  const onLine = (x: { d: number[] } | null) => (x ? x.d.filter((v) => !Number.isNaN(v)).length : -1)
  const best = !fwd || !bwd ? (fwd ?? bwd) : onLine(fwd) !== onLine(bwd) ? (onLine(fwd) > onLine(bwd) ? fwd : bwd) : fwd.err <= bwd.err ? fwd : bwd
  // Mostly off the line: it isn't this trip's road after all.
  if (!best || onLine(best) < Math.max(2, stops.length * 0.8)) return null
  return { path, cum, d: best.d }
}

/** [lat, lon] at km `at` along a snapped trip's path. */
export function alongPath(t: SnappedTrip, at: number): [number, number] {
  const k = t.cum
  let lo = 0
  let hi = k.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (k[mid] <= at) lo = mid
    else hi = mid
  }
  const seg = k[hi] - k[lo] || 1
  const f = Math.max(0, Math.min(1, (at - k[lo]) / seg))
  const a = t.path[lo]
  const b = t.path[hi]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}
