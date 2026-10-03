import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/** Space kept between a card and whatever it was moved off. */
const GAP = 3
/** A card keeps its spot until something covers more than this share of it (its own text can grow a little). */
const KEEP_OVERLAP = 0.1
/** The UI drawn over the map: cards never sit under it. */
const UI = ['.map-left > *', '.map-right > *', '.status-strip', '.map-bottom', '.leaflet-control-zoom', '.leaflet-control-attribution']
/** Marks that stay where they are; cards move off them. */
const FIXED = '.nudge-flag, .route-flag'

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
const shift = (r: Box, dx: number, dy: number): Box => ({ left: r.left + dx, right: r.right + dx, top: r.top + dy, bottom: r.bottom + dy })
const visible = (r: DOMRect) => r.width > 0 && r.height > 0

type Side = 'dir-left' | 'dir-right' | 'dir-top' | 'dir-bottom' | 'town'
const SIDES: Side[] = ['dir-left', 'dir-right', 'dir-top', 'dir-bottom']
/** The side the layer drew the card on (kept in data-home once Declutter moves it). */
const homeSide = (el: HTMLElement): Side => {
  if (!el.dataset.home) el.dataset.home = SIDES.find((c) => el.classList.contains(c)) ?? 'town'
  return el.dataset.home as Side
}
const flip = (s: Side): Side | null => (s === 'dir-left' ? 'dir-right' : s === 'dir-right' ? 'dir-left' : null)
const setSide = (el: HTMLElement, s: Side) => {
  if (s === 'town') return
  el.classList.remove(...SIDES)
  el.classList.add(s)
}

/**
 * A light touch on the cards (SiteCards.tsx, and the town cards of hotels and search
 * intent), which already keep the map to one card per place. After a draw, zoom or
 * layer change, a card that overlaps another, a nudge flag or a panel, or runs off
 * the map, tries the nearest free spot: up or down at most one card height, on its
 * own side of the site, then on the other (Katsuyama next to the right-hand board).
 * With no room there either it shrinks to its name (and anything needing attention),
 * then to a dot; hover still shows its detail. Site cards are placed before town cards.
 * Cards move with CSS `translate`, so Leaflet's positioning, hover cards and clicks
 * are untouched. A card keeps its spot (remembered on its marker, since a layer
 * redraws the card on every timeline step) while that spot is still free; only a
 * layer change, zoom or resize places them afresh, so nothing jumps while the
 * timeline plays.
 */
