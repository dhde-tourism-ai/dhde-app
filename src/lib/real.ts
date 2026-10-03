/**
 * Merge public/data/real_data.json over the demo files.
 *
 * Rule: wherever a real value exists it replaces the demo value; everywhere else
 * the demo stays and keeps its "Demo data" badge. A missing or malformed file
 * (or node, or field) never breaks a view: parseReal() drops what it cannot
 * trust and mergeLive() / mergeMarket() return the demo unchanged when nothing
 * real is left.
 *
 * What changes when real data is present:
 * - The timeline gains the last PAST_DAYS observed days before today.
 * - People: per-node daily visitors = visitors_est (modelled); the demo intraday
 *   shape of the same weekday is scaled so each day's total matches. Today and
 *   future days: the node's 7-day model forecast (real_data.json `forecast`,
 *   with its own low/high range) where published; after it, or for nodes
 *   without one, the mean visitors_est of recent same weekdays (up to 4, looking
 *   back up to 8 weeks; holidays and Obon skipped for a normal day): a naive
 *   seasonal forecast. Either way spread with the
 *   demo shape. forecast_source_daily says which one each day used.
 *   Nodes without an estimate (Fukui Station) keep demo shapes but are flagged
 *   no_estimate so the UI shows camera detections, never a visitor number.
 * - Weather: real hourly weather where the hourly collector has it
 *   (lib/weatherHourly.ts: JMA observed, else the latest JMA-model forecast,
 *   past and future hours alike); other days real daily temperature, rain,
 *   wind, sun, humidity and snow with the hourly curve synthesised from them.
 *   Weather warnings: JMA's live ones (lib/jmaWarnings.ts) once read, else demo.
 *   Advisories stay demo.
 * - Traffic: roads with a real counter get the demo congestion profile scaled
 *   by that day's real volume vs the node's 90-day mean; others stay demo.
 * - Hotels, search intent (GMB), reviews (GMB) and survey response counts: see
 *   mergeMarket().
 */
import type { LiveData, LiveSeries, RealNodeMeta, RealSentiment, SourceInfo, WeatherCondition, DataSources } from '../types/live'
import type { HotelArea, MarketVoiceData } from '../types/market'
import type { RealData, RealDaily, RealForecast, RealForecastDay, RealForward, RealNode } from '../types/real'
import { isHoliday } from './holidays'
import { median, weekdayNormal } from './normal'
import { conditionOf, popOf, rowForSlot, usable, type HourlyWeather } from './weatherHourly'
import { toAlerts, type WarningsRead } from './jmaWarnings'

export const PAST_DAYS = 7
/** Days of Instagram posts and mentions the Social and Sentiment layers add up (the weekly run's window). */
export const SOCIAL_DAYS = 7
/** Fewest scored posts and comments in the window for a real sentiment score (fewer is a few people's mood). */
export const MIN_SENTIMENT_ITEMS = 5
/** Fewest reviews in 30 days for a real star split (fewer is one person's opinion, not a distribution). */
const MIN_STAR_REVIEWS = 10

const NUM_FIELDS: (keyof RealDaily)[] = [
  'signal',
  'visitors_est',
  'signal_index_pct',
  'temp_c',
  'precip_mm',
  'wind_ms',
  'sun_h',
  'humidity_pct',
  'snow_cm',
  'traffic_volume',
  'hotel_occ',
  'hotel_adr_yen',
  'hotel_rooms_sold',
  'hotel_rooms_total',
  'survey_responses',
  'gmb_map_views',
  'gmb_search_views',
  'gmb_directions',
  'gmb_rating',
  'gmb_review_change',
  'reviews_new',
  'reviews_stars_mean',
  'reviews_stars_1',
  'reviews_stars_2',
  'reviews_stars_3',
  'reviews_stars_4',
  'reviews_stars_5',
  'reviews_with_text',
  'reviews_foreign',
  'reviews_rating_total',
  'reviews_count_total',
  'instagram_posts',
  'instagram_photos',
  'instagram_videos',
  'instagram_likes',
  'instagram_comments',
  'instagram_script_ja',
  'instagram_script_ko',
  'instagram_script_zh',
  'instagram_script_latin',
  'instagram_script_none',
  'instagram_scored',
  'instagram_positive',
  'instagram_neutral',
  'instagram_negative',
  'instagram_sentiment_mean',
  'social_mentions',
  'social_posts',
  'social_comments',
  'social_bluesky_mentions',
  'social_youtube_mentions',
  'social_reddit_mentions',
  'social_positive',
  'social_neutral',
  'social_negative',
  'social_scored',
  'social_sentiment_mean',
  'social_lang_ja',
  'social_lang_en',
  'social_lang_zh_hant',
  'social_lang_zh_hans',
  'social_lang_ko',
  'social_lang_ar',
  'social_lang_other',
]
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function parseRakuten(v: unknown): RealNode['rakuten'] {
  if (!isObj(v) || !isObj(v.share_with_rooms_pct)) return null
  const s = v.share_with_rooms_pct
  const share = { d1: num(s.d1), d7: num(s.d7), d30: num(s.d30) }
  return share.d1 === null && share.d7 === null && share.d30 === null ? null : { as_of: str(v.as_of), share_with_rooms_pct: share }
}

/** FTAS survey home regions (domestic only: it has no overseas respondents) and purposes of visit. */
const ORIGIN_LABELS: Record<string, { en: string; ja: string }> = {
  fukui: { en: 'Fukui', ja: '福井県内' },
  hokuriku: { en: 'Ishikawa, Toyama', ja: '石川・富山' },
  kansai: { en: 'Kansai', ja: '関西' },
  chubu: { en: 'Chubu', ja: '中部' },
  kanto: { en: 'Kanto', ja: '関東' },
  other: { en: 'Rest of Japan', ja: 'その他の地域' },
}
const PURPOSE_LABELS: Record<string, { en: string; ja: string }> = {
  relax_at_inn: { en: 'Relaxing at the inn', ja: '宿でのんびり' },
  onsen: { en: 'Onsen', ja: '温泉' },
  local_food: { en: 'Local food', ja: '地元の食' },
  nature: { en: 'Nature', ja: '自然鑑賞' },
  sightseeing: { en: 'Sightseeing', ja: '名所・旧跡' },
  theme_park_museum: { en: 'Museums, theme parks', ja: '博物館・テーマパーク' },
  shopping: { en: 'Shopping', ja: '買い物' },
  events: { en: 'Events', ja: '祭り・イベント' },
  shows: { en: 'Shows, sports events', ja: '観戦・鑑賞' },
  outdoor: { en: 'Outdoors', ja: 'アウトドア' },
  town_walk: { en: 'Walking the town', ja: 'まちあるき' },
  experiences: { en: 'Hands-on activities', ja: '体験' },
  ski_marine: { en: 'Ski, marine sports', ja: 'スキー・マリン' },
  other_sports: { en: 'Other sports', ja: 'その他スポーツ' },
  drive: { en: 'Driving', ja: 'ドライブ' },
  visit_friends: { en: 'Visiting friends', ja: '友人・親戚' },
  business: { en: 'Business', ja: '仕事' },
}

