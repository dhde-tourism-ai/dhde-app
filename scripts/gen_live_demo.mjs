// Generates public/data/live_demo.json: DUMMY hourly data for the Map view's live
// layers (people, flows, traffic, weather, sentiment) for today + 7 days.
//
//   node scripts/gen_live_demo.mjs [--start 2026-09-27] [--now 14]
//
// Everything here is simulated. The shape is the contract the real pipeline will
// publish (see README "live_demo.json"); when it does, it replaces this file and
// sets "demo": false. Scale is anchored to the prefecture's 2025 annual visitor
// counts (入込数), so daily totals land in the low thousands per site.
import { writeFileSync } from 'node:fs'

const arg = (k, d) => {
  const i = process.argv.indexOf(k)
  return i === -1 ? d : process.argv[i + 1]
}
const START = arg('--start', '2026-09-27')
const NOW = Number(arg('--now', '14')) // last observed hour on day 0 (JST)
const DAYS = 8
const H = DAYS * 24

// Deterministic PRNG so the file is reproducible.
let seed = 20260927
const rand = () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const noise = (amp) => 1 + (rand() * 2 - 1) * amp
const r0 = (x) => Math.round(x)
const r1 = (x) => Math.round(x * 10) / 10
const r2 = (x) => Math.round(x * 100) / 100
const gauss = (x, mu, s) => Math.exp(-((x - mu) ** 2) / (2 * s * s))

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Japanese public holidays in the window can be listed here (none between 27 Sep and 4 Oct 2026).
const HOLIDAYS = new Set(['2026-10-12'])
const days = Array.from({ length: DAYS }, (_, d) => {
  const dt = new Date(START + 'T00:00:00Z')
  dt.setUTCDate(dt.getUTCDate() + d)
  const date = dt.toISOString().slice(0, 10)
  const dow = dt.getUTCDay()
  return { date, dow: DOW[dow], weekend: dow === 0 || dow === 6, holiday: HOLIDAYS.has(date) }
})
const dayFactor = (d) => {
  const x = days[d]
  if (x.holiday) return 1.5
  if (x.dow === 'Sat') return 1.45
  if (x.dow === 'Sun') return 1.35
  if (x.dow === 'Fri') return 0.9
  return 0.78
}

// ---------------- Weather (JMA-style, per node) ----------------
// Day plan: 0 Sun cloudy→sunny, 1 Mon sunny, 2 Tue rain from evening, 3 Wed heavy rain + strong
// coastal wind, 4 Thu showers clearing, 5 Fri sunny, 6 Sat sunny, 7 Sun cloudy.
const DAY_WX = [
  { base: 'partly', pop: 20, mm: 0, wind: 3.5, tmax: 25, tmin: 18 },
  { base: 'clear', pop: 10, mm: 0, wind: 3, tmax: 26, tmin: 17 },
  { base: 'cloudy', pop: 40, mm: 0.5, wind: 5, tmax: 24, tmin: 18, rainFrom: 17 },
  { base: 'heavy_rain', pop: 90, mm: 9, wind: 11, tmax: 21, tmin: 18 },
  { base: 'rain', pop: 60, mm: 2, wind: 7, tmax: 22, tmin: 17, clearFrom: 13 },
  { base: 'clear', pop: 10, mm: 0, wind: 3, tmax: 24, tmin: 15 },
  { base: 'clear', pop: 0, mm: 0, wind: 2.5, tmax: 25, tmin: 15 },
  { base: 'cloudy', pop: 30, mm: 0.2, wind: 4, tmax: 23, tmin: 16 },
]

