import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/** Space kept between a badge and whatever it was moved off. */
const GAP = 3
/** How far a badge may move: this many of its own heights up or down, and up to one width sideways. */
const MAX_STEPS = 7
/** A badge moved further than this gets a thin line back to its site. */
const LEADER_MIN = 18
/** The UI drawn over the map: badges and site names never sit under it. */
const UI = ['.map-left > *', '.map-right > *', '.status-strip', '.map-bottom', '.leaflet-control-zoom', '.leaflet-control-attribution']

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
const shift = (r: Box, dx: number, dy: number): Box => ({ left: r.left + dx, right: r.right + dx, top: r.top + dy, bottom: r.bottom + dy })
const visible = (r: DOMRect) => r.width > 0 && r.height > 0

/**
 * Keeps the map's badges readable when several layers are on. Sites like Tojinbo
 * and Awara Onsen sit a few kilometres apart, so each layer's badge (weather,
 * hotels, reviews, survey, search intent, social, nudges) lands on the others'
 * and on the site names. After every draw, zoom or layer change this:
 *   1. flips a site name to the node's other side when it runs off the map or
 *      under a panel (Katsuyama on a phone, or next to the right-hand board);
 *   2. moves each badge, top to bottom, to the nearest free spot (up, down, then
 *      sideways) clear of the names, the badges already placed and the panels.
 * Badges move with CSS `translate`, so Leaflet's own positioning and the
 * markers' hover cards and clicks are untouched. A badge that moved far gets a
 * thin line back to its site, so it's clear which site it belongs to.
 */
