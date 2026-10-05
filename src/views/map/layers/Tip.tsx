import type { ReactNode } from 'react'
import type { LeafletEvent, Tooltip as LeafletTooltip } from 'leaflet'
import { Popup, Tooltip } from 'react-leaflet'
import { useIsNarrow } from '../../../hooks/useIsNarrow'

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

export function Tip({ children, sticky = false, above = false }: { children: ReactNode; sticky?: boolean; /** Open above the mark (or the cursor, when sticky) instead of beside it. */ above?: boolean }) {
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
      eventHandlers={{ add: markClipped }}
    >
      {children}
    </Tooltip>
  )
}