function parsePct(v: unknown): Record<string, number> {
  if (!isObj(v)) return {}
  return Object.fromEntries(Object.entries(v).filter((e): e is [string, number] => num(e[1]) !== null))
}

function parseSurvey(v: unknown): RealNode['survey'] {
  if (!isObj(v) || typeof v.as_of !== 'string' || num(v.responses) === null) return null
  return {
    as_of: v.as_of,
    responses: num(v.responses) as number,
    satisfaction: num(v.satisfaction),
    nps: num(v.nps),
    nps_n: num(v.nps_n) ?? 0,
    origin_pct: parsePct(v.origin_pct),
    purpose_pct: parsePct(v.purpose_pct),
  }
}

/** The model forecast block, or undefined when it's missing or has no usable day. */
function parseForecast(f: unknown): RealForecast | undefined {
  if (!isObj(f) || !Array.isArray(f.days)) return undefined
  const days: RealForecastDay[] = f.days
    .filter((r): r is Record<string, unknown> => isObj(r) && typeof r.date === 'string' && DATE_RE.test(r.date))
    .map((r) => ({
      date: r.date as string,
      signal: num(r.signal),
      signal_lo: num(r.signal_lo),
      signal_hi: num(r.signal_hi),
      visitors_est: num(r.visitors_est),
      visitors_lo: num(r.visitors_lo),
      visitors_hi: num(r.visitors_hi),
      week_ahead_missing: r.week_ahead_missing === true,
    }))
    .filter((r) => r.visitors_est !== null && r.visitors_est >= 0)
  if (days.length === 0) return undefined
  return {
    model: str(f.model) ?? 'model',
    issued_from: str(f.issued_from),
    backtest_wape: num(f.backtest_wape),
    baseline_wape: num(f.baseline_wape),
    range_coverage: num(f.range_coverage),
    days: days.sort((a, b) => a.date.localeCompare(b.date)),
  }
}

/** Validate and normalise real_data.json. Returns null when nothing usable is left. */
export function parseReal(raw: unknown): RealData | null {
  if (!isObj(raw) || !isObj(raw.nodes)) return null
  const nodes: Record<string, RealNode> = {}
  for (const [id, n] of Object.entries(raw.nodes)) {
    if (!isObj(n) || !Array.isArray(n.daily)) continue
    const daily: RealDaily[] = []
    for (const r of n.daily) {
      if (!isObj(r) || typeof r.date !== 'string' || !DATE_RE.test(r.date)) continue
      const rec = { date: r.date } as RealDaily
      for (const f of NUM_FIELDS) (rec as unknown as Record<string, number | null>)[f] = num(r[f])
      if (rec.hotel_occ !== null && (rec.hotel_occ < 0 || rec.hotel_occ > 1.5)) rec.hotel_occ = null
      daily.push(rec)
    }
    if (daily.length === 0) continue
    const fwd: RealForward[] = Array.isArray(n.hotel_forward)
      ? n.hotel_forward
          .filter((r): r is Record<string, unknown> => isObj(r) && typeof r.date === 'string' && DATE_RE.test(r.date))
          .map((r) => ({ date: r.date as string, hotel_occ: num(r.hotel_occ), hotel_rooms_sold: num(r.hotel_rooms_sold), hotel_rooms_total: num(r.hotel_rooms_total) }))
      : []
    const c = isObj(n.calibration) ? n.calibration : {}
    const conf = c.confidence === 'high' || c.confidence === 'medium' || c.confidence === 'low' ? c.confidence : 'none'
    const asOf = isObj(n.as_of) ? n.as_of : {}
    nodes[id] = {
      measure: str(n.measure),
      signal_column: str(n.signal_column),
      calibration: {
        official_annual_2025: num(c.official_annual_2025),
        signal_sum_2025: num(c.signal_sum_2025),
        factor: num(c.factor),
        source: str(c.source) ?? '',
        status: str(c.status) ?? 'none',
        confidence: conf,
        method_text: str(c.method_text),
        method_text_ja: str(c.method_text_ja),
        official_period_label: str(c.official_period_label),
        official_period_label_ja: str(c.official_period_label_ja),
      },
      as_of: {
        visitors: str(asOf.visitors),
        weather: str(asOf.weather),
        traffic: str(asOf.traffic),
        hotel: str(asOf.hotel),
        survey: str(asOf.survey),
        google_maps: str(asOf.google_maps),
      },
      daily: daily.sort((a, b) => a.date.localeCompare(b.date)),
      hotel_forward: fwd,
      rakuten: parseRakuten(n.rakuten),
      survey: parseSurvey(n.survey),
      forecast: parseForecast(n.forecast),
    }
  }
  if (Object.keys(nodes).length === 0) return null
  return {
    generated_at: str(raw.generated_at) ?? '',
    today: str(raw.today) ?? '',
    shared_date: str(raw.shared_date),
    source: isObj(raw.source) ? { repo: str(raw.source.repo) ?? '', commit: str(raw.source.commit) } : { repo: '', commit: null },
    notes: Array.isArray(raw.notes) ? raw.notes.filter((x): x is string => typeof x === 'string') : [],
    nodes,
  }
}

/* ---------------- helpers ---------------- */

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function addDays(iso: string, k: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + k)
  return d.toISOString().slice(0, 10)
}

