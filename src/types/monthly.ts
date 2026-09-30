/** public/data/monthly_forecast.json (scripts/build_monthly_forecast.py). */
export interface MonthlySeries {
  id: string
  kind: 'visitors' | 'guest_nights'
  label: string
  label_ja: string
  /** seasonal_naive (same month last year) | own_growth | neighbour_growth */
  model: string
  backtest_mape_pct: number | null
  baseline_mape_pct: number | null
  /** Fewer than 12 distinct backtest months: the low/high range is rough. */
  range_rough: boolean
  /** Last actual month, YYYY-MM. */
  data_through: string
  comparable_from: string | null
  actual: { month: string; value: number }[]
  forecast: { month: string; predicted: number | null; low: number | null; high: number | null }[]
}

export interface MonthlyForecastFile {
  generated_at: string
  source: { repo: string; commit: string | null }
  notes: string[]
  series: MonthlySeries[]
}
