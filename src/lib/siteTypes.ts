/**
 * Partner sites with a #/site/<node> view. Geometry from OpenStreetMap (© OpenStreetMap contributors, ODbL),
 * fetched once with Overpass: the Rainbow Line toll road (三方五湖レインボーライン線, ways
 * 162344130, 525061373, 525061374) and the two summit car parks whose gate counts are the node's signal.
 * Tojinbo: cliff ways 603911800, 603911820, 603911863 and pedestrian approach
 * way 51870435. Its area is the convex hull of these ways, a site extent only,
 * not documented camera coverage. No camera locations are published in the app data.
 * Eiheiji: precinct way 685100415 and monzen approach street way 51828019.
 * New geometries fetched via overpass-api.de on 2026-10-27 and simplified to ~3 m,
 * rounded to 5 decimal places. © OpenStreetMap contributors (ODbL).
 */

export type SitePosition = [number, number]

export interface SitePolygon {
  id: string
  en: string
  ja: string
  polygon: SitePosition[]
  /** Optional short map label, e.g. P1. */
  badge?: string
}

export interface Site {
  /** Site outline and approach polylines, [lat, lon]. */
  lines: SitePosition[][]
  polygons: SitePolygon[]
  /** A documented counting point, or a site area when no position is documented. */
  counting: { en: string; ja: string } & ({ point: SitePosition } | { area: SitePosition[] })
  /** The hotel reservation feed real_data.json uses for this node. */
  hotel_area: { en: string; ja: string }
}