const NODES = {
  tojinbo: {
    measure: 'people', annual: 651000, cap: 650, dwell: 1.2, outdoor: 1, coastal: 1.35, tOff: -0.5, wx: ['Mikuni', '三国'],
    hours: [7, 19], peak: 11.5,
    kw: [['breathtaking cliffs', '絶景の断崖'], ['sunset views', '夕日がきれい'], ['crowded parking', '駐車場が混雑'], ['strong wind', '風が強い'], ['fresh seafood', '海鮮がおいしい']],
  },
  fukui_station: {
    measure: 'people', annual: null, dailyBase: 4800, cap: 1100, dwell: 0.6, outdoor: 0.2, coastal: 1, tOff: 0.5, wx: ['Fukui', '福井'],
    hours: [6, 23], peak: 10.5,
    kw: [['dinosaur statues', '恐竜モニュメント'], ['easy transfer', '乗り換えが便利'], ['sauce katsudon', 'ソースカツ丼'], ['long bus wait', 'バス待ちが長い'], ['clean station', 'きれいな駅']],
  },
  katsuyama: {
    measure: 'proxy', annual: 1562000, cap: 2200, dwell: 2.6, outdoor: -0.15, coastal: 0.8, tOff: -2, wx: ['Katsuyama', '勝山'],
    hours: [9, 17], peak: 11.5,
    kw: [['kids loved it', '子供が大喜び'], ['long queue', '長い行列'], ['world-class fossils', '世界級の化石'], ['great museum', '素晴らしい博物館'], ['parking full', '駐車場が満車']],
  },
  rainbow_line: {
    measure: 'vehicles', annual: 443000, cap: 520, dwell: 1.0, outdoor: 1.1, coastal: 1.3, tOff: 0, wx: ['Mihama', '美浜'],
    hours: [8, 17], peak: 12,
    kw: [['five lakes view', '五湖の絶景'], ['scenic drive', '爽快なドライブ'], ['foggy summit', '山頂は霧'], ['foot baths', '足湯'], ['toll worth it', '有料でも価値あり']],
  },
  awara_onsen: {
    measure: 'proxy', annual: 658000, cap: 2600, dwell: 16, outdoor: 0.1, coastal: 1.1, tOff: 0, wx: ['Awara', 'あわら'],
    hours: [0, 24], peak: 15.5, onsen: true,
    kw: [['relaxing baths', '癒やしの湯'], ['kaiseki dinner', '会席料理'], ['shinkansen access', '新幹線で便利'], ['quiet streets', '静かな街並み'], ['foot bath plaza', '足湯広場']],
  },
  eiheiji: {
    measure: 'proxy', annual: 518000, cap: 700, dwell: 1.6, outdoor: 0.5, coastal: 0.9, tOff: -1.5, wx: ['Fukui (nearest)', '福井（最寄り）'],
    hours: [8, 17], peak: 11,
    kw: [['serene temple', '静寂の寺'], ['moss and cedars', '苔と杉並木'], ['zazen experience', '座禅体験'], ['steep stairs', '急な階段'], ['sesame tofu', 'ごま豆腐']],
  },
}
const IDS = Object.keys(NODES)

function weatherFor(id) {
  const n = NODES[id]
  const out = { station: n.wx[0], station_ja: n.wx[1], temp_c: [], precip_pct: [], precip_mm: [], wind_ms: [], condition: [] }
  for (let h = 0; h < H; h++) {
    const d = Math.floor(h / 24), hr = h % 24, w = DAY_WX[d]
    let cond = w.base, pop = w.pop, mm = w.mm, wind = w.wind * n.coastal
    if (w.rainFrom !== undefined && hr >= w.rainFrom) { cond = 'rain'; pop = 70; mm = 2.5 }
    if (w.clearFrom !== undefined && hr >= w.clearFrom) { cond = 'partly'; pop = 20; mm = 0; wind *= 0.6 }
    if (d === 0 && hr < 10) { cond = 'cloudy'; pop = 30 }
    if (d === 3) {
      // Heavy rain band passes 06:00–20:00, heaviest on the coast late morning; thunder at midday.
      const band = gauss(hr, 12, 4)
      mm = (1 + 16 * band) * (n.coastal > 1.2 ? 1.25 : n.coastal < 0.85 ? 0.8 : 1)
      pop = Math.min(100, 60 + 40 * band)
      cond = mm > 8 ? (hr >= 11 && hr <= 14 ? 'thunder' : 'heavy_rain') : 'rain'
      wind = (6 + 8 * band) * n.coastal
    }
    const isNight = hr < 6 || hr >= 18
    if (cond === 'clear' && isNight) cond = 'clear_night'
    if (cond === 'partly' && isNight) cond = 'partly_night'
    const t = w.tmin + (w.tmax - w.tmin) * (0.5 - 0.5 * Math.cos(((hr - 4) / 24) * 2 * Math.PI)) + n.tOff
    out.temp_c.push(r1(t + (rand() - 0.5) * 0.6))
    out.precip_pct.push(Math.max(0, Math.min(100, Math.round((pop + (rand() - 0.5) * 10) / 10) * 10)))
    out.precip_mm.push(r1(Math.max(0, mm * noise(0.25))))
    out.wind_ms.push(r1(Math.max(0.5, wind * noise(0.15))))
    out.condition.push(cond)
  }
  return out
}

