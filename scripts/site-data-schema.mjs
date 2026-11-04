// Explicit output contract. Strings list scalar fields; arrays and objects recurse.
const fields = (keys, nested = {}) => Object.assign(Object.fromEntries(keys.split(' ').filter(Boolean).map((k) => [k, true])), nested)
const list = (item) => [item]
const record = (item) => ({ '*': item })
const metric = fields('value status source')
const figures = { visitors: metric, visitors_2024: metric, visitors_calendar_2025: metric, visitors_irikomi_2025: metric, revenue_yen: metric, opportunity_lost_yen: fields('', { overnight_gap: metric, weather: metric, idle_rooms: metric }), monthly: list(fields('month visitors revenue_yen')) }
const journey = fields('depart arrive minutes fare_yen stop', { legs: list(fields('mode route feed from depart to arrive minutes fare_yen')) })
const route = fields('id name mode feed trips')
const transportDay = fields('departures arrivals first_departure last_departure first_arrival last_arrival car_only_after', {
  departures_by_mode: fields('bus rail car ferry'), routes: list(route), feeds_used: list(true),
  from_hub: fields('journeys fastest_min typical_min first_arrival', { fastest: journey, recommended: journey, after_0900: journey }),
  to_hub: fields('leave from_stop arrive_hub minutes fare_yen', { legs: journey.legs }),
  from_far: { kanazawa: fields('name name_ja status basis minutes via via_ja jr_min change_min local_min'), kyoto: fields('name name_ja status basis minutes via via_ja jr_min change_min local_min') },
})
const days = (item) => ({ weekday: item, saturday: item, sunday: item })
const daily = fields('date signal visitors_est signal_index_pct temp_c precip_mm wind_ms sun_h humidity_pct snow_cm traffic_volume hotel_occ hotel_adr_yen hotel_rooms_sold hotel_rooms_total survey_responses gmb_map_views gmb_search_views gmb_directions gmb_rating reviews_new reviews_stars_mean reviews_stars_1 reviews_stars_2 reviews_stars_3 reviews_stars_4 reviews_stars_5 reviews_with_text reviews_foreign reviews_rating_total reviews_count_total instagram_posts instagram_photos instagram_videos instagram_likes instagram_comments instagram_script_ja instagram_script_ko instagram_script_zh instagram_script_latin instagram_script_none instagram_scored instagram_positive instagram_neutral instagram_negative instagram_sentiment_mean social_mentions social_posts social_comments social_bluesky_mentions social_youtube_mentions social_reddit_mentions social_positive social_neutral social_negative social_scored social_sentiment_mean social_lang_ja social_lang_en social_lang_zh_hant social_lang_zh_hans social_lang_ko social_lang_ar social_lang_other gmb_review_change')
const series = fields('', { actual: list(true), predicted: list(true), lo: list(true), hi: list(true) })
export const schemas = {
  nodes: fields('generated_at', { prefectures: list(fields('id name name_ja', { bounds: list(list(true)) })), nodes: list(fields('id name name_ja prefecture municipality lat lon priority kind type measure annual_visitors_2025 role role_ja colour label_dir coords_note coords_approx', { aliases: list(true), secondary_measures: list(true) })) }),
  real_data: fields('generated_at today shared_date', { source: fields('repo commit'), notes: list(true), nodes: record(fields('measure signal_column', {
    calibration: fields('official_annual_2025 signal_sum_2025 factor source status signal_days_2025 confidence method official_period method_text method_text_ja official_period_label official_period_label_ja', { official_period: list(true) }),
    as_of: fields('visitors weather traffic hotel survey google_maps'), daily: list(daily),
    hotel_forward: list(fields('date hotel_occ hotel_rooms_sold hotel_rooms_total')),
    rakuten: fields('as_of', { share_with_rooms_pct: fields('d1 d7 d30') }),
    survey: fields('as_of days responses satisfaction satisfaction_n nps nps_n', { origin_pct: fields('fukui hokuriku kansai chubu kanto other'), purpose_pct: fields('relax_at_inn onsen local_food nature sightseeing theme_park_museum shopping events shows outdoor town_walk experiences ski_marine other_sports drive visit_friends business') }),
    forecast: fields('model issued_from backtest_wape baseline_wape range_coverage interval backtest_weeks', { interval: list(true), days: list(fields('date signal signal_lo signal_hi visitors_est visitors_lo visitors_hi week_ahead_missing')) }),
  })) }),
  live_demo: fields('demo note generated_at timezone start step_minutes hours observed_until', {
    days: list(fields('date dow weekend holiday')), nodes: record(fields('measure annual_visitors_2025 comfortable_capacity', { on_site: series, arrivals: series, weather: fields('station station_ja', Object.fromEntries('temp_c precip_pct precip_mm wind_ms condition'.split(' ').map(k => [k, list(true)]))), sentiment: fields('', { score: list(true), posts: list(true), keywords: list(list(fields('en ja'))) }) })),
    flows: {}, traffic: {}, advisories: [], weather_alerts: [],
  }),
  market_voice_demo: fields('demo note generated_at start days', {
    hotels: list(fields('id name name_ja lat lon node feed rooms_total hotels_in_feed', { serves: list(true), occupancy_pct: list(true), rooms_left: list(true), booking_curve: fields('target_day', { points: list(fields('days_ahead booked_pct last_year_pct')) }), rakuten: fields('radius_km hotels_checked', { share_with_rooms_pct: fields('d1 d7 d30') }) })),
    rsi: list(fields('id name name_ja lat lon index change_7d_pct', { history: list(true) })),
    survey: record(fields('responses_30d satisfaction nps source', { top_reasons: list(fields('en ja share')), origin_share: list(fields('en ja share')) })),
    social: record(fields('posts_24h images_24h comments_24h avg_sentiment', { feed: [] })),
    reviews: record(fields('rating count rating_30d_ago new_30d source', { distribution_pct: list(true), snippets: [] })),
  }),
  dashboard_data: fields('generated_at', { nodes: {}, aggregate: {} }), routes: { routes: [] },
  transport: fields('generated_at timezone note', { reference_days: days(true), sources: list(fields('id name name_ja mode url page licence licence_url caveat caveat_ja publish_status agency valid_from valid_to')), nodes: record(fields('radius_m note note_ja', { anchor: fields('lat lon label label_ja'), stops: list(fields('id name feed lat lon distance_m walk_min')), days: days(transportDay), modes: list(true), feeds: list(true) })) }),
  transport_map: fields('generated_at', { lines: list(fields('id name mode feed colour', { path: list(list(true)) })), stops: list(fields('id name feed lat lon', { nodes: list(true) })), walk_areas: fields('generated_at source licence', { minutes: list(true), nodes: record({ 15: list(list(true)), 30: list(list(true)) }) }), rail: fields('generated_at source url licence credit', { lines: list(fields('id name name_ja operator_ja kind', { paths: list(list(list(true))), service: fields('basis interval_min speed_kmh first last') })), stations: list(fields('id name_ja lat lon', { lines: list(true) })) }) }),
  transport_trips: fields('generated_at note', { days: days(true), stops: list(list(true)), stop_ids: list(true), stop_names: list(true), routes: list(fields('id name')), trips: days(list(list(list(true)))) }),
  regional_economics: fields('sample generated_at as_of_year currency', { assumptions: {}, prefecture: {}, regions: list(fields('id name name_ja level', { ...figures, nodes: list(true), centroid: list(true) })), nodes: list(fields('id name name_ja lat lon region priority annotation', { ...figures, aliases: list(true) })), flows: [], comparison_regions: [], external_points: {}, visitor_window: fields('regions nodes'), notes: list(true) }),
}

/** Pick known fields at every depth. Unknown keys never block pipeline updates. */
export function pickOutput(value, schema, path, warnings = new Set()) {
  if (value == null) return value
  if (schema === true) {
    if (typeof value !== 'object') return value
    warnings.add(path)
    return null
  }
  if (Array.isArray(value)) return schema.length ? value.map((v) => pickOutput(v, schema[0], `${path}[]`, warnings)) : []
  if (typeof value !== 'object') return value
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    const rule = Object.hasOwn(schema, key) ? schema[key] : schema['*']
    if (rule === undefined) warnings.add(`${path}.${key}`)
    else out[key] = pickOutput(item, rule, `${path}.${key}`, warnings)
  }
  return out
}
