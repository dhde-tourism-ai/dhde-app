import { TileLayer } from 'react-leaflet'
import type { BasemapId } from './layers'

const ESRI_ATTR = 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community · Labels &copy; Esri'

/** The map's tile layers for a basemap choice (Map view and the #/site view). */
export function Basemap({ id }: { id: BasemapId }) {
  if (id === 'dark') {
    // CARTO dark matter now returns "API key required" tiles without a key, so the dark
    // basemap is Esri's key-free Dark Gray Canvas (base + labels).
    return (
      <>
        <TileLayer
          key="dark"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
          maxZoom={16}
        />
        <TileLayer key="dark-ref" url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" maxZoom={16} />
      </>
    )
  }
  if (id === 'streets') {
    return (
      <TileLayer
        key="streets"
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
        className="tiles-streets"
      />
    )
  }
  return (
    <>
      <TileLayer key="img" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution={ESRI_ATTR} maxZoom={18} className="tiles-imagery" />
      <TileLayer key="roads" url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}" maxZoom={18} opacity={0.55} />
      <TileLayer key="ref" url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" maxZoom={18} />
    </>
  )
}
