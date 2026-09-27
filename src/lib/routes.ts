import type { RouteDef, RoutesFile } from '../types/routes'

const reversed = new WeakMap<[number, number][], [number, number][]>()

/** Stable reversed copy of a path (same array every call, so particle streams keep their state). */
export function reversePath(p: [number, number][]): [number, number][] {
  let r = reversed.get(p)
  if (!r) {
    r = p.slice().reverse()
    reversed.set(p, r)
  }
  return r
}

export function routeById(routes: RoutesFile | null, id: string): RouteDef | undefined {
  return routes?.routes.find((r) => r.id === id)
}

export function routesTouching(routes: RoutesFile | null, nodeId: string): RouteDef[] {
  return (routes?.routes ?? []).filter((r) => (r.from === nodeId || r.to === nodeId) && r.kind !== 'alternate')
}

/** Slice of a path between two length fractions (for coloured traffic segments). */
export function slicePath(path: [number, number][], from: number, to: number): [number, number][] {
  if (path.length < 2) return path
  const cum = [0]
  for (let i = 1; i < path.length; i++) {
    const [a, b] = path[i - 1]
    const [c, d] = path[i]
    const dy = c - a
    const dx = (d - b) * Math.cos((a * Math.PI) / 180)
    cum.push(cum[i - 1] + Math.hypot(dx, dy))
  }
  const total = cum[cum.length - 1]
  const s = from * total
  const e = to * total
  const lerp = (i: number, x: number): [number, number] => {
    const f = (x - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)
    return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f]
  }
  const out: [number, number][] = []
  for (let i = 1; i < path.length; i++) {
    if (cum[i] < s) continue
    if (out.length === 0) out.push(cum[i - 1] >= s ? path[i - 1] : lerp(i, s))
    if (cum[i] >= e) {
      out.push(lerp(i, e))
      break
    }
    out.push(path[i])
  }
  return out
}
