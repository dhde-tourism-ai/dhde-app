import type { RealSentiment } from './live'

/**
 * Contract for public/data/market_voice_demo.json: the Market (hotels, search
 * intent) and Voice of visitor (survey, social, reviews) layers. Today's file is
 * DUMMY data from scripts/gen_market_voice_demo.mjs ("demo": true, all posts and
 * reviews fictional). Per-day arrays have `days` entries starting on `start`.
 */

export interface HotelArea {
  id: string
  name: string
  name_ja: string
  lat: number
  lon: number
  /** Node whose demand this area serves (nudge loop #3). */
  node: string
  /** FTAS reservation feed name. */
  feed: string
  rooms_total: number
  /** Hotels in the area's FTAS feed (its latest_hotel.csv). The badge is the whole area, not one hotel. */
  hotels_in_feed?: number
  /** Nodes this area's feed stands for (Echizen coast: one regional feed for three sites). */
  serves?: string[]
  /** Occupancy per night, one per day. */
  occupancy_pct: number[]
  rooms_left: number[]
  /** Booking curve for the busiest upcoming night: share booked N days ahead, vs last year. */
  booking_curve: { target_day: number; points: { days_ahead: number; booked_pct: number; last_year_pct: number }[] }
  /** Rakuten availability: share of hotels within radius_km with rooms left 1 / 7 / 30 days out. */
  rakuten: {
    radius_km: number
    hotels_checked: number
    share_with_rooms_pct: { d1: number; d7: number; d30: number }
    /** Set by the real-data merge when the shares come from Rakuten snapshots. */
    real?: { as_of: string | null }
  }
  /* ---- Added by the real-data merge. ---- */
  real_days?: boolean[]
  adr_yen?: (number | null)[]
  /** On-the-books occupancy for nights N days ahead (real hotel_forward). */
  forward?: { days_ahead: number; occ_pct: number }[]
  as_of?: string | null
  /** Node whose FTAS reservation feed supplies the real values. */
  real_feed_node?: string
}

export interface RsiArea {
  id: string
  name: string
  name_ja: string
  lat: number
  lon: number
  /** Route-search / online interest index today (0-100). */
  index: number
  /** Last 14 days, oldest first; the last value is today. */
  history: number[]
  change_7d_pct: number
  /** Real Google Maps Business Profile metrics for the node in this area (merge). */
  gmb?: { node: string; map_views: number; search_views: number; directions: number; history: number[]; as_of: string | null }
}

export interface Share {
  en: string
  ja: string
  share: number
}

export interface SurveyNode {
  responses_30d: number
  /** Mean satisfaction, 1-5. */
  satisfaction: number
  /** Net promoter score, -100..100. Null (hidden) when fewer than 10 real answers to the NPS question. */
  nps: number | null
  top_reasons: Share[]
  origin_share: Share[]
  source: string
  /** responses_30d is real (sum of daily survey_responses). */
  responses_real?: { as_of: string | null }
  /** satisfaction, nps (nps_n answers), top_reasons (purpose of visit) and origin_share (home region, domestic only) are real. */
  details_real?: { as_of: string; responses: number; nps_n: number }
}

export interface SocialPost {
  id: string
  kind: 'photo' | 'short' | 'comment'
  /** Fictional handle. */
  handle: string
  hours_ago: number
  sentiment: number
  en: string
  ja: string
  likes: number
  comments: number
  /** Abstract placeholder the app draws (never a real photo). */
  thumb: { motif: 'cliff' | 'train' | 'dino' | 'lake' | 'onsen' | 'temple'; hue: number }
}

export interface SocialNode {
  posts_24h: number
  images_24h: number
  comments_24h: number
  avg_sentiment: number
  feed: SocialPost[]
  /** Set by the real-data merge: Instagram posts tagged at the site in the `days` covered days to as_of.
   * With `mentions` or either one, the layer shows real counts and hides the demo feed (no post text is kept). */
  real?: {
    as_of: string
    days: number
    posts: number
    photos: number
    videos: number
    likes: number
    comments: number
    /** Posts by caption script: a rough market proxy, not nationality. */
    scripts: { ja: number; ko: number; zh: number; latin: number; none: number }
  }
  /** Set by the real-data merge: Bluesky, YouTube and Reddit posts and comments naming the site, `days` covered days to as_of. */
  mentions?: {
    as_of: string
    days: number
    total: number
    posts: number
    comments: number
    /** Null: that platform wasn't collected (no API key yet). */
    platforms: { bluesky: number | null; youtube: number | null; reddit: number | null }
    /** By detected language. Traditional Chinese points to Taiwan / Hong Kong: a market proxy, not nationality. */
    langs: { ja: number; en: number; zh_hant: number; zh_hans: number; ko: number; ar: number; other: number }
  }
  /** Real sentiment of the Instagram captions and mentions together (merge). */
  sentiment_real?: RealSentiment
}

export interface ReviewsNode {
  rating: number
  count: number
  rating_30d_ago: number
  new_30d: number
  /** Share of reviews at 5, 4, 3, 2, 1 stars. */
  distribution_pct: number[]
  snippets: { stars: number; en: string; ja: string; days_ago: number }[]
  source: string
  /** rating / rating_30d_ago / new_30d are real: from stars_real's reviews when set, else Business Profile (GMB). Snippets stay demo. */
  real?: { as_of: string | null; reviews_used: number }
  /** Everything but the snippets is from the node's own Google Maps reviews: the n in the 30 days to as_of, and the place total. */
  stars_real?: { as_of: string; n: number }
}

export interface MarketVoiceData {
  demo: boolean
  note: string
  generated_at: string
  start: string
  days: number
  hotels: HotelArea[]
  rsi: RsiArea[]
  survey: Record<string, SurveyNode>
  social: Record<string, SocialNode>
  reviews: Record<string, ReviewsNode>
}
