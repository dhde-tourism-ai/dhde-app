/** Keys whose values are code or ids, never display text (sources are translated too). */
const SKIP = new Set(['id', 'type', 'status', 'series', 'total', 'domestic', 'foreign', 'unit', 'spec', 'formula', 'prefix', 'links', 'nodes', 'severity', 'counts', 'layers', 'node', 'year', 'kind', 'gdp_kind', 'theme'])

/**
 * A copy of `value` with every display string swapped for its entry in
 * `dict` (English → Japanese). Strings without an entry, numbers and the
 * keys in SKIP stay as they are.
 */
export function localize<T>(value: T, dict: Record<string, string>): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return dict[v.trim()] ?? v
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v)) out[k] = SKIP.has(k) || k.endsWith('_ja') ? x : walk(x)
      return out
    }
    return v
  }
  return walk(value) as T
}
