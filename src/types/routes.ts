/** public/data/routes.json: road geometry fetched once from OSRM (plus hand-digitised rail). */
export interface RouteDef {
  id: string
  from: string
  to: string
  via: string[]
  kind: 'corridor' | 'inflow' | 'alternate' | 'rail'
  label: string
  label_ja: string
  distance_km: number
  duration_min: number
  approximate?: boolean
  /** [lat, lon] */
  path: [number, number][]
}

export interface RoutesFile {
  generated_at: string
  source: string
  note: string
  routes: RouteDef[]
}
