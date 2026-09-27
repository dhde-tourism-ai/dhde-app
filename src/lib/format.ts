import type { Metric } from '../types/economics'

export const PENDING = '[pending]'

/** Compact number: 1.2M, 340k, 5,546. */
export function fmtCompact(n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'bn'
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M'
  if (a >= 1e4) return Math.round(n / 1e3) + 'k'
  return Math.round(n).toLocaleString('en-US')
}

/** Yen, compact: ¥12bn, ¥340M. */
export function fmtYen(n: number): string {
  return '¥' + fmtCompact(n)
}

/** A Metric's value, or "[pending]" when null. Never invents a number. */
export function fmtMetric(m: Metric | undefined | null, kind: 'yen' | 'count' = 'count'): string {
  if (!m || m.value === null || m.value === undefined) return PENDING
  return kind === 'yen' ? fmtYen(m.value) : fmtCompact(m.value)
}

/** Sum of metrics, or null if any is pending. */
export function sumMetrics(ms: Metric[]): number | null {
  let total = 0
  for (const m of ms) {
    if (m.value === null || m.value === undefined) return null
    total += m.value
  }
  return total
}

/** "27 Sep 2026" from an ISO date or datetime. */
export function fmtDate(iso: string | undefined | null, lang: 'en' | 'ja' = 'en'): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  if (lang === 'ja') return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
