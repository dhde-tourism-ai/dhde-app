import type { EconomicsFigures, EconomicsNode, RegionalEconomics } from '../types/economics'
import { fmtYen, PENDING, sumMetrics } from './format'
import type { RegistryNode } from '../types/nodes'
import { matchesNode } from './nodes'

/** Does an economics node refer to this registry node (by id or either side's aliases)? */
export function sameNode(reg: RegistryNode, econ: EconomicsNode): boolean {
  return matchesNode(reg, econ.id) || (econ.aliases ?? []).includes(reg.id)
}

export function econNodeFor(reg: RegistryNode, e: RegionalEconomics | null): EconomicsNode | undefined {
  return e?.nodes.find((n) => sameNode(reg, n))
}

function econNodeById(e: RegionalEconomics, id: string): EconomicsNode | undefined {
  return e.nodes.find((n) => n.id === id || (n.aliases ?? []).includes(id))
}

/** Coordinates and display name for a flow endpoint: economics node, external point or registry node. */
export function resolvePoint(
  e: RegionalEconomics,
  registry: RegistryNode[],
  id: string,
  coord?: [number, number],
): { latlng: [number, number]; name: string } | null {
  const n = econNodeById(e, id)
  if (n) return { latlng: [n.lat, n.lon], name: n.name }
  const x = e.external_points?.[id]
  if (x) return { latlng: [x.lat, x.lon], name: x.name }
  const r = registry.find((rn) => matchesNode(rn, id))
  if (r) return { latlng: [r.lat, r.lon], name: r.name }
  return coord ? { latlng: coord, name: id } : null
}

/**
 * Warnings to show with the layer: the file's `notes`, plus every distinct
 * "Caveat: ..." sentence found in any metric source (e.g. the JTA March-2026
 * jump for Fukui municipalities), so a caveat in the data is never hidden.
 */
export function econCaveats(e: RegionalEconomics): string[] {
  const found = new Set<string>(e.notes ?? [])
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      const i = v.indexOf('Caveat:')
      if (i !== -1) found.add(v.slice(i + 'Caveat:'.length).trim())
    } else if (Array.isArray(v)) {
      v.forEach(walk)
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(walk)
    }
  }
  walk(e)
  return [...found]
}

/** Total opportunity lost, or "[pending]" if any component is missing. */
export function fmtLost(f: EconomicsFigures): string {
  const o = f.opportunity_lost_yen
  const total = sumMetrics([o.overnight_gap, o.weather, o.idle_rooms])
  return total === null ? PENDING : fmtYen(total)
}