export function Declutter() {
  const map = useMap()
  useEffect(() => {
    const root = map.getContainer()
    let raf = 0
    let timer = 0
    // A full run forgets the remembered spots and places every card afresh.
    let fresh = true

    const run = () => {
      const full = fresh
      fresh = false
      const cards = [...root.querySelectorAll<HTMLElement>('.leaflet-marker-icon.map-divicon > .site-card')]
      // Start from where the layers put things.
      for (const el of cards) {
        el.style.translate = ''
        el.style.removeProperty('--dy')
        el.classList.remove('dc-dot', 'dc-mini')
        setSide(el, homeSide(el))
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
      const placed: Box[] = [...root.querySelectorAll<HTMLElement>(FIXED)].map((e) => e.getBoundingClientRect()).filter(visible)
      const cost = (c: Box) => placed.reduce((a, p) => a + overlap(c, p), 0) + (hitsUi(c) ? 1e6 : 0) + outside(c) * 1e3
      // Keeping a spot allows a little overlap (a card's text can grow); a new spot must be free.
      const keeps = (c: Box) => cost(c) <= (c.right - c.left) * (c.bottom - c.top) * KEEP_OVERLAP
      const free = (c: Box) => cost(c) === 0

      // Each card's box on either side of its site (town cards, centred, have one).
      const measure = (el: HTMLElement, home: Side, other: Side | null) => {
        const boxes: Partial<Record<Side, Box>> = { [home]: el.getBoundingClientRect() }
        if (other) {
          setSide(el, other)
          boxes[other] = el.getBoundingClientRect()
          setSide(el, home)
        }
        return boxes
      }
      const isTown = (el: HTMLElement) => el.classList.contains('town')
      const items = cards
        .map((el) => {
          const home = homeSide(el)
          const other = flip(home)
          return { el, home, other, boxes: measure(el, home, other) }
        })
        .filter((x) => visible(x.boxes[x.home] as DOMRect))
        .sort((a, b) => Number(isTown(a.el)) - Number(isTown(b.el)) || a.boxes[a.home]!.top - b.boxes[b.home]!.top || a.boxes[a.home]!.left - b.boxes[b.home]!.left)

      const place = (el: HTMLElement, side: Side, box: Box, dy: number, mini: boolean) => {
        setSide(el, side)
        el.classList.toggle('dc-mini', mini)
        if (dy) el.style.translate = `0 ${Math.round(dy)}px`
        // The card's pointer stays level with its site however far the card moved (map.css).
        el.style.setProperty('--dy', `${Math.round(dy)}px`)
        if (el.parentElement) el.parentElement.dataset.dc = `${side}|${dy}|${mini ? 'mini' : ''}`
        placed.push(shift(box, 0, dy))
      }
      // The nearest free spot: on its own side, then the other; up or down at most one card height.
      const spot = (boxes: Partial<Record<Side, Box>>, sides: Side[]) => {
        for (const side of sides) {
          const box = boxes[side]!
          const h = box.bottom - box.top + GAP
          // Small steps first, so a card stays as close to its site as it can.
          const dy = [0, -0.25, 0.25, -0.5, 0.5, -0.75, 0.75, -1, 1].map((k) => k * h).find((d) => free(shift(box, 0, d)))
          if (dy !== undefined) return { side, box, dy }
        }
        return null
      }
      const rest: typeof items = []
      // First the cards whose remembered spot is still free keep it.
      for (const it of items) {
        const [side, dy, mini] = (full ? '' : (it.el.parentElement?.dataset.dc ?? '')).split('|') as [Side, string, string]
        if (mini) {
          // A shrunk card is measured shrunk.
          it.el.classList.add('dc-mini')
          it.boxes = measure(it.el, it.home, it.other)
          it.el.classList.remove('dc-mini')
        }
        const box = it.boxes[side]
        if (box && dy !== undefined && keeps(shift(box, 0, Number(dy)))) place(it.el, side, box, Number(dy), !!mini)
        else rest.push(it)
      }
      for (const it of rest) {
        const sides = [it.home, ...(it.other ? [it.other] : [])]
        const whole = spot(measure(it.el, it.home, it.other), sides)
        if (whole) {
          place(it.el, whole.side, whole.box, whole.dy, false)
          continue
        }
        // No room for the whole card: its name and what needs attention only.
        it.el.classList.add('dc-mini')
        const mini = spot(measure(it.el, it.home, it.other), sides)
        if (mini) {
          place(it.el, mini.side, mini.box, mini.dy, true)
          continue
        }
        // Still no room within one card height on either side: a dot at the site.
        it.el.classList.remove('dc-mini')
        it.el.classList.add('dc-dot')
        if (it.el.parentElement) it.el.parentElement.dataset.dc = 'dot'
        placed.push(it.el.getBoundingClientRect())
      }
    }

    // Layers draw their markers after React renders, and fonts and icons settle a moment later.
    // `full` (a layer, zoom or size change) places every card afresh; otherwise they stay put.
    const schedule = (full = false) => {
      if (full) fresh = true
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
      raf = requestAnimationFrame(run)
      timer = window.setTimeout(run, 120)
    }
    // Only the marker panes, not the map pane: its tiles come and go on every pan. A
    // marker added or removed (a layer turned on or off) is a full run. A card redrawn
    // inside its marker (a timeline step) isn't, and takes its remembered spot at once
    // (this runs before the browser paints), so it doesn't flash at its site.
    const panes = [map.getPane('markerPane'), map.getPane('dhde-cards')].filter((p): p is HTMLElement => !!p)
    const mo = new MutationObserver((records) => {
      let changed = false
      for (const m of records) {
        const onPane = panes.includes(m.target as HTMLElement)
        if (onPane && (m.addedNodes.length || m.removedNodes.length)) changed = true
        const dc = !onPane && m.target instanceof HTMLElement ? m.target.dataset.dc : undefined
        if (!dc || fresh) continue
        for (const n of m.addedNodes) {
          if (!(n instanceof HTMLElement) || !n.classList.contains('site-card')) continue
          if (dc === 'dot') {
            n.classList.add('dc-dot')
            continue
          }
          const [side, dy, mini] = dc.split('|') as [Side, string, string]
          homeSide(n)
          setSide(n, side)
          if (mini) n.classList.add('dc-mini')
          if (Number(dy)) n.style.translate = `0 ${Math.round(Number(dy))}px`
          n.style.setProperty('--dy', `${Math.round(Number(dy))}px`)
        }
      }
      schedule(changed)
    })
    for (const p of panes) mo.observe(p, { childList: true, subtree: true })
    const full = () => schedule(true)
    const moved = () => schedule()
    const ro = new ResizeObserver(full)
    ro.observe(root)
    for (const s of ['.map-left', '.map-right', '.map-bottom']) {
      const el = document.querySelector(s)
      if (el) ro.observe(el)
    }
    map.on('zoomend resize', full)
    map.on('moveend', moved)
    full()
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
      mo.disconnect()
      ro.disconnect()
      map.off('zoomend resize', full)
      map.off('moveend', moved)
    }
  }, [map])
  return null
}
