import type L from 'leaflet'
import { CanvasOverlay } from './CanvasOverlay'

/** One site's people: how many figures, their colour, and where the site's circle ends. */
export interface PresenceSite {
  lat: number
  lon: number
  dots: number
  colour: string
  /** Inner edge of the band, in pixels from the site (just outside its circle). */
  inner: number
}

/** How far a figure walks, in pixels: in from the band's outer edge, or out from the circle. */
const WALK = 34
const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** A repeatable pseudo-random number in [0, 1) for a site, figure and cycle. */
function rand(a: number, b: number, c: number, salt: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + salt * 19.3) * 43758.5453
  return x - Math.floor(x)
}

/** A small person (head and body), about 15px tall, centred on x/y, with a light outline. */
function person(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath()
  ctx.arc(x, y - 4.8, 2.8, 0, Math.PI * 2)
  ctx.moveTo(x - 3.9, y + 6.9)
  ctx.lineTo(x - 3.9, y + 0.9)
  ctx.quadraticCurveTo(x - 3.9, y - 1.4, x, y - 1.4)
  ctx.quadraticCurveTo(x + 3.9, y - 1.4, x + 3.9, y + 0.9)
  ctx.lineTo(x + 3.9, y + 6.9)
  ctx.closePath()
  ctx.stroke()
  ctx.fill()
}

/**
 * People at each site: small figures that walk in towards the site and fade as they arrive,
 * or walk out and fade as they leave. How many follows the site's daily visitor figure; where
 * each one appears is illustrative (a fresh spot each cycle), not a tracked position.
 */
export class PresenceCanvas extends CanvasOverlay {
  private sites: PresenceSite[] = []
  private raf = 0

  constructor() {
    super('dhde-presence', 495)
  }

  onAdd(map: L.Map): this {
    super.onAdd(map)
    if (!REDUCED_MOTION) {
      const loop = () => {
        this.redraw()
        this.raf = requestAnimationFrame(loop)
      }
      this.raf = requestAnimationFrame(loop)
    }
    return this
  }

  onRemove(map: L.Map): this {
    cancelAnimationFrame(this.raf)
    return super.onRemove(map)
  }

  setData(sites: PresenceSite[]) {
    this.sites = sites
    this.redraw()
  }

  protected draw(ctx: CanvasRenderingContext2D) {
    const now = performance.now() / 1000
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineJoin = 'round'
    this.sites.forEach((s, si) => {
      const c = this.toCanvas([s.lat, s.lon])
      if (c.x < -80 || c.y < -80 || c.x > this.size.x + 80 || c.y > this.size.y + 80) return
      ctx.fillStyle = s.colour
      for (let i = 0; i < s.dots; i++) {
        // Each figure takes 3 to 5 seconds to walk, then starts again somewhere new.
        const period = 3 + rand(si, i, 0, 1) * 2
        const t = REDUCED_MOTION ? 0.5 : now / period + rand(si, i, 0, 2)
        const cycle = Math.floor(t)
        const life = t - cycle
        const arriving = i % 2 === 0
        const angle = rand(si, i, cycle, 3) * Math.PI * 2
        // Arriving: from the outer edge in to the circle. Leaving: from the circle out.
        const dist = s.inner + 6 + WALK * (arriving ? 1 - life : life)
        // Fade in at the start of the walk and out at its end, so figures appear and disappear.
        ctx.globalAlpha = Math.min(1, Math.sin(Math.PI * life) * 3)
        person(ctx, c.x + Math.cos(angle) * dist, c.y + Math.sin(angle) * dist)
      }
    })
    ctx.globalAlpha = 1
  }
}