export function Declutter() {
  const map = useMap()
  useEffect(() => {
    const root = map.getContainer()
    let raf = 0
    let timer = 0

    const run = () => {
      for (const l of root.querySelectorAll('.dc-leader')) l.remove()
      // Each icon's own content: its first child that isn't one of our leader lines.
      const icons = [...root.querySelectorAll<HTMLElement>('.leaflet-marker-icon.map-divicon')]
        .map((icon) => [...icon.children].find((c) => !c.classList.contains('dc-leader')) as HTMLElement | undefined)
        .filter((el): el is HTMLElement => el !== undefined)
      const labels = icons.filter((el) => el.classList.contains('node-tag'))
      const badges = icons.filter((el) => !el.classList.contains('node-tag'))

      // Start from where the layers put things.
      for (const el of badges) el.style.translate = ''
      for (const el of labels) {
        const orig = el.dataset.dir
        if (orig) {
          el.classList.remove('dir-left', 'dir-right')
          el.classList.add(orig)
        }
      }

      const mapBox = root.getBoundingClientRect()
      const ui: Box[] = UI.flatMap((s) => [...document.querySelectorAll<HTMLElement>(s)])
        .map((e) => e.getBoundingClientRect())
        .filter(visible)
      const strip = document.querySelector('.status-strip')?.getBoundingClientRect()
      const bottomBar = document.querySelector('.map-bottom')?.getBoundingClientRect()
      const area: Box = {
        left: mapBox.left + 4,
        right: mapBox.right - 4,
        top: Math.max(mapBox.top, strip && visible(strip) ? strip.bottom : mapBox.top) + 4,
        bottom: Math.min(mapBox.bottom, bottomBar && visible(bottomBar) ? bottomBar.top : mapBox.bottom) - 4,
      }
      const outside = (r: Box) => Math.max(0, area.left - r.left) + Math.max(0, r.right - area.right) + Math.max(0, area.top - r.top) + Math.max(0, r.bottom - area.bottom)
      const hitsUi = (r: Box) => ui.some((u) => overlap(r, u) > 0)

      // 1. Site names: flip left/right when the name runs off the map or under a panel.
      const placed: Box[] = []
      for (const el of labels) {
        let r: Box = el.getBoundingClientRect()
        const side = el.classList.contains('dir-right') ? 'dir-right' : el.classList.contains('dir-left') ? 'dir-left' : null
        if (side && (outside(r) > 0 || hitsUi(r))) {
          const other = side === 'dir-right' ? 'dir-left' : 'dir-right'
          el.dataset.dir = side
          el.classList.replace(side, other)
          const flipped = el.getBoundingClientRect()
          if (outside(flipped) + (hitsUi(flipped) ? 1 : 0) <= outside(r) + (hitsUi(r) ? 1 : 0)) r = flipped
          else el.classList.replace(other, side)
        }
        placed.push(r)
      }

      // 2. Badges, top to bottom: the nearest offset that's free, or the least bad one.
      const items = badges
        .map((el) => ({ el, r: el.getBoundingClientRect() as Box }))
        .filter((x) => x.r.right > x.r.left && x.r.bottom > x.r.top)
        .sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left)
      for (const { el, r } of items) {
        const h = r.bottom - r.top + GAP
        const w = (r.right - r.left) / 2 + GAP
        const offsets: [number, number][] = [[0, 0]]
        for (let k = 1; k <= MAX_STEPS; k++) offsets.push([0, k * h], [0, -k * h])
        // Sideways: half a width first, then a full one, each with the same vertical steps.
        for (const sx of [w, 2 * w]) for (let k = 0; k <= MAX_STEPS; k++) offsets.push([sx, k * h], [-sx, k * h], [sx, -k * h], [-sx, -k * h])
        let best: [number, number] = [0, 0]
        let bestCost = Infinity
        for (const [dx, dy] of offsets) {
          const c = shift(r, dx, dy)
          const cost = placed.reduce((a, p) => a + overlap(c, p), 0) + (hitsUi(c) ? 1e6 : 0) + outside(c) * 1e3
          // Prefer small moves: a tiny cost per pixel moved breaks ties.
          const total = cost + Math.hypot(dx, dy) * 0.01
          if (total < bestCost) {
            bestCost = total
            best = [dx, dy]
          }
          if (cost === 0) break
        }
        if (best[0] || best[1]) el.style.translate = `${Math.round(best[0])}px ${Math.round(best[1])}px`
        const moved = shift(r, best[0], best[1])
        placed.push(moved)
        if (Math.hypot(best[0], best[1]) > LEADER_MIN) leader(el, moved)
      }
    }

    // A line from the marker's point (the icon's own corner: icons are 0×0) to the
    // nearest edge of its moved badge.
    const leader = (el: HTMLElement, b: Box) => {
      const icon = el.parentElement
      if (!icon) return
      const o = icon.getBoundingClientRect()
      const x = Math.min(Math.max(o.left, b.left), b.right) - o.left
      const y = Math.min(Math.max(o.top, b.top), b.bottom) - o.top
      const len = Math.hypot(x, y)
      if (len < LEADER_MIN) return
      const line = document.createElement('span')
      line.className = 'dc-leader'
      line.style.width = `${len}px`
      line.style.transform = `rotate(${Math.atan2(y, x)}rad)`
      icon.prepend(line)
    }

    // Layers draw their markers after React renders, and fonts and icons settle a moment later.
    const schedule = () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
      raf = requestAnimationFrame(run)
      timer = window.setTimeout(run, 120)
    }
    // Markers and icons coming and going; not our own leader lines, which would loop.
    const ours = (n: Node) => n instanceof HTMLElement && n.classList.contains('dc-leader')
    const mo = new MutationObserver((records) => {
      if (records.some((m) => [...m.addedNodes, ...m.removedNodes].some((n) => !ours(n)))) schedule()
    })
    mo.observe(map.getPane('mapPane') ?? root, { childList: true, subtree: true })
    const ro = new ResizeObserver(schedule)
    ro.observe(root)
    for (const s of ['.map-left', '.map-right', '.map-bottom']) {
      const el = document.querySelector(s)
      if (el) ro.observe(el)
    }
    map.on('zoomend moveend resize', schedule)
    schedule()
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
      mo.disconnect()
      ro.disconnect()
      map.off('zoomend moveend resize', schedule)
    }
  }, [map])
  return null
}