const WX = Object.fromEntries(IDS.map((id) => [id, weatherFor(id)]))

// ---------------- People: hourly arrivals and on-site counts ----------------
function hourShape(n, hr) {
  if (n.onsen) {
    // Check-in peak mid-afternoon, a morning bump from day visitors to the foot baths.
    return gauss(hr, 15.5, 1.6) + 0.25 * gauss(hr, 11, 1.5)
  }
  const [open, close] = n.hours
  if (hr < open - 1 || hr >= close) return 0.02 * (n === NODES.fukui_station ? 3 : 1)
  // Arrivals peak ~10:00–13:00 with a smaller mid-afternoon shoulder.
  return gauss(hr, n.peak, 1.9) + 0.35 * gauss(hr, 14.8, 1.4)
}

const people = {}
for (const id of IDS) {
  const n = NODES[id]
  const base = n.annual ? n.annual / 365 : n.dailyBase
  const shapeSum = Array.from({ length: 24 }, (_, hr) => hourShape(n, hr)).reduce((a, b) => a + b, 0)
  const arrP = [], arrA = []
  for (let h = 0; h < H; h++) {
    const d = Math.floor(h / 24), hr = h % 24
    const wxPen = Math.min(1, WX[id].precip_mm[h] / 10) * 0.45 * n.outdoor
    const daily = base * dayFactor(d) * 1.02
    const pred = (daily * hourShape(n, hr)) / shapeSum
    arrP.push(pred * (1 - Math.max(-0.2, wxPen)))
    // Observed only up to NOW on day 0; a sunny Sunday runs a little ahead of forecast at the coast.
    arrA.push(h <= NOW ? pred * (1 - Math.max(-0.2, wxPen)) * noise(0.12) * (id === 'tojinbo' ? 1.12 : 1) : null)
  }
  // On-site = arrivals still within their dwell time (exponential dwell).
  const onSite = (arr) => {
    const out = []
    let occ = n.onsen ? base * 0.55 : 0 // overnight guests already in town at 00:00
    const stay = Math.exp(-1 / n.dwell)
    for (let h = 0; h < arr.length; h++) {
      if (arr[h] === null) { out.push(null); continue }
      occ = occ * stay + arr[h]
      out.push(occ)
    }
    return out
  }
  const osP = onSite(arrP)
  // Actual on-site continues the predicted trajectory where arrivals are observed.
  const osA = onSite(arrA.map((v, h) => (h <= NOW ? v : null)))
  const spread = (h) => 0.1 + 0.02 * Math.floor(h / 24) // band widens with horizon
  people[id] = {
    measure: n.measure,
    annual_visitors_2025: n.annual,
    comfortable_capacity: n.cap,
    on_site: {
      actual: osA.map((v) => (v === null ? null : r0(v))),
      predicted: osP.map(r0),
      lo: osP.map((v, h) => r0(v * (1 - spread(h)))),
      hi: osP.map((v, h) => r0(v * (1 + spread(h)))),
    },
    arrivals: { actual: arrA.map((v) => (v === null ? null : r0(v))), predicted: arrP.map(r0) },
    weather: WX[id],
  }
}

