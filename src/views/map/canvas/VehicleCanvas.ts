import type L from 'leaflet'
import { CanvasOverlay } from './CanvasOverlay'

/** A bus trip: stop positions and the departure minute at each, in calling order. */
export interface BusTrip {
  pts: [number, number][]
  min: number[]
}

/** A railway path with the illustrative service run on it. */
export interface RailRun {
  key: string
  path: [number, number][]
  /** Cumulative km along the path, same length as path. */
  km: number[]
  intervalMin: number
  speedKmh: number
  firstMin: number
  lastMin: number
  /** Minutes added to every departure, so lines don't all leave on the hour together. */
  offsetMin: number
}

export interface VehicleStyle {
  bus: string
  train: string
}

/**
 * Moving buses and trains. The clock runs through one timeline hour: a minute a
 * second while the timeline is paused (60x), or the whole hour per timeline step
 * while it plays. Buses sit where their timetable puts them (straight between
 * stops); trains run at an illustrative interval and speed per line.
 */
export class VehicleCanvas extends CanvasOverlay {
  private buses: BusTrip[] = []
  private rail: RailRun[] = []
  private style: VehicleStyle
  private hourMin = 0
  private rate = 1
  private anchor = performance.now()
  private raf = 0
  private reduced = false

  constructor(style: VehicleStyle) {
    super('dhde-vehicles', 465)
    this.style = style
  }

  onAdd(map: L.Map): this {
    super.onAdd(map)
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const loop = () => {
      this.redraw()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
    return this
  }

  onRemove(map: L.Map): this {
    cancelAnimationFrame(this.raf)
    return super.onRemove(map)
  }

  setData(buses: BusTrip[], rail: RailRun[]) {
    this.buses = buses
    this.rail = rail
  }

  /** Start of the shown hour (minutes after midnight) and clock speed (simulated minutes per real second). */
  setClock(hourMin: number, rate: number) {
    if (hourMin !== this.hourMin) this.anchor = performance.now()
    this.hourMin = hourMin
    this.rate = rate
  }

  /** The simulated minute now; frozen at the top of the hour for reduced motion. */
  minute(): number {
    if (this.reduced) return this.hourMin
    const elapsed = ((performance.now() - this.anchor) / 1000) * this.rate
    return this.hourMin + (elapsed % 60)
  }

  protected draw(ctx: CanvasRenderingContext2D) {
    const m = this.minute()
    const w = this.size.x
    const h = this.size.y
    const dot = (p: L.Point, r: number, fill: string, ring: string, ringW: number) => {
      if (p.x < -10 || p.y < -10 || p.x > w + 10 || p.y > h + 10) return
      ctx.beginPath()
      ctx.arc(p.x, p.y, r + ringW, 0, Math.PI * 2)
      ctx.fillStyle = ring
      ctx.fill()
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
    }

    for (const r of this.rail) {
      const total = r.km[r.km.length - 1]
      const runMin = (total / r.speedKmh) * 60
      for (const dir of [0, 1]) {
        // The two directions are half an interval apart.
        const first = r.firstMin + r.offsetMin + (dir ? r.intervalMin / 2 : 0)
        for (let t0 = first; t0 <= r.lastMin; t0 += r.intervalMin) {
          if (m < t0 || m > t0 + runMin) continue
          const d = ((m - t0) / runMin) * total
          dot(this.toCanvas(along(r, dir ? total - d : d)), 6, this.style.train, '#ffffff', 2)
        }
      }
    }

    for (const b of this.buses) {
      const n = b.min.length
      if (m < b.min[0] || m > b.min[n - 1]) continue
      let i = 0
      while (i < n - 2 && b.min[i + 1] <= m) i++
      const span = b.min[i + 1] - b.min[i]
      const f = span > 0 ? Math.min(1, (m - b.min[i]) / span) : 0
      const a = b.pts[i]
      const c = b.pts[i + 1]
      dot(this.toCanvas([a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f]), 5, this.style.bus, '#ffffff', 1.5)
    }
  }
}

/** [lat, lon] at a distance (km) along a rail path. */
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
