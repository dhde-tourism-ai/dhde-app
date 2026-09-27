import { useEffect, useState } from 'react'
import { useMap } from 'react-leaflet'
import type L from 'leaflet'

/** Create a Leaflet layer once and keep it on the map while the component is mounted. */
export function useLeafletLayer<T extends L.Layer>(make: () => T): T {
  const map = useMap()
  const [layer] = useState(make)
  useEffect(() => {
    layer.addTo(map)
    return () => {
      layer.remove()
    }
  }, [map, layer])
  return layer
}
