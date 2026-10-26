/** Node ids, order and measures shared across the views. */

/**
 * Node id. Any string: the node list comes from data (real_data.json
 * and public/data/nodes.json), not from a hard-coded union, so new nodes
 * (e.g. the Hokuriku set in dhde-preprocessing-model PR #7) need no type change.
 */
export type NodeKey = string

/** Default render order for the six priority Fukui nodes; other nodes follow in data order. */
export const NODE_ORDER: NodeKey[] = ['tojinbo', 'fukui_station', 'katsuyama', 'rainbow_line', 'awara_onsen', 'eiheiji']

/**
 * What a node's visitor count measures.
 * - people: AI-camera person counts
 * - vehicles: gate / vehicle detections (Rainbow Line)
 * - proxy: footfall proxy (nearest camera within 15 km + pooled survey; proxy_* columns)
 * - reservations: entry bookings (Katsuyama Dinosaur Museum, about 57% of visitors)
 * Proxy and reservation values are estimates and are drawn differently from measured ones.
 */
export type VisitorMeasure = 'people' | 'vehicles' | 'proxy' | 'reservations'

/** Freshness fields the forthcoming pipeline adds. All optional; render when present. */
export interface Freshness {
  /** Date (ISO) the underlying source was last observed. */
  as_of?: string
  /** Common date all nodes were aligned to, so cross-node comparisons are like-for-like. */
  shared_date?: string
  /** True when the value is an estimate / proxy rather than a measurement. */
  is_estimated?: boolean
  /** True when the source is older than its expected refresh cycle. */
  stale?: boolean
}

/** Monthly visitors (e.g. JTA digital tourism statistics per city, since 2021-01). */
export interface MonthlyPoint {
  /** 'YYYY-MM' */
  month: string
  visitors: number | null
  status?: 'real' | 'modelled' | 'illustrative' | 'pending'
  source?: string
}
