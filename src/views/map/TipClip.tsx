import { useMapEvents } from 'react-leaflet'

/** Marks a hover card that is taller than its max-height, so only that one fades out at the bottom. */
export function TipClip() {
  useMapEvents({
    tooltipopen: (e) => {
      const el = e.tooltip.getElement()
      if (el) requestAnimationFrame(() => el.classList.toggle('clipped', el.scrollHeight > el.clientHeight + 1))
    },
  })
  return null
}