function dowOf(iso: string): string {
  return DOW[new Date(iso + 'T00:00:00Z').getUTCDay()]
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0)

function rowOn(n: RealNode | undefined, date: string): RealDaily | undefined {
  return n?.daily.find((r) => r.date === date)
}

/** The last SOCIAL_DAYS days to the latest day `covered` holds, or [] with no such day. */
function lastWindow(daily: RealDaily[], covered: (x: RealDaily) => boolean): RealDaily[] {
  const rows = daily.filter(covered)
  if (!rows.length) return []
  const asOf = rows[rows.length - 1].date
  return rows.filter((x) => x.date > addDays(asOf, -SOCIAL_DAYS))
}

const sumOf = (rows: RealDaily[], k: keyof RealDaily) => rows.reduce((a, x) => a + ((x[k] as number | null) ?? 0), 0)

/** Instagram captions and social mentions, scored, over the node's last weekly window. Null without any coverage. */
export function realSentiment(daily: RealDaily[]): RealSentiment | null {
  const rows = lastWindow(daily, (x) => x.social_mentions !== null || x.instagram_posts !== null)
  if (!rows.length) return null
  let weighted = 0
  let scored = 0
  const from = { instagram: 0, social: 0 }
  for (const x of rows) {
    for (const [src, n, mean] of [
      ['instagram', x.instagram_scored, x.instagram_sentiment_mean],
      ['social', x.social_scored, x.social_sentiment_mean],
    ] as const) {
      if (!n || mean === null) continue
      weighted += n * mean
      scored += n
      from[src] += n
    }
  }
  return {
    as_of: rows[rows.length - 1].date,
    days: rows.length,
    scored,
    score: scored >= MIN_SENTIMENT_ITEMS ? Math.round((weighted / scored) * 100) / 100 : null,
    positive: sumOf(rows, 'instagram_positive') + sumOf(rows, 'social_positive'),
    neutral: sumOf(rows, 'instagram_neutral') + sumOf(rows, 'social_neutral'),
    negative: sumOf(rows, 'instagram_negative') + sumOf(rows, 'social_negative'),
    from,
  }
}

function statusOf(realCount: number, total: number): SourceInfo['status'] {
  if (realCount === 0) return 'demo'
  return realCount >= total ? 'real' : 'mixed'
}

function maxDate(ds: (string | null | undefined)[]): string | null {
  const v = ds.filter((x): x is string => !!x).sort()
  return v.length ? v[v.length - 1] : null
}

const MEASURE_LABEL: Record<string, string> = {
  camera: 'camera detections',
  vehicles: 'vehicle counts',
  reservations: 'museum bookings',
  hotel_guests: 'hotel guests',
  proxy_camera: 'nearest-camera proxy',
  proxy_survey: 'survey proxy',
}

export function measureLabel(m: string | null): string {
  return m ? (MEASURE_LABEL[m] ?? m) : 'no signal'
}

/* ---------------- live merge ---------------- */

export interface Merged {
  live: LiveData
  market: MarketVoiceData | null
  sources: DataSources
  real: RealData | null
}

/**
 * The demo day to show on `date`, for a demo of `n` days from `start`: the demo's own day
 * on its own dates, else its day of the same weekday (the timeline follows the clock, the
 * demo doesn't), else its first day.
 */
function demoDayFor(start: string, n: number, date: string): number {
  for (let k = 0; k < n; k++) if (addDays(start, k) === date) return k
  const dow = dowOf(date)
  for (let k = 0; k < n; k++) if (dowOf(addDays(start, k)) === dow) return k
  return 0
}

/** Hour index → the demo hour for that date and hour (see demoDayFor). */
function demoIndexFor(demo: LiveData, dayDate: string, h: number): number {
  return demoDayFor(demo.start, demo.days.length, dayDate) * 24 + h
}

function synthWeather(r: RealDaily, h: number): { temp: number; mm: number; wind: number; pop: number; cond: WeatherCondition } {
  const t = r.temp_c ?? 20
  const temp = t + 3.2 * Math.sin(((h - 9) / 24) * 2 * Math.PI)
  const mmDay = r.precip_mm ?? 0
  // Rain is spread over the wetter half of the day (afternoon-weighted) rather than flat.
  const w = 0.6 + 0.8 * Math.max(0, Math.sin(((h - 6) / 24) * 2 * Math.PI))
  const mm = mmDay > 0 ? (mmDay / 24) * w : 0
  const night = h < 6 || h >= 18
  let cond: WeatherCondition
  if (r.snow_cm && r.snow_cm > 0 && t < 2) cond = 'snow'
  else if (mmDay >= 30) cond = 'heavy_rain'
  else if (mmDay >= 1) cond = 'rain'
  else if ((r.sun_h ?? 0) >= 0.5) cond = night ? 'clear_night' : 'clear'
  else if ((r.sun_h ?? 0) >= 0.2) cond = night ? 'partly_night' : 'partly'
  else cond = 'cloudy'
  const pop = mmDay >= 10 ? 90 : mmDay >= 1 ? 70 : mmDay > 0 ? 40 : 10
  return { temp: Math.round(temp * 10) / 10, mm: Math.round(mm * 10) / 10, wind: Math.round((r.wind_ms ?? 2) * 10) / 10, pop, cond }
}

const NAIVE_METHOD = 'Median of recent same weekdays (up to 4 in the last 8 weeks; holidays skipped for a normal day), real visitors_est, spread over the day with the demo hourly shape.'

function forecastMethod(rn: RealNode): string {
  const f = rn.forecast
  if (!f) return NAIVE_METHOD
  const pct = (v: number | null) => (v === null ? '?' : `${Math.round(v * 1000) / 10}%`)
  const last = f.days[f.days.length - 1].date
  const flagged = f.days.filter((d) => d.week_ahead_missing).map((d) => d.date)
  const naive = `${NAIVE_METHOD.charAt(0).toLowerCase()}${NAIVE_METHOD.slice(1)}`
  return (
    `7-day model forecast (${f.model}) up to ${last}: backtest error ${pct(f.backtest_wape)} vs ` +
    `${pct(f.baseline_wape)} for "same weekday last week"; its range held ${pct(f.range_coverage)} of unseen ` +
    `backtest days. Scaled with the same factor as the history and spread over the day with the demo hourly shape. ` +
    (flagged.length ? `${flagged.join(', ')}: the week-ahead bookings were late, so these days use the ${naive.replace(/\.$/, '')}. ` : '') +
    `Later days: ${naive}`
  )
}

