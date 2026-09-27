/**
 * Contract for public/data/regional_economics.json (produced by the
 * regional-economics pipeline in dhde-ai-demo). Every number is a Metric so
 * its provenance travels with it; a null value renders "[pending]", never a number.
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
  /** Optional extension: monthly visitors (JTA digital tourism statistics). */
  monthly?: MonthlyPoint[]
}

export interface EconomicsNode extends EconomicsFigures {
  id: string
  name: string
  name_ja: string
  lat: number
  lon: number
  region: string
  monthly?: MonthlyPoint[]
}

export interface EconomicsFlow {
  from: string
  to: string
  visitors: Metric
  status: MetricStatus
  note: string
}

export interface RegionalEconomics {
  /** True for the placeholder file; the UI shows a "Sample data" banner. */
  sample?: boolean
  generated_at: string
  as_of_year: number
  currency: 'JPY'
  assumptions: Record<string, Metric>
  prefecture: EconomicsFigures
  regions: EconomicsRegion[]
  nodes: EconomicsNode[]
  flows: EconomicsFlow[]
}
