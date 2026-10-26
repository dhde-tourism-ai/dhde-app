import type { VisitorMeasure } from '../types/dashboard'
import { NODE_ORDER } from '../types/dashboard'
import type { RealData } from '../types/real'
import type { NodeRegistry, RegistryNode } from '../types/nodes'

/** A node as the Map sees it. */
export type MapNode = RegistryNode

function rank(id: string): number {
  const i = NODE_ORDER.indexOf(id)
  return i === -1 ? NODE_ORDER.length : i
}

/** The registry's nodes in map order. */
export function buildMapNodes(registry: NodeRegistry | null): MapNode[] {
  return [...(registry?.nodes ?? [])].sort((a, b) => rank(a.id) - rank(b.id))
}

/** Ordered node ids for the Nodes view switcher: priority registry nodes, then any other nodes in real_data.json. */
export function nodeSwitcherIds(registry: NodeRegistry | null, real: RealData | null): string[] {
  const ids = new Set<string>()
  for (const r of registry?.nodes ?? []) if (r.priority) ids.add(r.id)
  for (const id of Object.keys(real?.nodes ?? {})) ids.add(id)
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
export function isEstimatedMeasure(m: VisitorMeasure | undefined): boolean {
  return m === 'proxy' || m === 'reservations'
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