/** JST date and hour of a moment. */
function jstNow(now: Date): { date: string; hour: number } {
  const j = new Date(now.getTime() + 9 * 3600 * 1000)
  return { date: j.toISOString().slice(0, 10), hour: j.getUTCHours() }
}

/**
 * With real data the timeline follows the clock: today is `now`'s JST date and
 * "now" its hour, PAST_DAYS before it and as many days after as the demo has.
 * Demo values on dates the demo doesn't cover come from its same weekday.
 */
export function mergeAll(demo: LiveData, demoMarket: MarketVoiceData | null, real: RealData | null, hourly?: HourlyWeather | null, now: Date = new Date(), warnings?: WarningsRead | null): Merged {
  if (!real) return { live: demo, market: demoMarket, sources: {}, real: null }

  const clock = jstNow(now)
  const today = clock.date
  const P = PAST_DAYS
  const dates = Array.from({ length: P + demo.days.length }, (_, k) => addDays(today, k - P))
  const D = dates.length
  const H = D * 24
  const days = dates.map((date) => {
    const dow = dowOf(date)
    const demoDay = demo.days.find((d) => d.date === date)
    return { date, dow, weekend: dow === 'Sat' || dow === 'Sun', holiday: isHoliday(date) || (demoDay?.holiday ?? false) }
  })
  const di = (dayIdx: number, h: number) => demoIndexFor(demo, dates[dayIdx], h)
  const pick = <T,>(arr: T[], dayIdx: number, h: number): T => arr[di(dayIdx, h)]

  const node_meta: Record<string, RealNodeMeta> = {}
  const nodes: LiveData['nodes'] = {}
  const peopleReal: string[] = []
  const weatherReal: string[] = []
  let lastObservedDay = -1
  // Real sentiment is one weekly figure per node, not per day: the layer shows it whichever day is picked.
  const sentimentOf: Record<string, RealSentiment | undefined> = Object.fromEntries(
    Object.keys(demo.nodes).map((id) => [id, real.nodes[id] ? (realSentiment(real.nodes[id].daily) ?? undefined) : undefined]),
  )
  const sentimentReal = Object.keys(sentimentOf).filter((id) => sentimentOf[id] && sentimentOf[id]!.score !== null)

  for (const [id, dn] of Object.entries(demo.nodes)) {
    const rn = real.nodes[id]
    const visitorsDaily = dates.map((dt) => rowOn(rn, dt)?.visitors_est ?? null)
    const signalDaily = dates.map((dt) => rowOn(rn, dt)?.signal ?? null)
    const hist = (rn?.daily ?? []).map((r) => r.visitors_est).filter((v): v is number => v !== null)
    const normal = mean(hist)
    const noEstimate = !!rn && rn.calibration.factor === null
    const hasPeople = !!rn && hist.length > 0

    // Naive seasonal forecast: median visitors_est of the last 4 same weekdays found.
    // For a normal day, holidays and Obon are skipped (a holiday Tuesday would overstate
    // a normal one) and the search goes back up to 8 weeks to still find 4 normal days.
    // A median, like the demand alerts' normal day it's compared with (lib/normal.ts): the
    // two changed together, so one Silver Week day or one glitchy count moves neither.
    const sameWeekday = (dt: string) => {
      const skip = (day: string) => !isHoliday(dt) && isHoliday(day)
      const vals: number[] = []
      for (let w = 1; w <= 8 && vals.length < 4; w++) {
        const day = addDays(dt, -7 * w)
        const v = rowOn(rn, day)?.visitors_est
        if (v !== null && v !== undefined && !skip(day)) vals.push(v)
      }
      if (vals.length < 2) {
        // Fall back to any same-weekday values in the history window.
        const dow = dowOf(dt)
        for (const r of rn?.daily ?? []) if (r.visitors_est !== null && dowOf(r.date) === dow && !skip(r.date)) vals.push(r.visitors_est)
      }
      return median(vals)
    }
    // The model's 7-day forecast where published; the naive one covers the days after it,
    // and days the model ran without its week-ahead bookings (its backtest error doesn't apply).
    const modelDay = (dt: string) => rn?.forecast?.days.find((x) => x.date === dt && !x.week_ahead_missing)

    const arrA: (number | null)[] = []
    const arrP: number[] = []
    const osA: (number | null)[] = []
    const osP: number[] = []
    const lo: number[] = []
    const hi: number[] = []
    const fcSource: RealNodeMeta['forecast_source_daily'] = []
    const fcLo: (number | null)[] = []
    const fcHi: (number | null)[] = []
    for (let d = 0; d < D; d++) {
      const demoArr = Array.from({ length: 24 }, (_, h) => pick(dn.arrivals.predicted, d, h))
      const demoTotal = Math.max(1, sum(demoArr))
      const realV = hasPeople ? visitorsDaily[d] : null
      const md = hasPeople && d >= P ? modelDay(dates[d]) : undefined
      const fc = md?.visitors_est ?? (hasPeople && d >= P ? sameWeekday(dates[d]) : null)
      fcSource.push(md?.visitors_est != null ? 'model' : fc !== null ? 'naive' : null)
      fcLo.push(md?.visitors_lo ?? null)
      fcHi.push(md?.visitors_hi ?? null)
      const kA = realV !== null ? realV / demoTotal : null
      const kP = fc !== null ? fc / demoTotal : realV !== null ? (sameWeekday(dates[d]) ?? realV) / demoTotal : 1
      // The model's own low/high range when it has one, else the demo band scaled like the forecast.
      const kLo = md?.visitors_lo != null ? md.visitors_lo / demoTotal : null
      const kHi = md?.visitors_hi != null ? md.visitors_hi / demoTotal : null
      for (let h = 0; h < 24; h++) {
        const i = di(d, h)
        const pa = dn.arrivals.predicted[i]
        const po = dn.on_site.predicted[i]
        arrP.push(Math.round(pa * kP))
        osP.push(Math.round(po * kP))
        lo.push(Math.round(kLo !== null ? po * kLo : (dn.on_site.lo?.[i] ?? po) * kP))
        hi.push(Math.round(kHi !== null ? po * kHi : (dn.on_site.hi?.[i] ?? po) * kP))
        if (kA !== null) {
          arrA.push(Math.round(pa * kA))
          osA.push(Math.round(po * kA))
        } else if (!hasPeople && d >= P) {
          // Demo-only node: keep the demo "actuals" on the demo's own days.
          arrA.push(dn.arrivals.actual[i] ?? null)
          osA.push(dn.on_site.actual[i] ?? null)
        } else {
          arrA.push(null)
          osA.push(null)
        }
      }
      if (realV !== null) lastObservedDay = Math.max(lastObservedDay, d)
    }
    if (hasPeople) peopleReal.push(id)

    // Weather
    const wx = dn.weather
    const temp: number[] = []
    const mm: number[] = []
    const wind: number[] = []
    const pop: number[] = []
    const cond: WeatherCondition[] = []
    const realDays: boolean[] = []
    const hourlySource: ('observed' | 'forecast' | null)[] = []
    for (let d = 0; d < D; d++) {
      const r = rowOn(rn, dates[d])
      const isReal = !!r && r.temp_c !== null
      realDays.push(isReal)
      for (let h = 0; h < 24; h++) {
        // The daily-based value (real day) or the demo's, for anything the hourly row lacks.
        const fb = isReal
          ? synthWeather(r!, h)
          : { temp: pick(wx.temp_c, d, h), mm: pick(wx.precip_mm, d, h), wind: pick(wx.wind_ms, d, h), pop: pick(wx.precip_pct, d, h), cond: pick(wx.condition, d, h) }
        // An hour without a rain amount isn't used at all (not a real 0 mm); a missing wind
        // reading takes the fallback too, so a false calm can't hide the wind nudge.
        const hr = rowForSlot(hourly?.[id], dates[d], h)
        hourlySource.push(usable(hr) ? hr.source : null)
        if (usable(hr)) {
          temp.push(hr.temp_c!)
          mm.push(hr.precip_mm!)
          wind.push(hr.wind_ms ?? fb.wind)
          pop.push(popOf(hr))
          cond.push(conditionOf(hr, h))
        } else {
          temp.push(fb.temp)
          mm.push(fb.mm)
          wind.push(fb.wind)
          pop.push(fb.pop)
          cond.push(fb.cond)
        }
      }
    }
    if (realDays.some(Boolean) || hourlySource.some(Boolean)) weatherReal.push(id)

    const series = (a: (number | null)[], p: number[], l?: number[], hh?: number[]): LiveSeries => ({ actual: a, predicted: p, lo: l, hi: hh })
    const sentimentPad = <T,>(arr: T[]): T[] => dates.map((dt) => arr[demoDayFor(demo.start, demo.days.length, dt)] ?? arr[0])
    nodes[id] = {
      ...dn,
      on_site: series(osA, osP, lo, hi),
      arrivals: series(arrA, arrP),
      weather: {
        ...wx,
        temp_c: temp,
        precip_mm: mm,
        wind_ms: wind,
        precip_pct: pop,
        condition: cond,
        sun_h: dates.map((dt) => rowOn(rn, dt)?.sun_h ?? null),
        humidity_pct: dates.map((dt) => rowOn(rn, dt)?.humidity_pct ?? null),
        snow_cm: dates.map((dt) => rowOn(rn, dt)?.snow_cm ?? null),
        daily_temp_c: dates.map((dt) => rowOn(rn, dt)?.temp_c ?? null),
        daily_precip_mm: dates.map((dt) => rowOn(rn, dt)?.precip_mm ?? null),
        daily_wind_ms: dates.map((dt) => rowOn(rn, dt)?.wind_ms ?? null),
        real_days: realDays,
        hourly_source: hourlySource,
      },
      sentiment: {
        score: sentimentPad(dn.sentiment.score),
        posts: sentimentPad(dn.sentiment.posts),
        keywords: sentimentPad(dn.sentiment.keywords),
        real: sentimentOf[id],
      },
    }
    if (rn) {
      node_meta[id] = {
        measure: rn.measure,
        confidence: rn.calibration.confidence,
        factor: rn.calibration.factor,
        official_2025: rn.calibration.official_annual_2025,
        calibration_source: rn.calibration.source,
        method_text: rn.calibration.method_text,
        method_text_ja: rn.calibration.method_text_ja,
        official_period_label: rn.calibration.official_period_label,
        official_period_label_ja: rn.calibration.official_period_label_ja,
        visitors_as_of: rn.as_of.visitors ?? null,
        no_estimate: noEstimate,
        visitors_daily: visitorsDaily,
        signal_daily: signalDaily,
        index_daily: dates.map((dt) => rowOn(rn, dt)?.signal_index_pct ?? null),
        normal_daily: normal,
        normal_by_day: dates.map((dt) => weekdayNormal((day) => rowOn(rn, day)?.visitors_est, dt)),
        forecast_method: forecastMethod(rn),
        forecast_source_daily: fcSource,
        forecast_lo_daily: fcLo,
        forecast_hi_daily: fcHi,
      }
    }
  }

  // Flows: demo shape of the same weekday, scaled by the destination node's real/forecast ratio.
  const flows: LiveData['flows'] = {}
  const ROUTE_DEST: Record<string, string> = {}
  for (const rid of Object.keys(demo.flows)) {
    const parts = rid.replace(/^rail-/, '').split('-')
    ROUTE_DEST[rid] = parts[parts.length - 1]
  }
  for (const [rid, f] of Object.entries(demo.flows)) {
    const dest = ROUTE_DEST[rid]
    const n = nodes[dest]
    const dnn = demo.nodes[dest]
    const fw: number[] = []
    const rv: number[] = []
    for (let d = 0; d < D; d++) {
      let k = 1
      if (n && dnn) {
        const demoTot = Math.max(1, sum(Array.from({ length: 24 }, (_, h) => pick(dnn.arrivals.predicted, d, h))))
        const tot = sum(Array.from({ length: 24 }, (_, h) => n.arrivals.actual[d * 24 + h] ?? n.arrivals.predicted[d * 24 + h]))
        k = Math.max(0.2, Math.min(3, tot / demoTot))
      }
      for (let h = 0; h < 24; h++) {
        fw.push(Math.round(pick(f.forward, d, h) * k))
        rv.push(Math.round(pick(f.reverse, d, h) * k))
      }
    }
    flows[rid] = { ...f, forward: fw, reverse: rv }
  }

  // Traffic: route → node with a counter. A zero or today's partial day counts as no reading.
  const COUNTER: Record<string, string> = {
    'fukui_station-katsuyama': 'katsuyama',
    'fukui_station-eiheiji': 'eiheiji',
    'fukui_station-rainbow_line': 'rainbow_line',
    'fukui_station-awara_onsen': 'fukui_station',
  }
  const traffic: LiveData['traffic'] = {}
  const trafficReal: string[] = []
  for (const [rid, tr] of Object.entries(demo.traffic)) {
    const node = COUNTER[rid]
    const rn = node ? real.nodes[node] : undefined
    const vols = dates.map((dt) => {
      const v = rowOn(rn, dt)?.traffic_volume ?? null
      return v !== null && v > 0 && dt < real.today ? v : null
    })
    const base = mean((rn?.daily ?? []).map((r) => r.traffic_volume).filter((v): v is number => v !== null && v > 0))
    const realDays = vols.map((v) => v !== null && base !== null)
    const congestion = tr.congestion.map((seg) => {
      const out: number[] = []
      for (let d = 0; d < D; d++) {
        const k = realDays[d] ? Math.max(0.5, Math.min(1.6, vols[d]! / base!)) : 1
        for (let h = 0; h < 24; h++) out.push(Math.round(Math.min(0.98, pick(seg, d, h) * k) * 100) / 100)
      }
      return out
    })
    const vph: number[] = []
    for (let d = 0; d < D; d++) for (let h = 0; h < 24; h++) vph.push(realDays[d] ? Math.round((vols[d]! * pick(tr.vehicles_per_hour, d, h)) / Math.max(1, sum(Array.from({ length: 24 }, (_, hh) => pick(tr.vehicles_per_hour, d, hh))))) : pick(tr.vehicles_per_hour, d, h))
    if (realDays.some(Boolean)) trafficReal.push(rid)
    traffic[rid] = { ...tr, congestion, vehicles_per_hour: vph, counter_node: rn ? node : undefined, real_volume: vols, real_days: realDays }
  }

  const shift = P * 24
  const nodeIds = Object.keys(demo.nodes)
  // "Observed" runs to the shared date (the latest day every node has data for), not to the
  // freshest single node (Katsuyama bookings are known for today already).
  const sharedIdx = real.shared_date ? dates.indexOf(real.shared_date) : -1
  const obsDay = sharedIdx >= 0 ? sharedIdx : lastObservedDay
  const nowIndex = P * 24 + clock.hour
  // Never "observed" past now (a node with today's data still only has it up to now).
  const observedUntil = Math.min(nowIndex, obsDay >= 0 ? obsDay * 24 + 23 : nowIndex)
  const sources: DataSources = {
    people: { status: statusOf(peopleReal.length, nodeIds.length), as_of: maxDate(peopleReal.map((id) => real.nodes[id].as_of.visitors)), real: peopleReal },
    density: { status: statusOf(peopleReal.length, nodeIds.length), as_of: maxDate(peopleReal.map((id) => real.nodes[id].as_of.visitors)), real: peopleReal },
    flow: { status: peopleReal.length ? 'mixed' : 'demo', as_of: maxDate(peopleReal.map((id) => real.nodes[id].as_of.visitors)), real: peopleReal },
    weather: { status: statusOf(weatherReal.length, nodeIds.length), as_of: maxDate(weatherReal.map((id) => real.nodes[id].as_of.weather)), real: weatherReal },
    traffic: { status: trafficReal.length ? 'mixed' : 'demo', as_of: maxDate(trafficReal.map((rid) => real.nodes[COUNTER[rid]]?.as_of.traffic)), real: trafficReal },
    nudges: { status: peopleReal.length ? 'mixed' : 'demo', as_of: real.shared_date, real: peopleReal },
    sentiment: { status: statusOf(sentimentReal.length, nodeIds.length), as_of: maxDate(sentimentReal.map((id) => sentimentOf[id]!.as_of)), real: sentimentReal },
  }

  const live: LiveData = {
    ...demo,
    start: dates[0],
    hours: H,
    days,
    observed_until: observedUntil,
    today_day: P,
    now_index: nowIndex,
    nodes,
    flows,
    traffic,
    advisories: demo.advisories.map((a) => ({ ...a, start: a.start + shift, end: a.end + shift })),
    // JMA's live warnings once read (none in force is an empty list); the demo ones only until then.
    weather_alerts: warnings
      ? toAlerts(warnings, dates[0], nowIndex, now)
      : demo.weather_alerts.map((a) => ({ ...a, start: a.start + shift, end: a.end + shift, demo: true })),
    node_meta,
    sources,
    shared_date: real.shared_date,
  }

  const market = demoMarket ? mergeMarket(demoMarket, real, dates, sources) : null
  return { live, market, sources, real }
}

