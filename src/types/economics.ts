/**
 * Contract for public/data/regional_economics.json (produced by
 * economics/build_regional_economics.py in dhde-ai-demo). Every number is a
 * Metric so its provenance travels with it; a null value renders "[pending]",
 * never a number. Fields marked "addition" go beyond the agreed contract and
 * are optional, so a file without them still works.
 */
import type { MonthlyPoint } from './dashboard'

export type MetricStatus = 'real' | 'modelled' | 'illustrative' | 'pending'

export interface Metric {
  value: number | null
  status: MetricStatus
  source: string
}

export interface OpportunityLost {
  overnight_gap: Metric
  weather: Metric
  idle_rooms: Metric
}

export interface EconomicsFigures {
  visitors: Metric
  revenue_yen: Metric
  opportunity_lost_yen: OpportunityLost
}

export interface EconomicsRegion extends EconomicsFigures {
  id: string
  name: string
  name_ja: string
  /** e.g. 'municipality' */
  level: string
  nodes: string[]
  /** [lat, lon] */
  centroid: [number, number]
  /** addition: JTA calendar-2025 visitors, for comparison with the latest-12-month figure. */
  visitors_calendar_2025?: Metric
  /** addition: prefecture 入込数 2025 per municipality. */
  visitors_irikomi_2025?: Metric
  /** addition (planned): monthly visitors (JTA digital tourism statistics). */
  monthly?: MonthlyPoint[]
}

export interface EconomicsNode extends EconomicsFigures {
  id: string
  name: string
  name_ja: string
  lat: number
  lon: number
  region: string
  /** addition: other ids for this node (e.g. dhde-preprocessing-model keys). */
  aliases?: string[]
  priority?: boolean
  visitors_2024?: Metric
  /** addition: short parking / capacity note (docs/site_capacity.md). */
  annotation?: string
  monthly?: MonthlyPoint[]
}

export interface EconomicsFlow {
  from: string
  to: string
  visitors: Metric
  status: MetricStatus
  note: string
  /** addition: [lat, lon] for endpoints that are not nodes. */
  from_coord?: [number, number]
  to_coord?: [number, number]
}

export interface ExternalPoint {
  name: string
  name_ja: string
  lat: number
  lon: number
}

export interface RegionalEconomics {
  /** True for the placeholder file; the UI shows a "Sample data" banner. */
  sample?: boolean
  generated_at: string
  as_of_year: number
  currency: 'JPY'
  assumptions: Record<string, Metric>
  prefecture: EconomicsFigures & { visitors_2024?: Metric }
  regions: EconomicsRegion[]
  nodes: EconomicsNode[]
  flows: EconomicsFlow[]
  /** addition: benchmark regions (Kanazawa City etc.), not drawn. */
  comparison_regions?: (EconomicsFigures & { id: string; name: string; name_ja: string })[]
  /** addition: named points used as flow endpoints (Kanazawa, Tsuruga). */
  external_points?: Record<string, ExternalPoint>
  /** addition: what period each level's visitors cover. */
  visitor_window?: { regions?: string; nodes?: string }
  /** Optional free-text warnings to show with the layer. */
  notes?: string[]
}
