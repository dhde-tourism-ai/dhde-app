// Validate public/data/real_data.json before a deploy. Exits non-zero (and the
// Pages workflow stops, leaving the previous site up) when the file exists but
// is malformed. A missing file is fine: the app then runs on demo data.
//
//   node scripts/check_data.mjs [path]
import { existsSync, readFileSync } from 'node:fs'

const path = process.argv[2] ?? 'public/data/real_data.json'
const errors = []
const fail = (m) => errors.push(m)
const isNum = (v) => v === null || (typeof v === 'number' && Number.isFinite(v))
const DATE = /^\d{4}-\d{2}-\d{2}$/
const NUM_FIELDS = [
  'signal', 'visitors_est', 'signal_index_pct', 'temp_c', 'precip_mm', 'wind_ms', 'sun_h', 'humidity_pct', 'snow_cm', 'traffic_volume',
  'hotel_occ', 'hotel_adr_yen', 'hotel_rooms_sold', 'hotel_rooms_total', 'survey_responses',
  'gmb_map_views', 'gmb_search_views', 'gmb_directions', 'gmb_rating', 'gmb_review_change',
  'reviews_new', 'reviews_stars_mean', 'reviews_stars_1', 'reviews_stars_2', 'reviews_stars_3', 'reviews_stars_4', 'reviews_stars_5', 'reviews_with_text', 'reviews_foreign', 'reviews_rating_total', 'reviews_count_total',
]

if (!existsSync(path)) {
  console.log(`${path} not found: the app will use demo data. OK.`)
  process.exit(0)
}

let j
try {
  j = JSON.parse(readFileSync(path, 'utf8'))
} catch (e) {
  console.error(`${path}: not valid JSON: ${e.message}`)
  process.exit(1)
}

if (typeof j !== 'object' || j === null || Array.isArray(j)) fail('top level must be an object')
if (typeof j.today !== 'string' || !DATE.test(j.today)) fail('today must be YYYY-MM-DD')
if (j.shared_date !== null && j.shared_date !== undefined && (typeof j.shared_date !== 'string' || !DATE.test(j.shared_date))) fail('shared_date must be YYYY-MM-DD or null')
if (typeof j.nodes !== 'object' || j.nodes === null || Array.isArray(j.nodes)) fail('nodes must be an object')

const nodes = Object.entries(j.nodes ?? {})
if (nodes.length === 0) fail('no nodes')
for (const [id, n] of nodes) {
  const p = `nodes.${id}`
  if (typeof n !== 'object' || n === null) {
    fail(`${p}: not an object`)
    continue
  }
  if (!Array.isArray(n.daily) || n.daily.length === 0) fail(`${p}.daily: missing or empty`)
  let prev = ''
  for (const [i, r] of (n.daily ?? []).entries()) {
    if (typeof r?.date !== 'string' || !DATE.test(r.date)) fail(`${p}.daily[${i}].date invalid`)
    else if (r.date <= prev) fail(`${p}.daily[${i}].date not increasing (${r.date})`)
    else prev = r.date
    for (const f of NUM_FIELDS) if (f in r && !isNum(r[f])) fail(`${p}.daily[${i}].${f} not a number or null`)
    if (typeof r.hotel_occ === 'number' && (r.hotel_occ < 0 || r.hotel_occ > 1.5)) fail(`${p}.daily[${i}].hotel_occ out of range: ${r.hotel_occ}`)
    if (typeof r.visitors_est === 'number' && r.visitors_est < 0) fail(`${p}.daily[${i}].visitors_est negative`)
  }
  if (n.hotel_forward !== undefined && !Array.isArray(n.hotel_forward)) fail(`${p}.hotel_forward must be an array`)
  for (const [i, r] of (n.hotel_forward ?? []).entries()) {
    if (typeof r?.date !== 'string' || !DATE.test(r.date)) fail(`${p}.hotel_forward[${i}].date invalid`)
    for (const f of ['hotel_occ', 'hotel_rooms_sold', 'hotel_rooms_total']) if (f in r && !isNum(r[f])) fail(`${p}.hotel_forward[${i}].${f} not a number or null`)
  }
  if (n.forecast !== undefined) {
    const f = n.forecast
    if (typeof f !== 'object' || f === null || !Array.isArray(f.days)) fail(`${p}.forecast must be an object with a days array`)
    else
      for (const [i, r] of f.days.entries()) {
        if (typeof r?.date !== 'string' || !DATE.test(r.date)) fail(`${p}.forecast.days[${i}].date invalid`)
        for (const k of ['signal', 'signal_lo', 'signal_hi', 'visitors_est', 'visitors_lo', 'visitors_hi']) if (k in r && !isNum(r[k])) fail(`${p}.forecast.days[${i}].${k} not a number or null`)
        if (typeof r.visitors_est === 'number' && r.visitors_est < 0) fail(`${p}.forecast.days[${i}].visitors_est negative`)
        if ('week_ahead_missing' in r && typeof r.week_ahead_missing !== 'boolean') fail(`${p}.forecast.days[${i}].week_ahead_missing not a boolean`)
      }
  }
  const c = n.calibration
  if (typeof c !== 'object' || c === null) fail(`${p}.calibration missing`)
  else {
    if (!isNum(c.factor)) fail(`${p}.calibration.factor not a number or null`)
    if (!['high', 'medium', 'low', 'none'].includes(c.confidence)) fail(`${p}.calibration.confidence invalid: ${c.confidence}`)
  }
}

if (errors.length) {
  console.error(`${path}: ${errors.length} problem(s)`)
  for (const e of errors.slice(0, 30)) console.error('  - ' + e)
  process.exit(1)
}
console.log(`${path}: OK (${nodes.length} nodes, shared_date ${j.shared_date})`)