/* ---------------- market merge ---------------- */

/** FTAS reservation feed behind each hotel area (Tojinbo, Katsuyama and Eiheiji share the regional coastal feed). */
const HOTEL_FEED: Record<string, string> = {
  fukui_station: 'fukui_station',
  awara_onsen: 'awara_onsen',
  echizen_coast: 'tojinbo',
  mikata_five_lakes: 'rainbow_line',
}

/** Search-intent municipality → node whose Google Maps profile it shows. */
const RSI_NODE: Record<string, string> = {
  fukui: 'fukui_station',
  sakai: 'tojinbo',
  awara: 'awara_onsen',
  katsuyama: 'katsuyama',
  eiheiji: 'eiheiji',
  mihama_wakasa: 'rainbow_line',
}

function mergeMarket(m: MarketVoiceData, real: RealData, dates: string[], sources: DataSources): MarketVoiceData {
  const D = dates.length
  // Demo values for a merged day: the demo's day for that date or weekday (see demoDayFor).
  const padDay = <T,>(arr: T[], d: number): T => arr[Math.min(arr.length - 1, demoDayFor(m.start, m.days, dates[d]))]

  const hotelReal: string[] = []
  // Real Rakuten shares for the node an area serves; a missing lead keeps its demo value.
  const withRakuten = (h: HotelArea): HotelArea => {
    const rk = real.nodes[h.node]?.rakuten
    if (!rk) return h
    const demo = h.rakuten.share_with_rooms_pct
    const s = rk.share_with_rooms_pct
    return { ...h, rakuten: { ...h.rakuten, share_with_rooms_pct: { d1: s.d1 ?? demo.d1, d7: s.d7 ?? demo.d7, d30: s.d30 ?? demo.d30 }, real: { as_of: rk.as_of } } }
  }
  const hotels = m.hotels.map((h0) => {
    const h = withRakuten(h0)
    const rn = real.nodes[HOTEL_FEED[h.id]]
    if (!rn) {
      return { ...h, occupancy_pct: Array.from({ length: D }, (_, d) => padDay(h.occupancy_pct, d)), rooms_left: Array.from({ length: D }, (_, d) => padDay(h.rooms_left, d)) }
    }
    const occ: number[] = []
    const left: number[] = []
    const adr: (number | null)[] = []
    const realDays: boolean[] = []
    let total = h.rooms_total
    for (let d = 0; d < D; d++) {
      const r = rowOn(rn, dates[d])
      const f = rn.hotel_forward.find((x) => x.date === dates[d])
      const o = r?.hotel_occ ?? f?.hotel_occ ?? null
      const t = r?.hotel_rooms_total ?? f?.hotel_rooms_total ?? null
      const sold = r?.hotel_rooms_sold ?? f?.hotel_rooms_sold ?? null
      if (t) total = t
      if (o !== null) {
        occ.push(Math.round(o * 100))
        left.push(t !== null && sold !== null ? Math.max(0, Math.round(t - sold)) : Math.round(total * (1 - o)))
        realDays.push(true)
      } else {
        occ.push(padDay(h.occupancy_pct, d))
        left.push(padDay(h.rooms_left, d))
        realDays.push(false)
      }
      adr.push(r?.hotel_adr_yen ?? null)
    }
    const fwdPoints = [1, 7, 14, 30, 60, 90]
      .map((k) => {
        const f = rn.hotel_forward.find((x) => x.date === addDays(real.today, k))
        return f && f.hotel_occ !== null ? { days_ahead: k, occ_pct: Math.round(f.hotel_occ * 100) } : null
      })
      .filter((x): x is { days_ahead: number; occ_pct: number } => x !== null)
    if (realDays.some(Boolean)) hotelReal.push(h.id)
    return { ...h, rooms_total: total, occupancy_pct: occ, rooms_left: left, adr_yen: adr, real_days: realDays, forward: fwdPoints, as_of: rn.as_of.hotel ?? null, real_feed_node: HOTEL_FEED[h.id] }
  })

  const rsiReal: string[] = []
  const rsi = m.rsi.map((a) => {
    const node = RSI_NODE[a.id]
    const rn = node ? real.nodes[node] : undefined
    const asOf = rn?.as_of.google_maps ?? null
    if (!rn || !asOf) return a
    const rows = rn.daily.filter((r) => r.date <= asOf && r.gmb_map_views !== null)
    if (rows.length < 7) return a
    const hist14 = rows.slice(-14).map((r) => r.gmb_map_views as number)
    const last = rows[rows.length - 1]
    const last7 = rows.slice(-7).reduce((s, r) => s + (r.gmb_map_views ?? 0), 0)
    const prev7 = rows.slice(-14, -7).reduce((s, r) => s + (r.gmb_map_views ?? 0), 0)
    rsiReal.push(a.id)
    return {
      ...a,
      history: hist14,
      change_7d_pct: prev7 > 0 ? Math.round((last7 / prev7 - 1) * 1000) / 10 : 0,
      gmb: {
        node,
        map_views: last.gmb_map_views ?? 0,
        search_views: last.gmb_search_views ?? 0,
        directions: last.gmb_directions ?? 0,
        history: hist14,
        as_of: asOf,
      },
    }
  })

  const reviewsReal: string[] = []
  const reviews = { ...m.reviews }
  for (const id of Object.keys(m.reviews)) {
    const rn = real.nodes[id]
    if (!rn) continue
    // Preferred: the node's own Google Maps listing (reviews log, weekly), when the
    // 30 days to its last covered day hold enough reviews. Rating, new reviews,
    // star split and total then all come from the same reviews. The Business
    // Profile numbers below are the fallback: for a node without a town file
    // (Fukui Station) they're the prefecture's total, not the node's listing.
    const covered = rn.daily.filter((x) => x.reviews_new !== null)
    const starsAsOf = covered.length ? covered[covered.length - 1].date : null
    if (starsAsOf) {
      const stars = (from: number, to: number) => {
        const rows = covered.filter((x) => x.date <= addDays(starsAsOf, -from) && x.date > addDays(starsAsOf, -to))
        return ([5, 4, 3, 2, 1] as const).map((s) => rows.reduce((a, x) => a + (x[`reviews_stars_${s}`] ?? 0), 0))
      }
      const mean = (c: number[]) => {
        const n = c.reduce((a, b) => a + b, 0)
        return n >= MIN_STAR_REVIEWS ? c.reduce((a, k, i) => a + k * (5 - i), 0) / n : null
      }
      const counts = stars(0, 30)
      const n = counts.reduce((a, b) => a + b, 0)
      const rating = mean(counts)
      const total = covered.map((x) => x.reviews_count_total).filter((v): v is number => v !== null).pop()
      if (rating !== null) {
        reviews[id] = {
          ...reviews[id],
          rating: Math.round(rating * 10) / 10,
          rating_30d_ago: Math.round((mean(stars(30, 60)) ?? rating) * 10) / 10,
          new_30d: n,
          distribution_pct: counts.map((c) => Math.round((c / n) * 100)),
          count: total ?? reviews[id].count,
          real: { as_of: starsAsOf, reviews_used: n },
          stars_real: { as_of: starsAsOf, n },
        }
        reviewsReal.push(id)
        continue
      }
    }
    const asOf = rn.as_of.google_maps ?? null
    if (!asOf) continue
    // gmb_rating is the day's average of new reviews (0 = none that day); weight by new reviews.
    const win = (from: number, to: number) => rn.daily.filter((x) => x.date <= addDays(asOf, -from) && x.date > addDays(asOf, -to) && (x.gmb_rating ?? 0) > 0)
    const wavg = (rows: RealDaily[]) => {
      const w = rows.reduce((s, x) => s + Math.max(1, x.gmb_review_change ?? 1), 0)
      return w ? rows.reduce((s, x) => s + (x.gmb_rating as number) * Math.max(1, x.gmb_review_change ?? 1), 0) / w : null
    }
    const cur = win(0, 30)
    const prev = win(30, 60)
    const rating = wavg(cur)
    if (rating === null) continue
    const newReviews = rn.daily.filter((x) => x.date <= asOf && x.date > addDays(asOf, -30)).reduce((s, x) => s + (x.gmb_review_change ?? 0), 0)
    reviews[id] = {
      ...reviews[id],
      rating: Math.round(rating * 10) / 10,
      rating_30d_ago: Math.round((wavg(prev) ?? rating) * 10) / 10,
      new_30d: Math.round(newReviews),
      real: { as_of: asOf, reviews_used: Math.round(newReviews) },
    }
    reviewsReal.push(id)
  }

  const surveyReal: string[] = []
  const survey = { ...m.survey }
  for (const [id, s] of Object.entries(m.survey)) {
    const rn = real.nodes[id]
    const asOf = rn?.as_of.survey ?? null
    if (!rn || !asOf) continue
    const n = rn.daily.filter((x) => x.date <= asOf && x.date > addDays(asOf, -30)).reduce((a, x) => a + (x.survey_responses ?? 0), 0)
    survey[id] = { ...s, responses_30d: Math.round(n), responses_real: { as_of: asOf } }
    const rs = rn.survey
    if (rs && rs.satisfaction !== null) {
      survey[id] = {
        ...survey[id],
        satisfaction: Math.round(rs.satisfaction * 10) / 10,
        // Hidden (null) rather than demo when too few answered the NPS question.
        nps: rs.nps === null ? null : Math.round(rs.nps),
        top_reasons: Object.entries(rs.purpose_pct)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([k, share]) => ({ ...(PURPOSE_LABELS[k] ?? { en: k, ja: k }), share: Math.round(share) })),
        origin_share: Object.entries(ORIGIN_LABELS)
          .filter(([k]) => rs.origin_pct[k] !== undefined)
          .map(([k, l]) => ({ ...l, share: Math.round(rs.origin_pct[k]) })),
        details_real: { as_of: rs.as_of, responses: rs.responses, nps_n: rs.nps_n },
      }
    }
    surveyReal.push(id)
  }

  // Instagram posts tagged at the site and Bluesky / YouTube / Reddit mentions: the
  // last SOCIAL_DAYS covered days of each weekly log. Only counts and scores are
  // published, so a real node has no feed.
  const socialReal: string[] = []
  const social = { ...m.social }
  for (const id of Object.keys(m.social)) {
    const daily = real.nodes[id]?.daily ?? []
    const rows = lastWindow(daily, (x) => x.instagram_posts !== null)
    const mrows = lastWindow(daily, (x) => x.social_mentions !== null)
    if (!rows.length && !mrows.length) continue
    const tot = (k: keyof RealDaily) => sumOf(rows, k)
    const mtot = (k: keyof RealDaily) => sumOf(mrows, k)
    // A platform that never ran in the window is unknown, not 0.
    const plat = (k: keyof RealDaily) => (mrows.some((x) => x[k] !== null) ? mtot(k) : null)
    social[id] = {
      ...social[id],
      mentions: mrows.length
        ? {
            as_of: mrows[mrows.length - 1].date,
            days: mrows.length,
            total: mtot('social_mentions'),
            posts: mtot('social_posts'),
            comments: mtot('social_comments'),
            platforms: { bluesky: plat('social_bluesky_mentions'), youtube: plat('social_youtube_mentions'), reddit: plat('social_reddit_mentions') },
            langs: {
              ja: mtot('social_lang_ja'),
              en: mtot('social_lang_en'),
              zh_hant: mtot('social_lang_zh_hant'),
              zh_hans: mtot('social_lang_zh_hans'),
              ko: mtot('social_lang_ko'),
              ar: mtot('social_lang_ar'),
              other: mtot('social_lang_other'),
            },
          }
        : undefined,
      sentiment_real: realSentiment(daily) ?? undefined,
    }
    if (!rows.length) {
      socialReal.push(id)
      continue
    }
    social[id] = {
      ...social[id],
      real: {
        as_of: rows[rows.length - 1].date,
        days: rows.length,
        posts: tot('instagram_posts'),
        photos: tot('instagram_photos'),
        videos: tot('instagram_videos'),
        likes: tot('instagram_likes'),
        comments: tot('instagram_comments'),
        scripts: {
          ja: tot('instagram_script_ja'),
          ko: tot('instagram_script_ko'),
          zh: tot('instagram_script_zh'),
          latin: tot('instagram_script_latin'),
          none: tot('instagram_script_none'),
        },
      },
    }
    socialReal.push(id)
  }

  sources.hotels = { status: statusOf(hotelReal.length, m.hotels.length), as_of: maxDate(hotels.map((h) => h.as_of ?? null)), real: hotelReal }
  sources.social = { status: statusOf(socialReal.length, Object.keys(m.social).length), as_of: maxDate(socialReal.flatMap((id) => [social[id].real?.as_of ?? null, social[id].mentions?.as_of ?? null])), real: socialReal }
  sources.rsi = { status: statusOf(rsiReal.length, m.rsi.length), as_of: maxDate(rsi.map((a) => a.gmb?.as_of ?? null)), real: rsiReal }
  sources.reviews = { status: reviewsReal.length ? 'mixed' : 'demo', as_of: maxDate(reviewsReal.map((id) => reviews[id].real?.as_of ?? null)), real: reviewsReal }
  sources.survey = { status: surveyReal.length ? 'mixed' : 'demo', as_of: maxDate(surveyReal.map((id) => real.nodes[id].as_of.survey)), real: surveyReal }

  return { ...m, start: dates[0], days: D, hotels, rsi, reviews, survey, social }
}
