import type { DashboardData, NodeData, VisitorMeasure } from '../types/dashboard'
import { NODE_ORDER } from '../types/dashboard'
import type { NodeRegistry, RegistryNode } from '../types/nodes'

/** A node as the Map sees it: registry entry merged with any live dashboard data. */
export interface MapNode extends RegistryNode {
  live?: NodeData
}

function rank(id: string): number {
  const i = NODE_ORDER.indexOf(id)
  return i === -1 ? NODE_ORDER.length : i
}

/**
 * Merge the registry with dashboard_data.json. Nodes that appear in the
 * dashboard with coordinates but not in the registry are added, so the
 * pipeline can introduce nodes without a frontend change.
 */
export function buildMapNodes(registry: NodeRegistry | null, dashboard: DashboardData | null): MapNode[] {
  const out: MapNode[] = []
  const seen = new Set<string>()
  const liveNodes = dashboard?.nodes ?? {}
  for (const r of registry?.nodes ?? []) {
    out.push({ ...r, live: liveNodes[r.id] })
    seen.add(r.id)
  }
  for (const [id, n] of Object.entries(liveNodes)) {
    if (seen.has(id) || !n || n.lat === undefined || n.lon === undefined) continue
    out.push({
      id,
      name: n.label,
      name_ja: n.name_ja ?? n.label,
      role: n.description,
      prefecture: n.prefecture ?? 'fukui',
      lat: n.lat,
      lon: n.lon,
      priority: true,
      measure: n.measure,
      live: n,
    })
  }
  return out.sort((a, b) => rank(a.id) - rank(b.id))
}

/** Ordered node ids for the Nodes view switcher: priority registry nodes, then any other live nodes. */
export function nodeSwitcherIds(registry: NodeRegistry | null, dashboard: DashboardData | null): string[] {
  const ids = new Set<string>()
  for (const r of registry?.nodes ?? []) if (r.priority) ids.add(r.id)
  for (const id of Object.keys(dashboard?.nodes ?? {})) ids.add(id)
  return [...ids].sort((a, b) => rank(a) - rank(b))
}

/** Find a node by id or alias. */
export function matchesNode(n: RegistryNode, id: string): boolean {
  return n.id === id || (n.aliases ?? []).includes(id)
}

export const MEASURE_LABEL: Record<VisitorMeasure, string> = {
  people: 'People (camera)',
  vehicles: 'Vehicles (gate detections)',
  proxy: 'Footfall proxy (estimated)',
  reservations: 'Reservations (entry bookings)',
}

/** Proxy and reservation counts are estimates, drawn differently from measured counts. */
export function isEstimatedMeasure(m: VisitorMeasure | undefined, live?: NodeData): boolean {
  return Boolean(live?.is_estimated) || m === 'proxy' || m === 'reservations'
}

export interface CongestionTier {
  label: string
  label_ja: string
  colour: string
}

/** Congestion tiers from the demo map, on a 0-100 index. */
export function congestionTier(index: number): CongestionTier {
  if (index < 30) return { label: 'Free flow', label_ja: '順調', colour: '#0ca30c' }
  if (index < 55) return { label: 'Moderate', label_ja: '普通', colour: '#fab219' }
  if (index < 75) return { label: 'Congested', label_ja: '混雑', colour: '#ec835a' }
  return { label: 'Gridlock', label_ja: '立ち往生', colour: '#d03b3b' }
}

export const CONGESTION_TIERS: CongestionTier[] = [10, 40, 60, 90].map(congestionTier)

export interface NodeReading {
  date: string
  actual: number
  forecast: number
  /** Actual and forecast as 0-100 of the node's 60-day peak, so nodes with different units compare. */
  actualIndex: number
  forecastIndex: number
  /** 0-100 index used for the tier, and where it came from. */
  congestionIndex: number
  congestionSource: 'road_congestion' | 'relative_to_peak'
}

/** Latest actual vs forecast for a node, with the congestion index. */
export function latestReading(live: NodeData | undefined): NodeReading | null {
  const series = live?.demand_forecast ?? []
  if (series.length === 0) return null
  const last = series[series.length - 1]
  const peak = Math.max(1, ...series.map((p) => Math.max(p.actual ?? 0, p.forecast ?? 0)))
  const actualIndex = (100 * (last.actual ?? 0)) / peak
  const forecastIndex = (100 * (last.forecast ?? 0)) / peak
  const rc = live?.road_congestion
  const useRoad = rc !== null && rc !== undefined
  return {
    date: last.date,
    actual: last.actual,
    forecast: last.forecast,
    actualIndex,
    forecastIndex,
    congestionIndex: useRoad ? rc * 100 : actualIndex,
    congestionSource: useRoad ? 'road_congestion' : 'relative_to_peak',
  }
}
