import { CanvasOverlay } from './CanvasOverlay'

/** A soft radial blob: regional visitor density or a precipitation cell. */
export interface Blob {
  lat: number
  lon: number
  /** Radius on the ground, metres. */
  radius: number
  /** rgb triplet, e.g. '236,131,90' */
  rgb: string
  /** Peak opacity at the centre (0..1). */
  alpha: number
}

/**
 * Static field overlay drawn under the vector layers: blobs are blended with
 * 'screen' so neighbouring nodes merge into one regional glow instead of
 * stacking hard-edged circles.
 */
export class FieldCanvas extends CanvasOverlay {
  private blobs: Blob[] = []

  constructor(pane = 'dhde-field', z = 350) {
    super(pane, z)
  }

  setBlobs(b: Blob[]) {
    this.blobs = b
    this.redraw()
  }

  protected draw(ctx: CanvasRenderingContext2D) {
    const map = this._map
    const zoom = map.getZoom()
    ctx.globalCompositeOperation = 'screen'
    for (const b of this.blobs) {
      const p = this.toCanvas([b.lat, b.lon])
      const mpp = (40075016.686 * Math.cos((b.lat * Math.PI) / 180)) / Math.pow(2, zoom + 8)
      const r = Math.max(6, b.radius / mpp)
      if (p.x < -r || p.y < -r || p.x > this.size.x + r || p.y > this.size.y + r) continue
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
      g.addColorStop(0, `rgba(${b.rgb},${b.alpha})`)
      g.addColorStop(0.45, `rgba(${b.rgb},${b.alpha * 0.55})`)
      g.addColorStop(1, `rgba(${b.rgb},0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}