// ---------------- Sentiment (daily) ----------------
for (const id of IDS) {
  const n = NODES[id]
  const score = [], posts = [], keywords = []
  for (let d = 0; d < DAYS; d++) {
    const dayRain = Math.max(...WX[id].precip_mm.slice(d * 24, d * 24 + 24))
    const crowd = dayFactor(d) > 1.2 && n.cap < 1000 ? 0.12 : 0
    let s = 0.42 + (rand() - 0.5) * 0.12 - Math.min(0.7, dayRain / 14) * (0.4 + 0.5 * Math.max(0, n.outdoor)) - crowd
    if (id === 'awara_onsen' && dayRain > 3) s += 0.15 // rainy days fill the baths
    score.push(r2(Math.max(-1, Math.min(1, s))))
    posts.push(r0(((n.annual ?? n.dailyBase * 365) / 365) * dayFactor(d) * 0.035 * noise(0.2)))
    const kws = s < 0.1 ? [n.kw[3], n.kw[2]] : crowd ? [n.kw[0], n.kw[2]] : [n.kw[0], n.kw[1], n.kw[4]]
    keywords.push(kws.map(([en, ja]) => ({ en, ja })))
  }
  people[id].sentiment = { score, posts, keywords }
}

// ---------------- Flows along routes (people per hour, each direction) ----------------
// forward = route.from → route.to. share = fraction of the destination's daily visitors
// that use this corridor; arrival/departure hours follow day-trip rhythm unless noted.
const arrShape = (hr) => gauss(hr, 11, 1.8) + 0.3 * gauss(hr, 14, 1.2)
const depShape = (hr) => gauss(hr, 16.5, 1.6) + 0.25 * gauss(hr, 13, 1.2)
const shapeNorm = (f) => Array.from({ length: 24 }, (_, h) => f(h)).reduce((a, b) => a + b, 0)
const FLOWS = [
  // [route id, mode, destination node, share, forwardShape, reverseShape, extra]
  ['fukui_station-tojinbo', 'road', 'tojinbo', 0.24, arrShape, depShape],
  ['fukui_station-eiheiji', 'road', 'eiheiji', 0.45, arrShape, depShape],
  ['fukui_station-katsuyama', 'road', 'katsuyama', 0.34, arrShape, depShape],
  ['fukui_station-rainbow_line', 'road', 'rainbow_line', 0.3, arrShape, depShape],
  ['fukui_station-awara_onsen', 'road', 'awara_onsen', 0.18, (h) => gauss(h, 15, 1.8), (h) => gauss(h, 10, 1.5)],
  // Onsen guests visit Tojinbo after checkout, back for check-in or onward in the afternoon.
  ['awara_onsen-tojinbo', 'road', 'tojinbo', 0.2, (h) => gauss(h, 10, 1.4) + 0.4 * gauss(h, 13, 1.2), (h) => gauss(h, 15.5, 1.5)],
  // Kanazawa (Ishikawa) inflow by car: afternoon check-in at Awara, morning return.
  ['kanazawa-awara_onsen', 'road', 'awara_onsen', 0.16, (h) => gauss(h, 14.5, 1.7) + 0.3 * gauss(h, 10.5, 1.3), (h) => gauss(h, 10.5, 1.5) + 0.4 * gauss(h, 17, 1.5)],
  // Hokuriku Shinkansen inflow (rail): Kanazawa → Awara-Onsen, and on to Fukui Station.
  ['rail-kanazawa-awara_onsen', 'rail', 'awara_onsen', 0.42, (h) => gauss(h, 10, 2) + 0.9 * gauss(h, 14.5, 1.6), (h) => gauss(h, 17.5, 1.8) + 0.5 * gauss(h, 10.5, 1.4)],
  ['rail-awara_onsen-fukui_station', 'rail', 'fukui_station', 0.3, (h) => gauss(h, 9.5, 1.8) + 0.4 * gauss(h, 13, 1.5), (h) => gauss(h, 17.5, 1.8)],
]
const flows = {}
for (const [rid, mode, dest, share, fShape, rShape] of FLOWS) {
  const n = NODES[dest]
  const base = n.annual ? n.annual / 365 : n.dailyBase
  const fN = shapeNorm(fShape), rN = shapeNorm(rShape)
  const forward = [], reverse = []
  for (let h = 0; h < H; h++) {
    const d = Math.floor(h / 24), hr = h % 24
    const daily = base * dayFactor(d) * share
    const wxPen = mode === 'road' ? 1 - Math.min(0.35, (WX[dest].precip_mm[h] / 12) * 0.35 * Math.max(0, n.outdoor)) : 1
    forward.push(r0(((daily * fShape(hr)) / fN) * wxPen * noise(0.08)))
    reverse.push(r0(((daily * rShape(hr)) / rN) * wxPen * noise(0.08)))
  }
  flows[rid] = { mode, forward, reverse, unit: 'people_per_hour' }
}

