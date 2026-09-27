import L from 'leaflet'

/**
 * A full-viewport <canvas> living in its own Leaflet pane. Drawing uses layer-pixel
 * coordinates minus the canvas origin, so panning only needs a redraw (no
 * re-projection) and projected geometry can be cached per zoom level.
 *
 * Subclasses implement draw(). Animated overlays call requestRedraw() each frame.
 */
export abstract class CanvasOverlay extends L.Layer {
  protected canvas: HTMLCanvasElement | null = null
  protected ctx: CanvasRenderingContext2D | null = null
  protected origin = L.point(0, 0)
  protected size = L.point(0, 0)
  protected dpr = 1
  protected zooming = false
  private paneName: string
  private paneZ: number

  constructor(paneName: string, paneZ: number) {
    super()
    this.paneName = paneName
    this.paneZ = paneZ
  }

  onAdd(map: L.Map): this {
    let pane = map.getPane(this.paneName)
    if (!pane) {
      pane = map.createPane(this.paneName)
      pane.style.zIndex = String(this.paneZ)
      pane.style.pointerEvents = 'none'
    }
    const c = L.DomUtil.create('canvas', 'dhde-canvas') as HTMLCanvasElement
    c.style.position = 'absolute'
    c.style.pointerEvents = 'none'
    pane.appendChild(c)
    this.canvas = c
    this.ctx = c.getContext('2d')
    map.on('moveend resize', this.reset, this)
    map.on('zoomstart', this.onZoomStart, this)
    map.on('zoomend viewreset', this.onZoomEnd, this)
    this.reset()
    return this
  }

  onRemove(map: L.Map): this {
    map.off('moveend resize', this.reset, this)
    map.off('zoomstart', this.onZoomStart, this)
    map.off('zoomend viewreset', this.onZoomEnd, this)
    this.canvas?.remove()
    this.canvas = null
    this.ctx = null
    return this
  }

  private onZoomStart() {
    this.zooming = true
    if (this.canvas) this.canvas.style.visibility = 'hidden'
  }

  private onZoomEnd() {
    this.zooming = false
    this.onZoomChanged()
    this.reset()
    if (this.canvas) this.canvas.style.visibility = 'visible'
  }

  /** Called when projected geometry must be recomputed (new zoom). */
  protected onZoomChanged() {}

  protected reset() {
    const map = this._map
    if (!map || !this.canvas) return
    const size = map.getSize()
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.size = size
    this.origin = map.containerPointToLayerPoint([0, 0])
    L.DomUtil.setPosition(this.canvas, this.origin)
    this.canvas.width = Math.round(size.x * this.dpr)
    this.canvas.height = Math.round(size.y * this.dpr)
    this.canvas.style.width = size.x + 'px'
    this.canvas.style.height = size.y + 'px'
    this.redraw()
  }

  redraw() {
    if (!this.ctx || !this._map || this.zooming) return
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.size.x, this.size.y)
    this.draw(ctx)
  }

  /** Layer point of a lat/lng relative to the canvas origin. */
  protected toCanvas(latlng: L.LatLngExpression): L.Point {
    return this._map.latLngToLayerPoint(latlng).subtract(this.origin)
  }

  protected abstract draw(ctx: CanvasRenderingContext2D): void
}
