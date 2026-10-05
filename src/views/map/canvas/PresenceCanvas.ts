import type L from 'leaflet'
import { CanvasOverlay } from './CanvasOverlay'

/** One site's people: how many dots, their colour, and where the site's circle ends. */
export interface PresenceSite {
  lat: number
  lon: number
  dots: number
  colour: string
  /** Inner edge of the band, in pixels from the site (just outside its circle). */
  inner: number
  /**
   * Coastal sites: where people come from and go to (Fukui Station, inland), so no one walks in
   * from the sea. Others: null, people come and go all around.
   */
  toward: [number, number] | null
}

/** How far a dot travels at the reference zoom, in pixels. */
const WALK = 30
const DOT_R = 3
/** The zoom the sizes above are for; dots and paths shrink when zoomed out and grow when zoomed in. */
const REF_ZOOM = 10.5
/** Half-width of the land-side fan at coastal sites, in radians (75 degrees). */
const FAN = (75 * Math.PI) / 180
const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** A repeatable pseudo-random number in [0, 1) for a site, dot and cycle. */
function rand(a: number, b: number, c: number, salt: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + salt * 19.3) * 43758.5453
  return x - Math.floor(x)
}

/**
 * People at each site, as dots in the site's colour (like the other site marks): half move in
 * towards the site and fade as they arrive, half move out and fade as they leave. How many follows
 * the site's daily visitor figure; where each one appears is illustrative (a fresh spot each
 * cycle), not a tracked position. Sizes follow the zoom, so zoomed out the crowd stays close and
 * small, and zoomed in it spreads out.
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
    const k = Math.min(1.7, Math.max(0.45, Math.pow(2, (this._map.getZoom() - REF_ZOOM) * 0.8)))
    const walk = WALK * k
    const r = DOT_R * Math.sqrt(k)
    // Dots never draw inside an open hover card (some browsers let an animated canvas show
    // through it): the cards' boxes in canvas coordinates, with a little margin.
    const origin = this._map.getContainer().getBoundingClientRect()
    const cards = [...document.querySelectorAll<HTMLElement>('.leaflet-tooltip, .leaflet-popup')]
      .map((e) => e.getBoundingClientRect())
      .filter((b) => b.width > 0)
      .map((b) => ({ l: b.left - origin.left - 8, t: b.top - origin.top - 8, r: b.right - origin.left + 8, b: b.bottom - origin.top + 8 }))
    const hidden = (x: number, y: number) => cards.some((c) => x > c.l && x < c.r && y > c.t && y < c.b)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    this.sites.forEach((s, si) => {
      const c = this.toCanvas([s.lat, s.lon])
      if (c.x < -80 || c.y < -80 || c.x > this.size.x + 80 || c.y > this.size.y + 80) return
      // Coastal sites: a fan pointing inland (towards Fukui Station on screen).
      let centre = 0
      let spread = Math.PI
      if (s.toward) {
        const h = this.toCanvas(s.toward)
        centre = Math.atan2(h.y - c.y, h.x - c.x)
        spread = FAN
      }
      ctx.fillStyle = s.colour
      for (let i = 0; i < s.dots; i++) {
        // Each dot takes 3 to 5 seconds, then starts again somewhere new.
        const period = 3 + rand(si, i, 0, 1) * 2
        const t = REDUCED_MOTION ? 0.5 : now / period + rand(si, i, 0, 2)
        const cycle = Math.floor(t)
        const life = t - cycle
        const arriving = i % 2 === 0
        const angle = centre + (rand(si, i, cycle, 3) * 2 - 1) * spread
        // Arriving: from the outer edge in to the circle. Leaving: from the circle out.
        const dist = s.inner + 3 * k + walk * (arriving ? 1 - life : life)
        const x = c.x + Math.cos(angle) * dist
        const y = c.y + Math.sin(angle) * dist
        if (hidden(x, y)) continue
        // Fade in at the start and out at the end, so dots appear and disappear.
        ctx.globalAlpha = Math.min(1, Math.sin(Math.PI * life) * 2.5)
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    })
    ctx.globalAlpha = 1
  }
}