// ---------------- Traffic (road segments) ----------------
// Congestion index 0 (free) to 1 (standstill) per segment per hour = background traffic +
// tourist vehicles (people ÷ 2.4 per car) against a segment capacity. Segment breaks are
// fractions of the route length. Hotspots: the Tojinbo car-park approach and the museum
// approach at Katsuyama on weekend late mornings, Fukui city centre at commuter peaks.
const TRAFFIC = {
  'fukui_station-tojinbo': { segs: [0, 0.18, 0.5, 0.82, 1], cap: [520, 700, 620, 95], city: [1, 0.3, 0.2, 0] },
  'fukui_station-eiheiji': { segs: [0, 0.2, 0.65, 1], cap: [520, 620, 260], city: [1, 0.2, 0] },
  'fukui_station-katsuyama': { segs: [0, 0.2, 0.7, 1], cap: [520, 700, 210], city: [1, 0.25, 0] },
  'fukui_station-rainbow_line': { segs: [0, 0.12, 0.45, 0.8, 1], cap: [520, 900, 800, 190], city: [1, 0.2, 0.3, 0] },
  'fukui_station-awara_onsen': { segs: [0, 0.2, 0.7, 1], cap: [520, 800, 400], city: [1, 0.3, 0.2] },
  'awara_onsen-tojinbo': { segs: [0, 0.5, 1], cap: [400, 120], city: [0.2, 0] },
  'kanazawa-awara_onsen': { segs: [0, 0.15, 0.6, 1], cap: [700, 1100, 900], city: [1, 0.3, 0.2] },
  'fukui_station-tojinbo-alt': { segs: [0, 0.3, 0.7, 1], cap: [600, 900, 400], city: [0.8, 0.3, 0.1] },
}
const commute = (hr, weekend) => (weekend ? 0.25 : 1) * (gauss(hr, 8, 0.9) + gauss(hr, 17.8, 1.1)) + 0.25 * gauss(hr, 13, 4)
const traffic = {}
for (const [rid, t] of Object.entries(TRAFFIC)) {
  const f = flows[rid] ?? flows['fukui_station-tojinbo'] // alternate carries a fraction of the coastal flow
  const altShare = rid.endsWith('-alt') ? 0.35 : 1
  const congestion = t.cap.map(() => [])
  const vph = []
  for (let h = 0; h < H; h++) {
    const d = Math.floor(h / 24), hr = h % 24
    const tourists = ((f.forward[h] + f.reverse[h]) / 2.4) * altShare
    const rain = (WX.fukui_station.precip_mm[h] / 10) * 0.12
    vph.push(r0(tourists + 180 * commute(hr, days[d].weekend)))
    t.cap.forEach((cap, i) => {
      const load = tourists * (i === t.cap.length - 1 ? 1.5 : 1) + 320 * t.city[i] * commute(hr, days[d].weekend)
      // Car-park queue at the destination end on busy days.
      const queue = i === t.cap.length - 1 && dayFactor(d) > 1.2 ? 0.3 * gauss(hr, 13, 2) : 0
      congestion[i].push(r2(Math.min(0.98, Math.max(0.03, load / cap / 1.6 + queue + rain) * noise(0.06))))
    })
  }
  traffic[rid] = { segments: t.segs.slice(0, -1).map((a, i) => [a, t.segs[i + 1]]), congestion, vehicles_per_hour: vph }
}

