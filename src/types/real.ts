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
  /** Google Maps reviews (google_reviews source): new that day, star split, text and non-Japanese counts, place totals. */
  reviews_new: number | null
  reviews_stars_mean: number | null
  reviews_stars_1: number | null
  reviews_stars_2: number | null
  reviews_stars_3: number | null
  reviews_stars_4: number | null
  reviews_stars_5: number | null
  reviews_with_text: number | null
  reviews_foreign: number | null
  reviews_rating_total: number | null
  reviews_count_total: number | null
  /** Instagram posts tagged at the site (instagram source): that day's posts, kinds, likes and comments at scrape time, caption script. Null outside a weekly run's coverage. */
  instagram_posts: number | null
  instagram_photos: number | null
  instagram_videos: number | null
  instagram_likes: number | null
  instagram_comments: number | null
  instagram_script_ja: number | null
  instagram_script_ko: number | null
  instagram_script_zh: number | null
  instagram_script_latin: number | null
  instagram_script_none: number | null
  /** Instagram captions scored for sentiment (sentiment.py in the pipeline): counts by label, mean score -1..1. */
  instagram_scored: number | null
  instagram_positive: number | null
  instagram_neutral: number | null
  instagram_negative: number | null
  instagram_sentiment_mean: number | null
  /** Bluesky, YouTube and Reddit posts and comments naming the site (social_listening source): counts, per platform
   * (null where that platform didn't run), by sentiment label and language. Null outside a weekly run's coverage. */
  social_mentions: number | null
  social_posts: number | null
  social_comments: number | null
  social_bluesky_mentions: number | null
  social_youtube_mentions: number | null
  social_reddit_mentions: number | null
  social_positive: number | null
  social_neutral: number | null
  social_negative: number | null
  social_scored: number | null
  social_sentiment_mean: number | null
  social_lang_ja: number | null
  social_lang_en: number | null
  social_lang_zh_hant: number | null
  social_lang_zh_hans: number | null
  social_lang_ko: number | null
  social_lang_ar: number | null
  social_lang_other: number | null
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
  /** The model ran without its week-ahead bookings (late feed); the app uses its naive forecast that day. */
  week_ahead_missing: boolean
}

/** dhde-preprocessing-model's 7-day forecast (scripts/build_forecast.py). */
export interface RealForecast {
  model: string
  issued_from: string | null
  /** Walk-forward backtest error of this model and of "same weekday last week" (0..1). */
  backtest_wape: number | null
  baseline_wape: number | null
  /**
   * Share of held-out backtest days inside the low/high range (about 0.8). The
   * range is the 5th-95th percentile of past errors, but it is roughly an 80%
   * range in practice: never label it 90%.
   */
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
  /** Rakuten: % of hotels near the node with a room 1 / 7 / 30 days ahead, latest snapshot. Null without snapshots. */
  rakuten: { as_of: string | null; share_with_rooms_pct: { d1: number | null; d7: number | null; d30: number | null } } | null
  /** FTAS survey over the 30 days to as_of: satisfaction (1-5), home region and purpose of visit, as % of responses. Null under 10 responses. */
  survey: RealSurvey | null
  /** Missing when no model forecast was published for the node. */
  forecast?: RealForecast
  /**
   * The model's camera forecast by date, kept even where it has no visitor figure: `forecast`
   * drops those days, and Fukui Station (no official count) has only these.
   */
  signal_forecast?: Record<string, number>
}

export interface RealSurvey {
  as_of: string
  responses: number
  satisfaction: number | null
  /** -100..100 from the survey's 0-10 "would you recommend" question; null under 10 answers. */
  nps: number | null
  nps_n: number
  origin_pct: Record<string, number>
  purpose_pct: Record<string, number>
}

export interface RealData {
  generated_at: string
  today: string
  shared_date: string | null
  source: { repo: string; commit: string | null }
  notes: string[]
  nodes: Record<string, RealNode>
}
