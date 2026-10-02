/** public/data/transport.json: public transport access per node (transport/build_transport.py). */
export type TransportMode = 'bus' | 'rail' | 'car' | 'ferry'
export type DayType = 'weekday' | 'saturday' | 'sunday'
/** ok = open licence; check = licence needs confirming with the operator; research_only = not for publication as is. */
export type PublishStatus = 'ok' | 'check' | 'research_only'

export interface TransportSource {
  id: string
  name: string
  name_ja: string
  mode: TransportMode
  url: string
  page: string
  licence: string
  licence_url: string
  caveat?: string | null
  caveat_ja?: string | null
  publish_status: PublishStatus
  agency: string
  valid_from: string | null
  valid_to: string | null
}

/** One leg of an itinerary: a bus or train ride, or a walk between stops. */
export type JourneyLeg =
  | { mode: Exclude<TransportMode, 'car'>; route: string; feed: string; from: string; depart: string; to: string; arrive: string }
  | { mode: 'walk'; from: string; to: string; minutes: number }

/** A journey stop to stop; `minutes` is arrive minus depart, so it matches the times shown. */
export interface Journey {
  depart: string
  arrive: string
  minutes: number
  legs: JourneyLeg[]
}

export interface FarJourney {
  name: string
  name_ja: string
  status: 'estimated'
  basis: string
  minutes: number | null
  via?: string
  via_ja?: string
  jr_min?: number
  change_min?: number
  local_min?: number
}

export interface TransportStop {
  id: string
  name: string
  feed: string
  lat: number
  lon: number
  distance_m: number
  walk_min: number
}

export interface TransportRoute {
  id: string
  name: string
  mode: TransportMode
  feed: string
  trips: number
}

export interface TransportDay {
  departures: number
  arrivals: number
  departures_by_mode?: Partial<Record<TransportMode, number>>
  first_departure?: string | null
  last_departure?: string | null
  first_arrival?: string | null
  last_arrival?: string | null
  routes: TransportRoute[]
  /** Absent for the hub itself. */
  from_hub?: {
    journeys: number
    fastest_min: number
    fastest: Journey
    typical_min: number
    first_arrival: string | null
    /** First journey leaving at or after 09:00. */
    after_0900: Journey | null
  } | null
  /** The last bus or train from the site that still reaches the hub today. */
  to_hub?: { leave: string; from_stop: string; arrive_hub: string; minutes: number; legs: JourneyLeg[] } | null
  /** Last public transport departure back to the hub; "all day" when there is none (car only). */
  car_only_after?: string
  /** Kanazawa, Kyoto: estimated JR leg + change + the fastest local journey on this day. */
  from_far: Record<string, FarJourney>
  feeds_used: string[]
}

export interface TransportNode {
  anchor: { lat: number; lon: number; label: string; label_ja: string }
  radius_m: number
  note?: string | null
  note_ja?: string | null
  stops?: TransportStop[]
  days: Partial<Record<DayType, TransportDay>>
  modes: TransportMode[]
  feeds: string[]
}

export interface TransportFile {
  generated_at: string
  timezone: string
  hub: string
  reference_days: Record<DayType, string>
  timetable_dates: Record<DayType, Record<string, string>>
  note: string
  sources: TransportSource[]
  nodes: Record<string, TransportNode>
}

/** public/data/transport_map.json: route lines, stops and walking areas for the map layer. */
export interface TransportMapFile {
  generated_at: string
  lines: { id: string; name: string; mode: TransportMode; feed: string; colour: string | null; path: [number, number][] }[]
  stops: { id: string; name: string; feed: string; lat: number; lon: number; nodes: string[] }[]
  walk_areas: {
    source: string
    licence: string
    minutes: number[]
    /** node -> minutes -> ring of [lat, lon] */
    nodes: Record<string, Record<string, [number, number][]>>
  } | null
}

/** public/data/transport_trends.json: Google Trends interest in transport terms (Illustrative). */
export interface TransportTrendsFile {
  generated_at: string
  source: string
  status: 'illustrative'
  note: string
  last_week_partial: boolean
  weeks: string[]
  terms: { term: string; label: string; mode: string; values: number[] }[]
}

/** public/data/transport_modes.json: estimated visitors by mode (transport/build_modes.py). Modelled. */
export type ModeId = 'train' | 'bus' | 'own_car' | 'rental_car' | 'other'
export interface ModeCount {
  visitors: number
  lo: number
  hi: number
  share?: number | null
}
export interface TransportModesFile {
  generated_at: string
  status: 'modelled'
  method: string
  survey: { source: string; url: string; licence: string; from: string; to: string }
  modes: ModeId[]
  totals: Record<'last_30_days' | 'year_2025', { period: [string, string] | null; visitors: number; by_mode: Record<ModeId, ModeCount> }>
  nodes: Record<
    string,
    {
      survey_areas: string[]
      responses: number
      shares: Record<ModeId, { share: number; lo: number; hi: number }>
      bus_kind: { route?: number; tour?: number }
      visitors_30d: number | null
      by_mode_30d: Record<ModeId, ModeCount> | null
      official_annual_2025: number | null
      by_mode_year: Record<ModeId, ModeCount> | null
      visitor_measure: string | null
      visitor_confidence: string | null
      note?: string | null
      note_ja?: string | null
    }
  >
}
