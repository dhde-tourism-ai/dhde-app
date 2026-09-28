/**
 * public/data/real_data.json, written by scripts/build_real_data.py from
 * dhde-preprocessing-model's per-node master tables. Every field may be null.
 * The app merges it over the demo files (src/lib/real.ts); anything missing or
 * malformed falls back to the demo value for that node and field.
 */

export interface RealDaily {
  date: string
  /** Raw daily signal (camera detections, vehicles, bookings or proxy). */
  signal: number | null
  /** signal × calibration factor: visitors scaled to the 2025 official count (modelled). */
  visitors_est: number | null
  /** The day's signal as a % of the node's mean 2025 day (unit-free, every node). */
  signal_index_pct: number | null
  temp_c: number | null
  precip_mm: number | null
  wind_ms: number | null
  sun_h: number | null
  humidity_pct: number | null
  snow_cm: number | null
  traffic_volume: number | null
  /** 0..1 */
  hotel_occ: number | null
  hotel_adr_yen: number | null
  hotel_rooms_sold: number | null
  hotel_rooms_total: number | null
  survey_responses: number | null
  gmb_map_views: number | null
  gmb_search_views: number | null
  gmb_directions: number | null
  gmb_rating: number | null
  gmb_review_change: number | null
}

export interface RealForward {
  date: string
  hotel_occ: number | null
  hotel_rooms_sold: number | null
  hotel_rooms_total: number | null
}

export interface RealCalibration {
  official_annual_2025: number | null
  signal_sum_2025: number | null
  factor: number | null
  source: string
  status: string
  signal_days_2025?: number
  confidence: 'high' | 'medium' | 'low' | 'none'
  /** How the signal became visitors, e.g. "cars at the summit car parks x 6.98 visitors per car (official 443,000, 2025)". */
  method_text: string | null
  method_text_ja: string | null
  /** Period of the official count: "2025", "FY2025". */
  official_period_label: string | null
  official_period_label_ja: string | null
}

export interface RealForecastDay {
  date: string
  /** In the node's own signal (detections, vehicles, bookings). */
  signal: number | null
  signal_lo: number | null
  signal_hi: number | null
  /** signal × the same calibration factor as the history's visitors_est. */
  visitors_est: number | null
  visitors_lo: number | null
  visitors_hi: number | null
}

/** dhde-preprocessing-model's 7-day forecast (scripts/build_forecast.py). */
export interface RealForecast {
  model: string
  issued_from: string | null
  /** Walk-forward backtest error of this model and of "same weekday last week" (0..1). */
  backtest_wape: number | null
  baseline_wape: number | null
  /** Share of held-out backtest days inside the low/high range. */
  range_coverage: number | null
  days: RealForecastDay[]
}

export interface RealNode {
  measure: string | null
  signal_column: string | null
  calibration: RealCalibration
  as_of: Partial<Record<'visitors' | 'weather' | 'traffic' | 'hotel' | 'survey' | 'google_maps', string | null>>
  daily: RealDaily[]
  hotel_forward: RealForward[]
  /** Missing when no model forecast was published for the node. */
  forecast?: RealForecast
}

export interface RealData {
  generated_at: string
  today: string
  shared_date: string | null
  source: { repo: string; commit: string | null }
  notes: string[]
  nodes: Record<string, RealNode>
}
