import type L from 'leaflet'
import { CanvasOverlay } from './CanvasOverlay'

/** One site's dots: how many, their colour, and the ring they appear in around the site's circle. */
export interface PresenceSite {
  lat: number
  lon: number
  dots: number
  colour: string
  /** Inner edge of the ring, in pixels from the site (just outside its circle). */
  inner: number
}

const RING = 26
const DOT_R = 2.8
const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** A repeatable pseudo-random number in [0, 1) for a site, dot and cycle. */
function rand(a: number, b: number, c: number, salt: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + salt * 19.3) * 43758.5453
  return x - Math.floor(x)
}

/**
 * People at each site, drawn as dots that fade in and out around it: people arriving and
 * leaving. The number of dots follows the site's daily visitor figure; where each dot appears
 * is illustrative (a fresh random spot each cycle), not a tracked position.
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
    this.sites.forEach((s, si) => {
      const c = this.toCanvas([s.lat, s.lon])
      if (c.x < -60 || c.y < -60 || c.x > this.size.x + 60 || c.y > this.size.y + 60) return
      ctx.fillStyle = s.colour
      for (let i = 0; i < s.dots; i++) {
        // Each dot lives 3 to 6 seconds, fading in then out, and reappears somewhere new.
        const period = 3 + rand(si, i, 0, 1) * 3
        const t = REDUCED_MOTION ? 0.5 : now / period + rand(si, i, 0, 2)
        const cycle = Math.floor(t)
        const life = t - cycle
        const angle = rand(si, i, cycle, 3) * Math.PI * 2
        const dist = s.inner + Math.sqrt(rand(si, i, cycle, 4)) * RING
        ctx.globalAlpha = 0.85 * Math.sin(Math.PI * life)
        ctx.beginPath()
        ctx.arc(c.x + Math.cos(angle) * dist, c.y + Math.sin(angle) * dist, DOT_R, 0, Math.PI * 2)
        ctx.fill()
      }
    })
    ctx.globalAlpha = 1
  }
}
