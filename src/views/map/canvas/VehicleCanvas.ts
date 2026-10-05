import type L from 'leaflet'
import { CanvasOverlay } from './CanvasOverlay'
import { vehicleClock } from '../../../lib/vehicleClock'
import { trainsAt } from '../../../lib/railModel'
import type { RailRun } from '../../../lib/railModel'

const PULSE_MS = 1600
const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** A bus trip: stop positions and the departure minute at each, in calling order. */
export interface BusTrip {
  pts: [number, number][]
  min: number[]
}

export interface VehicleStyle {
  bus: string
  train: string
}

/**
 * Moving buses and trains on vehicleClock: buses where their timetable puts them
 * (straight between stops), trains on the illustrative rail model (lib/railModel),
 * stopping at stations.
 */
export class VehicleCanvas extends CanvasOverlay {
  private buses: BusTrip[] = []
  private rail: RailRun[] = []
  private legCache = new Map()
  private style: VehicleStyle
  private raf = 0

  constructor(style: VehicleStyle) {
    super('dhde-vehicles', 465)
    this.style = style
  }

  onAdd(map: L.Map): this {
    super.onAdd(map)
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
    if (rail !== this.rail) this.legCache = new Map()
    this.rail = rail
  }

  protected draw(ctx: CanvasRenderingContext2D) {
    const m = vehicleClock.minute()
    const w = this.size.x
    const h = this.size.y
    // A ring pulsing out of every vehicle, so they stand out from the stops and track
    // even when live (real speed barely moves them at prefecture zoom).
    const pulse = REDUCED_MOTION ? -1 : (performance.now() % PULSE_MS) / PULSE_MS
    const dot = (p: L.Point, r: number, fill: string, ring: string, ringW: number) => {
      if (p.x < -20 || p.y < -20 || p.x > w + 20 || p.y > h + 20) return
      if (pulse >= 0) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, r + ringW + pulse * 6, 0, Math.PI * 2)
        ctx.strokeStyle = fill
        ctx.globalAlpha = 0.45 * (1 - pulse)
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      ctx.beginPath()
      ctx.arc(p.x, p.y, r + ringW, 0, Math.PI * 2)
      ctx.fillStyle = ring
      ctx.fill()
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
    }

    for (const r of this.rail) for (const ll of trainsAt(r, m, this.legCache)) dot(this.toCanvas(ll), 4.5, this.style.train, '#ffffff', 1.5)

    for (const b of this.buses) {
      const n = b.min.length
      if (m < b.min[0] || m > b.min[n - 1]) continue
      let i = 0
      while (i < n - 2 && b.min[i + 1] <= m) i++
      const span = b.min[i + 1] - b.min[i]
      const f = span > 0 ? Math.min(1, (m - b.min[i]) / span) : 0
      const a = b.pts[i]
      const c = b.pts[i + 1]
      dot(this.toCanvas([a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f]), 3.5, this.style.bus, '#ffffff', 1.2)
    }
  }
}
