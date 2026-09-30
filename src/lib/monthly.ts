import type { MonthlyForecastFile, MonthlySeries } from '../types/monthly'
import type { StrategicQuestion } from '../types/strategy'

/** A calendar year's total: actual months so far plus the forecast for the rest. */
export function yearTotal(s: MonthlySeries, year: string) {
  const actual = s.actual.filter((a) => a.month.startsWith(year))
  const known = new Set(actual.map((a) => a.month))
  const fc = s.forecast.filter((f) => f.month.startsWith(year) && !known.has(f.month) && f.predicted !== null)
  if (actual.length + fc.length < 12) return null
  const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0)
  const done = sum(actual.map((a) => a.value))
  const ranged = fc.every((f) => f.low !== null && f.high !== null)
  return {
    total: done + sum(fc.map((f) => f.predicted)),
    low: ranged ? done + sum(fc.map((f) => f.low)) : null,
    high: ranged ? done + sum(fc.map((f) => f.high)) : null,
    actualMonths: actual.length,
    actualSum: done,
  }
}

/** Each month's share of a fully measured calendar year, in %, or null if a month is missing. */
export function shareOfYear(s: MonthlySeries, year: string): number[] | null {
  const shares = exactShareOfYear(s, year)
  return shares && shares.map((v) => Math.round(v * 10) / 10)
}

function exactShareOfYear(s: MonthlySeries, year: string): number[] | null {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  return shares(months.map((m) => s.actual.find((a) => a.month === m)?.value ?? null))
}

/** Values in calendar order Jan..Dec as % of their total, or null if one is missing. */
function shares(vals: (number | null)[]): number[] | null {
  if (vals.length !== 12 || vals.some((v) => v === null)) return null
  const total = (vals as number[]).reduce((a, b) => a + b, 0)
  return total > 0 ? (vals as number[]).map((v) => (v / total) * 100) : null
}

/** 12 consecutive months' shares, in calendar order Jan..Dec, or null. */
function windowShares(points: { month: string; value: number | null }[]): number[] | null {
  if (points.length !== 12) return null
  const byMonth = new Array<number | null>(12).fill(null)
  for (const p of points) byMonth[Number(p.month.slice(5, 7)) - 1] = p.value
  return shares(byMonth)
}

/**
 * JTA's levelling rate (平準化率, DMO KPI guide 2025, 3.3): the share of the
 * year's visitors in the quietest 3 consecutive months (Dec→Jan wraps), in %.
 */
export function levellingRate(monthShares: number[]): number {
  let best = Infinity
  for (let i = 0; i < 12; i++) best = Math.min(best, monthShares[i] + monthShares[(i + 1) % 12] + monthShares[(i + 2) % 12])
  return best
}

/**
 * Monthly-share cards that name a series and year get that year's measured
 * shares from monthly_forecast.json, and become real; without a full year
 * they keep their placeholder values and status.
 */
export function withMeasuredShares(questions: StrategicQuestion[], file: MonthlyForecastFile | null): StrategicQuestion[] {
  if (!file) return questions
  return questions.map((q) => ({
    ...q,
    cards: q.cards.map((c) => {
      if (c.type !== 'monthly_share' || !c.series || !c.year) return c
      const s = file.series.find((x) => x.id === c.series)
      const exact = s ? exactShareOfYear(s, c.year) : null
      if (!s || !exact) return c
      const rate = levellingRate(exact)
      const next = s.forecast.filter((f) => f.predicted !== null).slice(0, 12)
      const last = s.actual.slice(-12)
      const fc = windowShares(next.map((f) => ({ month: f.month, value: f.predicted })))
      const recent = windowShares(last)
      const fcRate = fc && levellingRate(fc)
      const recentRate = recent && levellingRate(recent)
      // The model keeps the last 12 months' pattern and changes only the level, so
      // its rate matches those months (not necessarily the calendar year above).
      const fcNote =
        fcRate === null
          ? ''
          : recentRate !== null && Math.abs(fcRate - recentRate) < 0.05
            ? ` The next 12 months' forecast gives ${fcRate.toFixed(1)}%, the same as the last 12 measured months (${last[0].month} to ${last[11].month}): the model keeps their monthly pattern and changes only the level.`
            : ` The next 12 months' forecast gives ${fcRate.toFixed(1)}%.`
      return {
        ...c,
        values: exact.map((v) => Math.round(v * 10) / 10),
        status: 'real' as const,
        kpi: c.kpi && { ...c.kpi, value_text: `${rate.toFixed(1)}%`, status: 'real' as const },
        note: `Monthly share of ${s.label} visitors in ${c.year}; quietest 3 consecutive months highlighted.${fcNote}`,
        source: 'JTTA digital tourism statistics (日本観光振興協会 デジタル観光統計), via dhde-preprocessing-model monthly_actuals.csv.',
        todo: undefined,
      }
    }),
  }))
}

/** A fully measured calendar year's total, or null if a month is missing. */
export function measuredYear(s: MonthlySeries, year: string): number | null {
  const months = s.actual.filter((a) => a.month.startsWith(year))
  return months.length === 12 ? months.reduce((a, b) => a + b.value, 0) : null
}
