import L from 'leaflet'
import { CanvasOverlay } from './CanvasOverlay'

/**
 * One stream of moving particles along a polyline: people on a road in one
 * direction, vehicles on a road segment, or passengers on the shinkansen.
 */
export interface Stream {
  key: string
  /** [lat, lon] in travel order. */
  path: [number, number][]
  colour: string
  kind: 'person' | 'vehicle' | 'rail'
  /** Particles per 100 screen px of route (proportional to volume). */
  density: number
  /** Screen px per second. */
  speed: number
  /** Lateral offset in px, positive = left of travel (Japan drives on the left). */
  lane: number
  /** Dot radius in px. */
  size: number
  /** Only draw between these fractions of the path (traffic segments). */
  from?: number
  to?: number
}

interface Live {
  def: Stream
  pts: L.Point[]
  cum: number[]
  len: number
  start: number
  end: number
  /** Distance along the path (px), within [start, end]. */
  parts: number[]
  acc: number
}

const MAX_PARTICLES = 2400

export class FlowCanvas extends CanvasOverlay {
  private streams = new Map<string, Live>()
  private raf = 0
  private last = 0
  private paused = false
  private reduced = false

  constructor() {
    super('dhde-flow', 450)
  }

  onAdd(map: L.Map): this {
    super.onAdd(map)
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    this.last = performance.now()
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - this.last) / 1000)
      this.last = t
      if (!this.paused && !this.reduced && !this.zooming) this.step(dt)
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

  setPaused(p: boolean) {
    this.paused = p
  }

  /** Replace the stream set. Streams with the same key keep their particles, so volume changes are smooth. */
  setStreams(defs: Stream[]) {
    const next = new Map<string, Live>()
    for (const def of defs) {
      const prev = this.streams.get(def.key)
      if (prev && prev.def.path === def.path) {
        prev.def = def
        this.clampRange(prev)
        next.set(def.key, prev)
      } else {
        const s: Live = { def, pts: [], cum: [], len: 0, start: 0, end: 0, parts: [], acc: 0 }
        if (this._map) {
          this.project(s)
          this.prefill(s)
        }
        next.set(def.key, s)
      }
    }
    this.streams = next
  }

  protected onZoomChanged() {
    for (const s of this.streams.values()) {
      const oldLen = s.len || 1
      const oldStart = s.start
      this.project(s)
      const k = s.len / oldLen
      s.parts = s.parts.map((p) => s.start + (p - oldStart) * k)
      if (s.parts.length === 0) this.prefill(s)
    }
  }

  private project(s: Live) {
    const map = this._map
    s.pts = s.def.path.map((ll) => map.latLngToLayerPoint(ll))
    s.cum = [0]
    for (let i = 1; i < s.pts.length; i++) s.cum.push(s.cum[i - 1] + s.pts[i].distanceTo(s.pts[i - 1]))
    s.len = s.cum[s.cum.length - 1]
    this.clampRange(s)
  }

  private clampRange(s: Live) {
    s.start = (s.def.from ?? 0) * s.len
    s.end = (s.def.to ?? 1) * s.len
  }

  private prefill(s: Live) {
    const span = s.end - s.start
    const n = Math.round((s.def.density / 100) * span)
    s.parts = []
    for (let i = 0; i < n; i++) s.parts.push(s.start + ((i + Math.random() * 0.8) / Math.max(1, n)) * span)
  }

  private total(): number {
    let t = 0
    for (const s of this.streams.values()) t += s.parts.length
    return t
  }

  private step(dt: number) {
    const budget = MAX_PARTICLES - this.total()
    let spawned = 0
    for (const s of this.streams.values()) {
      const v = s.def.speed
      for (let i = 0; i < s.parts.length; i++) s.parts[i] += v * dt
      s.parts = s.parts.filter((p) => p <= s.end)
      s.acc += (s.def.density / 100) * v * dt
      while (s.acc >= 1) {
        s.acc -= 1
        if (spawned < budget) {
          s.parts.push(s.start + Math.random() * v * dt)
          spawned++
        }
      }
    }
  }

  /** Position and unit direction at distance d along the stream. */
  private at(s: Live, d: number): [number, number, number, number] {
    const c = s.cum
    let lo = 0
    let hi = c.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (c[mid] <= d) lo = mid
      else hi = mid
    }
    const a = s.pts[lo]
    const b = s.pts[hi] ?? a
    const seg = c[hi] - c[lo] || 1
    const f = Math.max(0, Math.min(1, (d - c[lo]) / seg))
    const dx = (b.x - a.x) / seg
    const dy = (b.y - a.y) / seg
    return [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, dx, dy]
  }

  protected draw(ctx: CanvasRenderingContext2D) {
    const ox = this.origin.x
    const oy = this.origin.y
    const w = this.size.x
    const h = this.size.y
    ctx.lineCap = 'round'
    for (const s of this.streams.values()) {
      if (s.parts.length === 0 || s.pts.length < 2) continue
      const { colour, size, lane, kind } = s.def
      const tail = kind === 'vehicle' ? size * 2.2 : size * 4.5
      const heads: number[] = []
      ctx.beginPath()
      for (const d of s.parts) {
        const [x, y, dx, dy] = this.at(s, d)
        // Left normal in screen space (y down): (dy, -dx).
        const px = x + dy * lane - ox
        const py = y - dx * lane - oy
        if (px < -20 || py < -20 || px > w + 20 || py > h + 20) continue
        ctx.moveTo(px, py)
        ctx.lineTo(px - dx * tail, py - dy * tail)
        heads.push(px, py)
      }
      ctx.strokeStyle = colour
      ctx.globalAlpha = kind === 'vehicle' ? 0.55 : 0.4
      ctx.lineWidth = size * 1.3
      ctx.stroke()
      ctx.globalAlpha = 1
      // Heads: a dark halo keeps them readable over imagery, then the colour.
      ctx.beginPath()
      for (let i = 0; i < heads.length; i += 2) {
        ctx.moveTo(heads[i] + size + 1.2, heads[i + 1])
        ctx.arc(heads[i], heads[i + 1], size + 1.2, 0, Math.PI * 2)
      }
      ctx.fillStyle = 'rgba(5,10,20,0.55)'
      ctx.fill()
      ctx.beginPath()
      for (let i = 0; i < heads.length; i += 2) {
        ctx.moveTo(heads[i] + size, heads[i + 1])
        ctx.arc(heads[i], heads[i + 1], size, 0, Math.PI * 2)
      }
      ctx.fillStyle = colour
      ctx.fill()
    }
  }
}
