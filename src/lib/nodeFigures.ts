/** The Nodes view's per-node figures from real_data.json. */
import type { RealNode } from '../types/real'

/** Today's date in Japan (the data's calendar). */
export function jstToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** A node's numbers for the Nodes view, in visitors where it has a calibration, else in its raw signal (Fukui Station). */
export interface NodeFigures {
  visitors: boolean
  past30: number | null
  /** Null unless comparable. */
  lastYear: number | null
  /** Both 30-day windows have a count every day, so the change is like-for-like. */
  comparable: boolean
  lastYearDays: number
  next: { total: number; days: number; to: string } | null
  asOf: string | null
}

export function nodeFigures(rn: RealNode, today: string): NodeFigures {
  const visitors = Boolean(rn.calibration.factor)
  const asOf = rn.as_of.visitors ?? null
  const cmp = rn.compare_30d
  const pick = (w: { visitors_est: number | null; signal: number | null }) => (visitors ? w.visitors_est : w.signal)
  let past30: number | null = null
  if (cmp) past30 = pick(cmp.this_year)
  else if (asOf) {
    // Files built before compare_30d: the same window from the 90-day history.
    const rows = rn.daily.filter((d) => d.date > addDays(asOf, -30) && d.date <= asOf).map(pick)
    past30 = rows.some((v) => v !== null) ? rows.reduce<number>((a, v) => a + (v ?? 0), 0) : null
  }
  const ahead = (rn.forecast?.days ?? []).filter((d) => d.date >= today).slice(0, 7)
  const comparable = Boolean(cmp && cmp.this_year.days === cmp.days && cmp.last_year.days === cmp.days)
  return {
    visitors,
    past30,
    // A partial window's total would read as a drop, so last year shows only when both are full.
    lastYear: cmp && comparable ? pick(cmp.last_year) : null,
    comparable,
    lastYearDays: cmp?.last_year.days ?? 0,
    next: visitors && ahead.length ? { total: ahead.reduce((a, d) => a + (d.visitors_est ?? 0), 0), days: ahead.length, to: ahead[ahead.length - 1].date } : null,
    asOf,
  }
}
