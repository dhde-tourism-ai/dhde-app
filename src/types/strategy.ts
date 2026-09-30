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