// Advisories: when the coastal corridor's worst segment is jammed, recommend the inland alternate.
const advisories = []
{
  const c = traffic['fukui_station-tojinbo'].congestion
  let open = null
  for (let h = 0; h <= H; h++) {
    const worst = h < H ? Math.max(...c.map((s) => s[h])) : 0
    if (worst >= 0.7 && open === null) open = h
    if (worst < 0.7 && open !== null) {
      advisories.push({
        id: `reroute-tojinbo-${open}`,
        corridor: 'fukui_station-tojinbo', alternate: 'fukui_station-tojinbo-alt', start: open, end: h - 1,
        reason_en: 'Queue for the Tojinbo car parks backs onto the coastal road. Inland via Maruoka (Route 8) is about 10 minutes longer but moving.',
        reason_ja: '東尋坊駐車場の渋滞が沿岸道路まで延びています。丸岡経由（国道8号）は約10分長いものの流れています。',
      })
      open = null
    }
  }
}

// ---------------- JMA-style weather alerts ----------------
const alert = (id, type, level, nodes, start, end, en, ja, den, dja) => ({ id, type, level, nodes, start, end, title_en: en, title_ja: ja, detail_en: den, detail_ja: dja })
const D3 = 3 * 24
const weather_alerts = [
  alert('rain-d2', 'heavy_rain', 'advisory', ['tojinbo', 'awara_onsen', 'fukui_station', 'eiheiji'], 2 * 24 + 18, D3 + 21,
    'Heavy rain advisory', '大雨注意報', 'Rain band from the west; up to 20 mm/h on the coast Wednesday late morning.', '西から雨雲が接近。水曜昼前に沿岸部で最大20mm/h。'),
  alert('wind-d3', 'wind', 'advisory', ['tojinbo', 'rainbow_line'], D3 + 6, D3 + 20,
    'Strong wind advisory', '強風注意報', 'Gusts over 15 m/s on the coast. Cliff-edge paths at Tojinbo may close.', '沿岸部で最大瞬間風速15m/s超。東尋坊の遊歩道が閉鎖される可能性。'),
  alert('thunder-d3', 'thunder', 'advisory', ['tojinbo', 'fukui_station', 'katsuyama', 'eiheiji', 'awara_onsen'], D3 + 10, D3 + 15,
    'Thunder advisory', '雷注意報', 'Thunderstorms possible around midday.', '昼前後に落雷の可能性。'),
  alert('waves-d3', 'waves', 'advisory', ['tojinbo', 'rainbow_line'], D3 + 3, D3 + 23,
    'High wave advisory', '波浪注意報', 'Waves 3 m along the Echizen coast.', '越前海岸で波の高さ3m。'),
]

const out = {
  demo: true,
  note: 'DEMO DATA. Simulated by scripts/gen_live_demo.mjs for layout and interaction; not observations. Daily scale anchored to 2025 annual visitors (Tojinbo 651k, Katsuyama 1.56M, Rainbow Line 443k, Eiheiji 518k, Awara Onsen 658k); Fukui Station is an assumed ~4,800 tourists/day through the east exit. The real pipeline replaces this file with the same shape and demo: false.',
  generated_at: new Date().toISOString(),
  timezone: 'Asia/Tokyo',
  start: START,
  step_minutes: 60,
  hours: H,
  observed_until: NOW,
  days,
  nodes: people,
  flows,
  traffic,
  advisories,
  weather_alerts,
}
writeFileSync('public/data/live_demo.json', JSON.stringify(out) + '\n')
const daily = (id, d) => people[id].arrivals.predicted.slice(d * 24, d * 24 + 24).reduce((a, b) => a + b, 0)
for (const id of IDS) console.log(id.padEnd(14), days.map((_, d) => daily(id, d)).join(' '), 'peak on-site', Math.max(...people[id].on_site.predicted.slice(0, 24)))
console.log('advisories', advisories.map((a) => `${a.start}-${a.end}`).join(', '))
