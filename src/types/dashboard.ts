/**
 * Strict types for public/data/dashboard_data.json, as produced by
 * scripts/generate_report_data.py's build_dashboard_payload().
 */

/**
 * Node id. Any string: the node list comes from data (dashboard_data.json
 * and public/data/nodes.json), not from a hard-coded union, so new nodes
 * (e.g. the Hokuriku set in dhde-preprocessing-model PR #7) need no type change.
 */
export type NodeKey = string

/** Default render order for the six priority Fukui nodes; other nodes follow in data order. */
export const NODE_ORDER: NodeKey[] = ['tojinbo', 'fukui_station', 'katsuyama', 'rainbow_line', 'awara', 'eiheiji']

/**
 * What a node's visitor count measures.
 * - people: AI-camera person counts
 * - vehicles: gate / vehicle detections (Rainbow Line)
 * - proxy: footfall proxy (nearest camera within 15 km + pooled survey; proxy_* columns)
 * - reservations: entry bookings (Katsuyama Dinosaur Museum, about 57% of visitors)
 * Proxy and reservation values are estimates and are drawn differently from measured ones.
 */
export type VisitorMeasure = 'people' | 'vehicles' | 'proxy' | 'reservations'

/** Freshness fields the forthcoming pipeline adds. All optional; render when present. */
export interface Freshness {
  /** Date (ISO) the underlying source was last observed. */
  as_of?: string
  /** Common date all nodes were aligned to, so cross-node comparisons are like-for-like. */
  shared_date?: string
  /** True when the value is an estimate / proxy rather than a measurement. */
  is_estimated?: boolean
  /** True when the source is older than its expected refresh cycle. */
  stale?: boolean
}

/** Monthly visitors (e.g. JTA digital tourism statistics per city, since 2021-01). */
export interface MonthlyPoint {
  /** 'YYYY-MM' */
  month: string
  visitors: number | null
  status?: 'real' | 'modelled' | 'illustrative' | 'pending'
  source?: string
}

export type NodeDataSource = 'camera' | 'survey_proxy'

export type PacingBadge = 'HOT' | 'OK' | 'WARN' | 'CRIT'
export type PacingLabel = 'Superb' | 'Strong' | 'Warning' | 'Critical'

export interface PacingStatus {
  rate: number
  badge: PacingBadge
  label: PacingLabel
}

export interface Past30DaySummary {
  current_total: number
  previous_year_total: number
  diff: number
  yoy_pct: number | null
}

export interface ModelAccuracy {
  /** Walk-forward held-out MAE (mean absolute error), in the node's raw count units. */
  walk_forward_mae: number | null
  mean_actual: number
  mae_pct_of_mean: number | null
}

export interface NodeSummary {
  past_30_day: Past30DaySummary
  this_week_pacing: PacingStatus
  model_accuracy?: ModelAccuracy
}

export interface WeatherStripDay {
  date: string
  weather: string | null
  wind: string | null
  precipitation_pct: number | null
  rain_risk: boolean
}

export interface DemandForecastPoint {
  date: string
  actual: number
  forecast: number
}

export interface WeeklyPacingPoint extends DemandForecastPoint, PacingStatus {}

export interface Nudge {
  type: 'weather' | 'demand'
  date: string
  message: string
}

export interface EstimatedOutlookDay {
  date: string
  estimated_demand: number
  weather: string | null
  precipitation_pct: number | null
  rain_risk: boolean | null
  is_estimated: true
}

export interface NodeData extends Freshness {
  label: string
  description: string
  data_source: NodeDataSource
  summary: NodeSummary
  weather_strip: WeatherStripDay[]
  demand_forecast: DemandForecastPoint[]
  weekly_pacing: WeeklyPacingPoint[]
  nudges: Nudge[]
  weather_data_is_stale: boolean
  feature_cols: string[]
  estimated_outlook: EstimatedOutlookDay[]
  /* ---- Optional fields for the unified product (map + freshness). ---- */
  name_ja?: string
  lat?: number
  lon?: number
  /** 'fukui' | 'ishikawa' | 'toyama' */
  prefecture?: string
  measure?: VisitorMeasure
  /** TomTom road congestion, 0 (free flow) to 1 (standstill). Drives the map congestion tier when present. */
  road_congestion?: number | null
  road_congestion_as_of?: string
  monthly?: MonthlyPoint[]
  /** Per-source freshness, e.g. { camera: {...}, weather: {...}, rsi: {...} }. */
  sources?: Record<string, Freshness>
}

export interface DashboardAggregate {
  node_count: number
  opportunity_gap_visitors: number
  opportunity_gap_yen: number
  /** e.g. { tojinbo: 0.1234, fukui_station: 0.0876, ... } — weather-lift R² per node. */
  seasonal_weather_sensitivity_ratio: Partial<Record<NodeKey, number>>
}

export interface DashboardData {
  generated_at: string
  /** Common date all nodes were aligned to (forthcoming pipeline). */
  shared_date?: string
  /** Per-source freshness across the whole payload (forthcoming pipeline). */
  sources?: Record<string, Freshness>
  aggregate: DashboardAggregate
  /** A node key can be absent entirely if the pipeline had no usable data for it. */
  nodes: Partial<Record<NodeKey, NodeData>>
}