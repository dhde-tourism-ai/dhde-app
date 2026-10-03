/**
 * Contract for public/data/live_demo.json: hourly data behind the Map view's live
 * layers. Today's file is DUMMY data from scripts/gen_live_demo.mjs ("demo": true).
 * The real pipeline publishes the same shape with "demo": false. All hourly arrays
 * have `hours` entries starting at 00:00 JST on `start`; index = day * 24 + hour.
 */
import type { VisitorMeasure } from './dashboard'

export type WeatherCondition =
  | 'clear'
  | 'clear_night'
  | 'partly'
  | 'partly_night'
  | 'cloudy'
  | 'rain'
  | 'heavy_rain'
  | 'thunder'
  | 'snow'
  | 'fog'

export interface LiveSeries {
  /** Observed values; null where not yet observed (after observed_until on day 0, and all later days). */
  actual: (number | null)[]
  predicted: number[]
  lo?: number[]
  hi?: number[]
}

export interface LiveWeather {
  /** JMA observation point used for this node. */
  station: string
  station_ja: string
  temp_c: number[]
  precip_pct: number[]
  precip_mm: number[]
  wind_ms: number[]
  condition: WeatherCondition[]
  /* ---- Added by the real-data merge (per day, null where unknown). ---- */
  sun_h?: (number | null)[]
  humidity_pct?: (number | null)[]
  snow_cm?: (number | null)[]
  /** Daily totals / means from real_data.json, for the cards. */
  daily_temp_c?: (number | null)[]
  daily_precip_mm?: (number | null)[]
  daily_wind_ms?: (number | null)[]
  /** True where the day's weather comes from real_data.json. */
  real_days?: boolean[]
  /** Per hour: 'observed' (JMA) or 'forecast' (JMA model) from the hourly collector, null where the hour is daily-based or demo. */
  hourly_source?: ('observed' | 'forecast' | null)[]
}

export interface LiveSentiment {
  /** Daily score, -1 (negative) to +1 (positive), one per day. Demo. */
  score: number[]
  /** Posts / reviews mined that day. Demo. */
  posts: number[]
  keywords: { en: string; ja: string }[][]
  /** Set by the real-data merge: the node's real sentiment over its last weekly window. */
  real?: RealSentiment
}

/** Real sentiment over the last `days` covered days to as_of: Instagram captions plus
 * Bluesky / YouTube / Reddit posts and comments, each scored by a model (no text is kept). */
export interface RealSentiment {
  as_of: string
  days: number
  /** Items with a score. */
  scored: number
  /** Mean score, -1..1. Null when fewer than MIN_SENTIMENT_ITEMS were scored: too few to judge. */
  score: number | null
  positive: number
  neutral: number
  negative: number
  /** Scored items by source. */
  from: { instagram: number; social: number }
}

export interface LiveNode {
  measure: VisitorMeasure
  annual_visitors_2025: number | null
  /** People on site above which the site feels crowded (drives the congestion tier). */
  comfortable_capacity: number
  /** People on site at the hour. */
  on_site: LiveSeries
  /** People arriving during the hour. */
  arrivals: LiveSeries
  weather: LiveWeather
  sentiment: LiveSentiment
}

export interface LiveFlow {
  mode: 'road' | 'rail'
  /** People per hour from route.from to route.to. */
  forward: number[]
  /** People per hour from route.to to route.from. */
  reverse: number[]
  unit: 'people_per_hour'
}

export interface LiveTraffic {
  /** [startFraction, endFraction] of the route length, per segment. */
  segments: [number, number][]
  /** Congestion 0 (free) to 1 (standstill), per segment per hour. */
  congestion: number[][]
  vehicles_per_hour: number[]
  /** Added by the real-data merge: node whose counter drives this road, its daily volume, and which days are real. */
  counter_node?: string
  real_volume?: (number | null)[]
  real_days?: boolean[]
}

export interface LiveAdvisory {
  id: string
  corridor: string
  alternate: string
  start: number
  end: number
  reason_en: string
  reason_ja: string
}

export interface LiveWeatherAlert {
  id: string
  type: 'heavy_rain' | 'wind' | 'thunder' | 'waves' | 'snow' | 'heat' | 'fog' | 'other'
  level: 'advisory' | 'warning'
  nodes: string[]
  start: number
  end: number
  title_en: string
  title_ja: string
  detail_en: string
  detail_ja: string
  /** True for simulated advisories (shown only when JMA's live warnings couldn't be read). */
  demo?: boolean
}

export interface LiveData {
  demo: boolean
  note: string
  generated_at: string
  timezone: string
  /** 'YYYY-MM-DD', day 0 */
  start: string
  step_minutes: number
  hours: number
  /** Last observed hour index (on day 0). */
  observed_until: number
  days: { date: string; dow: string; weekend: boolean; holiday: boolean }[]
  nodes: Record<string, LiveNode>
  flows: Record<string, LiveFlow>
  traffic: Record<string, LiveTraffic>
  advisories: LiveAdvisory[]
  weather_alerts: LiveWeatherAlert[]
  /* ---- Added by the real-data merge (src/lib/real.ts). ---- */
  /** Day index of today (0 for the demo file; 7 when real past days are prepended). */
  today_day?: number
  /** Hour index the timeline opens on ("now"). Defaults to observed_until. */
  now_index?: number
  node_meta?: Record<string, RealNodeMeta>
  sources?: DataSources
  shared_date?: string | null
}

export type SourceStatus = 'demo' | 'real' | 'mixed'

export interface SourceInfo {
  status: SourceStatus
  as_of: string | null
  /** Nodes / areas covered by real values. */
  real: string[]
}

export type DataSources = Partial<Record<'people' | 'flow' | 'density' | 'traffic' | 'weather' | 'hotels' | 'rsi' | 'reviews' | 'survey' | 'social' | 'sentiment' | 'nudges', SourceInfo>>

export interface RealNodeMeta {
  /** people (camera) | vehicles | reservations | proxy_camera | proxy_survey */
  measure: string | null
  confidence: 'high' | 'medium' | 'low' | 'none'
  factor: number | null
  official_2025: number | null
  calibration_source: string
  method_text: string | null
  method_text_ja: string | null
  official_period_label: string | null
  official_period_label_ja: string | null
  visitors_as_of: string | null
  /** No official count to scale to (Fukui Station): show the raw signal only. */
  no_estimate: boolean
  /** Per merged day. */
  visitors_daily: (number | null)[]
  signal_daily: (number | null)[]
  /** signal_index_pct per merged day: % of the node's mean 2025 day. */
  index_daily: (number | null)[]
  /** Mean visitors_est over the real history ("normal"). */
  normal_daily: number | null
  forecast_method: string
  /** Per merged day: 'model' (7-day forecast), 'naive' (same-weekday mean, a rough estimate) or null (no forecast). */
  forecast_source_daily: ('model' | 'naive' | null)[]
}
