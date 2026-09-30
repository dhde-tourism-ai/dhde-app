/**
 * Types for public/data/strategic_questions.json (the strategy team's
 * "Fukui Tourism Intelligence · five questions" pilot). All numbers live in
 * the data file; components only lay them out.
 */
import type { MetricStatus } from './economics'

export type PillStatus = MetricStatus

interface CardBase {
  id: string
  title: string
  status: PillStatus
  /** Width on a 12-column grid. */
  span: number
  note?: string
  source?: string
  todo?: string
  pending_on?: string
  /** Kept in the file but not shown, e.g. the Q4 funnel until the final report. */
  hidden?: boolean
  /** Short marker next to the title, e.g. "New" or "Updated". */
  badge?: string
}

export interface StatCard extends CardBase {
  type: 'stat'
  value_text: string | null
  unit?: string
  detail?: string
}

export interface ProgressRow {
  label: string
  baseline: number
  current: number
  target: number
  unit: string
  prefix: string
  current_year: string
  /** Where this row's current value comes from, and on which definition. */
  source?: string
  todo?: string
}

export interface ProgressCard extends CardBase {
  type: 'progress'
  elapsed_share: number
  /** Year labels for the baseline and target, e.g. "2023" and "2029". */
  baseline_year?: string
  target_year?: string
  rows: ProgressRow[]
}

export interface FormulaRow {
  lever: string
  formula: string
  terms: number[]
}

export interface FormulaTableCard extends CardBase {
  type: 'formula_table'
  rows: FormulaRow[]
}

export interface BarRow {
  label: string
  value: number | null
  approx?: boolean
}

export interface BarsCard extends CardBase {
  type: 'bars'
  rows: BarRow[]
  prefix?: string
  unit?: string
  signed?: boolean
  decimals?: number
}

export interface ForecastPoint {
  date: string
  actual: number | null
  forecast: number | null
  lo: number | null
  hi: number | null
  severe_weather: boolean
}

export interface ForecastSite {
  id: string
  label: string
  points: ForecastPoint[]
  next7: { day: string; range: string; action: string }[]
}

export interface ForecastCard extends CardBase {
  type: 'forecast'
  sites: ForecastSite[]
  /** Replace the sites with the real 7-day forecast from real_data.json when it loads. */
  live?: boolean
}

export interface MonthlyShareCard extends CardBase {
  type: 'monthly_share'
  months: string[]
  values: number[]
  /** When set, the values are replaced by this monthly_forecast.json series' shares for `year`, once all 12 months are measured. */
  series?: string
  year?: string
  kpi?: { label: string; value_text: string | null; status: PillStatus }
}

export interface HeatmapCard extends CardBase {
  type: 'heatmap'
  unit: string
  min_n: number
  rows: string[]
  cols: string[]
  cells: { value: number; n: number }[][]
}

export interface FunnelCard extends CardBase {
  type: 'funnel'
  stages: { stage: string; gap_pct: number | null; evidence: string; value_text: string | null }[]
}

export interface IndicatorsCard extends CardBase {
  type: 'indicators'
  items: {
    value_text: string | null
    label: string
    severity: 'crit' | 'warn' | 'ok' | 'pending'
    status: PillStatus
    pending_on?: string
  }[]
}

export interface TableCard extends CardBase {
  type: 'table'
  columns: string[]
  rows: {
    cells: (string | null)[]
    status: PillStatus
    /** Optional pace bar: value vs expected by now (0..1 each). */
    pace?: { value: number; expected: number; label?: string }
  }[]
}

export interface BuilderLever {
  id: string
  label: string
  help: string
  min: number
  max: number
  step: number
  default: number
  /** '%' means the slider value is a percentage of `base`. */
  unit: string
  unit_ja?: string
  base: number
  counts: string[]
  spend_per: number
}

export interface BuilderCard extends CardBase {
  type: 'builder'
  levers: BuilderLever[]
  gaps: { id: string; label: string; gap: number; formula: string }[]
}

/** Fed from public/data/monthly_forecast.json, not from this file: `series` lists the ids to offer. */
export interface MonthlyForecastCard extends CardBase {
  type: 'monthly_forecast'
  series: string[]
}

/** Guest-nights by month, domestic (Japanese) vs foreign, last year vs this year, from monthly_forecast.json. */
export interface GuestNightsMonthsCard extends CardBase {
  type: 'guest_nights_months'
  /** monthly_forecast.json series ids. */
  total: string
  domestic: string
  foreign: string
}

/** Running total this year vs the year's point on a steady-growth path to the vision target. */
export interface TargetPaceCard extends CardBase {
  type: 'target_pace'
  items: {
    series: string
    label: string
    label_ja?: string
    baseline: number
    baseline_year: number
    target: number
    target_year: number
  }[]
}

/** Flows between stages (origin → group → stay). A link's 4th value marks it as estimated (drawn dashed). */
export interface SankeyCard extends CardBase {
  type: 'sankey'
  unit: string
  nodes: { id: string; label: string; label_ja?: string }[]
  links: [string, string, number, boolean?][]
  insight?: string
  insight_ja?: string
  /** A second measure on the same nodes (e.g. spend), switched with a toggle. */
  alt?: { label: string; label_ja?: string; base_label: string; base_label_ja?: string; unit: string; links: [string, string, number, boolean?][]; insight?: string; insight_ja?: string; note?: string; note_ja?: string }
  /** A group too small to see at true scale, shown on its own. */
  zoom?: { label: string; label_ja?: string; total: number; parts: { label: string; label_ja?: string; value: number; low: number; high: number }[] }
}

