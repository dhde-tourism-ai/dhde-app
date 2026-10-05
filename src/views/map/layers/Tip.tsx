import type { ReactNode } from 'react'
import type { Layer, LeafletEvent, Tooltip as LeafletTooltip } from 'leaflet'
import { Popup, Tooltip } from 'react-leaflet'
import { useIsNarrow } from '../../../hooks/useIsNarrow'

/** How long a lingering card stays after the pointer leaves its mark, to reach the card (ms). */
const LINGER_MS = 400

/**
 * Rich hover card. Desktop: a wide tooltip placed left or right of the mark.
 * Phones: a tap popup that pans the map so the whole card stays on screen.
 * Always in Leaflet's own tooltip / popup pane: inside a react-leaflet <Pane> it would
 * otherwise land in that pane (the site cards'), under the other sites' cards.
 */
/** Fade the card's bottom edge only when it is taller than the space it gets (re-checked as it opens). */
function markClipped(e: LeafletEvent) {
  const el = (e.target as LeafletTooltip).getElement()
  if (!el) return
  requestAnimationFrame(() => el.classList.toggle('clipped', el.scrollHeight > el.clientHeight + 1))
}

/**
 * A lingering card stays open while the pointer moves from its mark into the card, and
 * while it's over the card, so a link in it (e.g. Google Maps) can be clicked. Leaflet
 * closes a tooltip the moment the pointer leaves its mark; on first open this swaps that
 * for a short delay that the card itself cancels.
 */
type Source = Layer & { _moveTooltip?: (e: LeafletEvent) => void }

function linger(e: LeafletEvent) {
  const tip = e.target as LeafletTooltip & { _source?: Source; _lingers?: boolean }
  const layer = tip._source
  const el = tip.getElement()
  if (!layer || !el || tip._lingers) return
  tip._lingers = true
  let timer = 0
  // On the card itself: hold still. An interactive card counts as part of its line, so a
  // sticky (cursor-following) card would otherwise chase the pointer as it moves over it.
  let onCard = false
  const stay = () => window.clearTimeout(timer)
  const leave = () => {
    stay()
    timer = window.setTimeout(() => layer.closeTooltip(), LINGER_MS)
  }
  layer.off('mouseout', layer.closeTooltip)
  layer.on('mouseout', leave)
  layer.on('mouseover', stay)
  const follow = layer._moveTooltip
  if (follow) {
    layer.off('mousemove', follow)
    layer.on('mousemove', (ev: LeafletEvent) => {
      if (!onCard) follow.call(layer, ev)
    })
  }
  el.addEventListener('mouseenter', () => {
    onCard = true
    stay()
  })
  el.addEventListener('mouseleave', () => {
    onCard = false
    leave()
  })
}

export function Tip({
  children,
  sticky = false,
  above = false,
  lingers = false,
}: {
  children: ReactNode
  sticky?: boolean
  /** Open above the mark (or the cursor, when sticky) instead of beside it. */
  above?: boolean
  /** Stay open while the pointer moves into the card, so links in it can be clicked. */
  lingers?: boolean
}) {
  const narrow = useIsNarrow()
  if (narrow) {
    return (
      <Popup pane="popupPane" className="map-pop" maxWidth={320} autoPanPaddingTopLeft={[12, 100]} autoPanPaddingBottomRight={[12, 180]}>
        {children}
      </Popup>
    )
  }
  return (
    <Tooltip
      pane="tooltipPane"
      className="map-tip wide"
      direction={above ? 'top' : 'auto'}
      offset={above ? [0, -10] : [0, 0]}
      sticky={sticky}
      interactive={lingers}
      eventHandlers={{
        add: (e) => {
          markClipped(e)
          if (lingers) linger(e)
        },
      }}
    >
      {children}
    </Tooltip>
  )
}
