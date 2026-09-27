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
}

export interface LiveSentiment {
  /** Daily score, -1 (negative) to +1 (positive), one per day. */
  score: number[]
  /** Posts / reviews mined that day. */
  posts: number[]
  keywords: { en: string; ja: string }[][]
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
  type: 'heavy_rain' | 'wind' | 'thunder' | 'waves' | 'snow' | 'heat'
  level: 'advisory' | 'warning'
  nodes: string[]
  start: number
  end: number
  title_en: string
  title_ja: string
  detail_en: string
  detail_ja: string
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
}