/** Fukui's GDP by fiscal year (published, then estimated) with tourism's contribution stacked in. */
export interface GdpTrendCard extends CardBase {
  type: 'gdp_trend'
  points: {
    fy: number
    /** Published GDP, ¥bn; absent from the first estimated year on. */
    actual?: number
    /** Estimated GDP, ¥bn. */
    base?: number
    kind?: 'nowcast' | 'forecast'
    /** GDP added by tourism (all three rounds), ¥bn. */
    tourism_va: number
  }[]
  kpis: { label: string; value_text: string; detail?: string; status: PillStatus }[]
}

/** One year of tourism's contribution, split into the direct, indirect ① and indirect ② rounds. */
export interface TourismTrendPoint {
  year: number
  kind: 'modelled' | 'forecast'
  spend_bn: number
  gdp_bn: number
  gdp_kind: 'actual' | 'nowcast' | 'forecast'
  va_direct: number
  va_indirect1: number
  va_indirect2: number
  va_total: number
  jobs_direct: number
  jobs_indirect1: number
  jobs_indirect2: number
  jobs_total: number
  share_direct: number
  share_indirect1: number
  share_indirect2: number
  share_total: number
  jobs_share_total: number
  /** Low to high spend scenarios, projection years only. */
  range?: { va: [number, number]; share: [number, number]; jobs: [number, number]; spend_bn: [number, number] }
}

export interface TourismTrendCard extends CardBase {
  type: 'tourism_trend'
  points: TourismTrendPoint[]
  /** Other published estimates to mark on the chart, e.g. the prefecture's own. */
  benchmarks: { year: number; label: string; va?: number; share?: number; jobs?: number }[]
}

export type RippleTierId = 'direct' | 'indirect1' | 'indirect2'

/** How one year's visitor spend ripples through the direct, indirect ① and indirect ② rounds. */
export interface RippleCard extends CardBase {
  type: 'ripple'
  year: string
  spend_bn: number
  /** Spend that becomes output of Fukui businesses; the rest (`leak_bn`) buys goods made elsewhere. */
  retained_bn: number
  leak_bn: number
  tiers: {
    id: RippleTierId
    what: string
    output_bn: number
    va_bn: number
    income_bn: number
    jobs: number
    top: { sector: string; va_bn: number; jobs: number }[]
  }[]
  total: {
    output_bn: number
    va_bn: number
    income_bn: number
    jobs: number
    share_pct: number
    jobs_share_pct: number
    multiplier_spend: number
    multiplier_direct: number
  }
}

/** Slider: change in tourism spend → GDP, jobs and share, at the base year's effect per ¥1bn. */
export interface WhatIfCard extends CardBase {
  type: 'what_if'
  base_year: string
  base_spend_bn: number
  base_va_bn: number
  base_jobs: number
  gdp_bn: number
  workers: number
  per_bn: { va_bn: number; jobs: number; output_bn: number; income_bn: number }
  min_pct: number
  max_pct: number
  step_pct: number
  default_pct: number
  /** Optional presets shown as buttons under the slider. */
  marks?: { label: string; pct: number }[]
}

export type StrategyCard =
  | StatCard
  | ProgressCard
  | FormulaTableCard
  | BarsCard
  | ForecastCard
  | MonthlyShareCard
  | HeatmapCard
  | FunnelCard
  | IndicatorsCard
  | TableCard
  | BuilderCard
  | MonthlyForecastCard
  | GuestNightsMonthsCard
  | TargetPaceCard
  | SankeyCard
  | SearchTrendsCard
  | GdpTrendCard
  | TourismTrendCard
  | RippleCard
  | WhatIfCard

/** Discover (Q4): Google Trends travel searches for Fukui vs Ishikawa + Kanazawa. A fixed snapshot until the weekly update. */
export interface SearchTrendsCard extends CardBase {
  type: 'search_trends'
  markets_label: string
  markets_label_ja?: string
  /** Per searcher region: [prefecture, city] topic averages for Fukui and for Ishikawa. */
  markets: { label: string; label_ja?: string; fukui: number[]; ishikawa: number[] }[]
  trend: {
    label: string
    label_ja?: string
    months: string[]
    fukui: number[]
    ishikawa: number[]
    kansai: number[]
    events?: { month: string; label: string; label_ja?: string }[]
  }
  insight?: string
  insight_ja?: string
  as_of: string
  as_of_ja?: string
}

export interface BuildSpec {
  data: string
  model: string
  outputs: string
  acceptance: string
  status: string
}

export interface StrategicQuestion {
  id: string
  number: number
  nav: string
  title: string
  /** The government's question behind the section (the FAQ shows it). */
  question?: string
  why: string
  subs: string[]
  answer: string
  cards: StrategyCard[]
  spec: BuildSpec
}

export interface StrategicQuestions {
  meta: {
    title: string
    subtitle: string
    as_of: string
    author: string
    source_doc: string
    footer: string
  }
  pills: Record<PillStatus, { label: string; description: string }>
  equation: {
    status: PillStatus
    terms: { label: string; value_text: string | null; op: string | null }[]
    caption: string
  }
  todos: { for: string; text: string }[]
  questions: StrategicQuestion[]
}
