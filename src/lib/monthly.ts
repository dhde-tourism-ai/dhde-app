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
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const vals = months.map((m) => s.actual.find((a) => a.month === m)?.value ?? null)
  if (vals.some((v) => v === null)) return null
  const total = (vals as number[]).reduce((a, b) => a + b, 0)
  return (vals as number[]).map((v) => Math.round((v / total) * 1000) / 10)
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
      const values = s ? shareOfYear(s, c.year) : null
      if (!s || !values) return c
      return {
        ...c,
        values,
        status: 'real' as const,
        note: `Monthly share of ${s.label} visitors in ${c.year}; quietest 3 consecutive months highlighted.`,
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
