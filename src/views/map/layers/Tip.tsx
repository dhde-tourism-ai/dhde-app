import type { ReactNode } from 'react'
import { Popup, Tooltip } from 'react-leaflet'
import { useIsNarrow } from '../../../hooks/useIsNarrow'

/**
 * Rich hover card. Desktop: a wide tooltip placed left or right of the mark.
 * Phones: a tap popup that pans the map so the whole card stays on screen.
 * Always in Leaflet's own tooltip / popup pane: inside a react-leaflet <Pane> it would
 * otherwise land in that pane (the site cards'), under the other sites' cards.
 */
export function Tip({ children, sticky = false }: { children: ReactNode; sticky?: boolean }) {
  const narrow = useIsNarrow()
  if (narrow) {
    return (
      <Popup pane="popupPane" className="map-pop" maxWidth={320} autoPanPaddingTopLeft={[12, 100]} autoPanPaddingBottomRight={[12, 180]}>
        {children}
      </Popup>
    )
  }
  return (
    <Tooltip pane="tooltipPane" className="map-tip wide" direction="auto" sticky={sticky}>
      {children}
    </Tooltip>
  )
}
