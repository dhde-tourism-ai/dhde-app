// Generates public/data/market_voice_demo.json: DUMMY data for the Map view's
// "Market" and "Voice of visitor" layers (hotels, search intent, survey, social
// media, reviews). Run after gen_live_demo.mjs so days and demand line up:
//
//   node scripts/gen_market_voice_demo.mjs
//
// Every post, review and handle here is FICTIONAL. Thumbnails are described as
// abstract gradient motifs that the app draws itself (no photos of real people).
// The real feeds (FTAS reservations, Rakuten availability, FTAS / federation
// survey, route-search index, social listening, Google reviews) replace this file
// with the same shape and "demo": false.
import { readFileSync, writeFileSync } from 'node:fs'

const live = JSON.parse(readFileSync('public/data/live_demo.json', 'utf8'))
const D = live.days.length

let seed = 4242
const rand = () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const r0 = Math.round
const r1 = (x) => Math.round(x * 10) / 10
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))

const dailyArrivals = (id, d) => live.nodes[id].arrivals.predicted.slice(d * 24, d * 24 + 24).reduce((a, b) => a + b, 0)
const dayRain = (id, d) => Math.max(...live.nodes[id].weather.precip_mm.slice(d * 24, d * 24 + 24))

// ---------------- Hotels ----------------
// Four FTAS reservation feeds, each with the Rakuten availability check (share of
// hotels within 3 km with rooms left 1 / 7 / 30 days out).
const HOTEL_AREAS = [
  { id: 'fukui_station', name: 'Fukui Station hotels', name_ja: '福井駅周辺ホテル', lat: 36.0585, lon: 136.2135, node: 'fukui_station', feed: 'FTAS reservations: Fukui Station', rooms: 2350, base: 0.66, wkd: 0.14, rakuten_hotels: 38 },
  { id: 'awara_onsen', name: 'Awara Onsen ryokan', name_ja: 'あわら温泉旅館', lat: 36.2215, lon: 136.2045, node: 'awara_onsen', feed: 'FTAS reservations: Awara', rooms: 1180, base: 0.6, wkd: 0.27, rakuten_hotels: 21 },
  { id: 'echizen_coast', name: 'Echizen coast inns', name_ja: '越前海岸の宿', lat: 35.99, lon: 135.975, node: 'tojinbo', feed: 'FTAS reservations: Echizen coast (regional)', rooms: 640, base: 0.38, wkd: 0.2, rakuten_hotels: 17 },
  { id: 'mikata_five_lakes', name: 'Mikata Five Lakes lodgings', name_ja: '三方五湖周辺の宿', lat: 35.565, lon: 135.905, node: 'rainbow_line', feed: 'FTAS reservations: Mikata Five Lakes', rooms: 520, base: 0.44, wkd: 0.22, rakuten_hotels: 14 },
]

const hotels = HOTEL_AREAS.map((a) => {
  const occ = []
  const left = []
  for (let d = 0; d < D; d++) {
    const day = live.days[d]
    // Saturday nights fill first; Sunday nights are the quietest.
    const wk = day.dow === 'Sat' ? a.wkd + 0.06 : day.dow === 'Fri' ? a.wkd * 0.55 : day.dow === 'Sun' ? -0.12 : 0
    const rain = dayRain(a.node, d) > 8 ? -0.05 : 0
    const o = clamp(a.base + wk + rain + (rand() - 0.5) * 0.06, 0.12, 0.97)
    occ.push(r0(o * 100))
    left.push(r0(a.rooms * (1 - o)))
  }
  // Booking curve for the busiest upcoming night: share booked when that night was 30 / 14 / 7 / 1 days away.
  const target = occ.indexOf(Math.max(...occ))
  const final = occ[target]
  const curve = [30, 14, 7, 1].map((days) => ({ days_ahead: days, booked_pct: r0(final * (days === 30 ? 0.52 : days === 14 ? 0.7 : days === 7 ? 0.84 : 0.97)), last_year_pct: r0(final * (days === 30 ? 0.47 : days === 14 ? 0.66 : days === 7 ? 0.8 : 0.93) * 0.95) }))
  const share = (days) => r1(clamp(1 - (occ[Math.min(D - 1, days)] ?? a.base * 100) / 100 + 0.12 + (days / 30) * 0.3, 0.05, 0.98) * 100)
  return {
    id: a.id,
    name: a.name,
    name_ja: a.name_ja,
    lat: a.lat,
    lon: a.lon,
    node: a.node,
    feed: a.feed,
    rooms_total: a.rooms,
    occupancy_pct: occ,
    rooms_left: left,
    booking_curve: { target_day: target, points: curve },
    rakuten: { radius_km: 3, hotels_checked: a.rakuten_hotels, share_with_rooms_pct: { d1: share(1), d7: share(7), d30: Math.min(98, share(7) + 22) } },
  }
})

// ---------------- Search intent (RSI) per municipality ----------------
const MUNIS = [
  { id: 'fukui', name: 'Fukui City', name_ja: '福井市', lat: 35.995, lon: 136.265, base: 64, trend: 0.8 },
  { id: 'sakai', name: 'Sakai City', name_ja: '坂井市', lat: 36.16, lon: 136.25, base: 71, trend: 1.6 },
  { id: 'awara', name: 'Awara City', name_ja: 'あわら市', lat: 36.245, lon: 136.265, base: 48, trend: 0.4 },
  { id: 'katsuyama', name: 'Katsuyama City', name_ja: '勝山市', lat: 36.03, lon: 136.585, base: 82, trend: 2.1 },
  { id: 'eiheiji', name: 'Eiheiji Town', name_ja: '永平寺町', lat: 36.1, lon: 136.33, base: 39, trend: -0.3 },
  { id: 'ono', name: 'Ono City', name_ja: '大野市', lat: 35.93, lon: 136.56, base: 33, trend: 0.9 },
  { id: 'mihama_wakasa', name: 'Mihama & Wakasa', name_ja: '美浜町・若狭町', lat: 35.55, lon: 135.93, base: 44, trend: -0.8 },
  { id: 'tsuruga', name: 'Tsuruga City', name_ja: '敦賀市', lat: 35.66, lon: 136.1, base: 36, trend: 0.2 },
]
const rsi = MUNIS.map((m) => {
  const history = []
  for (let k = 13; k >= 0; k--) {
    // Weekends lift route searches the Thursday-Friday before.
    const dow = (7 + (0 - k)) % 7 // day 0 = Sunday
    const wk = dow === 4 || dow === 5 ? 9 : dow === 6 ? 5 : 0
    history.push(r0(clamp(m.base - m.trend * k + wk + (rand() - 0.5) * 6, 5, 100)))
  }
  const last7 = history.slice(-7).reduce((a, b) => a + b, 0) / 7
  const prev7 = history.slice(0, 7).reduce((a, b) => a + b, 0) / 7
  return { id: m.id, name: m.name, name_ja: m.name_ja, lat: m.lat, lon: m.lon, index: history[13], history, change_7d_pct: r1((last7 / prev7 - 1) * 100) }
})

// ---------------- Survey (per node) ----------------
const REASONS = {
  tojinbo: [['Scenery', '景観'], ['Seafood', '海鮮'], ['Sunset', '夕日'], ['Photos', '写真']],
  fukui_station: [['Transfer', '乗り換え'], ['Dinosaur statues', '恐竜モニュメント'], ['Local food', 'ご当地グルメ'], ['Shopping', '買い物']],
  katsuyama: [['Dinosaur museum', '恐竜博物館'], ['Family trip', '家族旅行'], ['Education', '学び'], ['Nature', '自然']],
  rainbow_line: [['Scenic drive', 'ドライブ'], ['Five Lakes view', '五湖の眺め'], ['Foot bath', '足湯'], ['Photos', '写真']],
  awara_onsen: [['Hot springs', '温泉'], ['Kaiseki food', '会席料理'], ['Relaxation', '休養'], ['Shinkansen access', '新幹線の便']],
  eiheiji: [['Zen temple', '禅寺'], ['Architecture', '建築'], ['Zazen', '座禅'], ['Quiet', '静けさ']],
}
const ORIGINS = [['Fukui', '福井県内'], ['Hokuriku', '北陸'], ['Kansai', '関西'], ['Chubu', '中部'], ['Kanto', '関東'], ['Overseas', '海外']]
const survey = {}
for (const id of Object.keys(live.nodes)) {
  const rs = REASONS[id]
  let rem = 100
  const reasons = rs.map(([en, ja], i) => {
    const s = i === rs.length - 1 ? rem : r0(rem * (0.42 + rand() * 0.12))
    rem -= s
    return { en, ja, share: s }
  })
  const w = id === 'fukui_station' ? [22, 14, 26, 14, 16, 8] : id === 'awara_onsen' ? [8, 12, 30, 16, 26, 8] : id === 'katsuyama' ? [16, 18, 28, 20, 13, 5] : [18, 17, 27, 15, 14, 9]
  const sum = w.reduce((a, b) => a + b, 0)
  survey[id] = {
    responses_30d: r0(40 + rand() * 260),
    satisfaction: r1(3.7 + rand() * 0.9),
    nps: r0(-5 + rand() * 50),
    top_reasons: reasons,
    origin_share: ORIGINS.map(([en, ja], i) => ({ en, ja, share: r0((w[i] / sum) * 100) })),
    source: 'FTAS / Fukui Prefecture Tourism Federation visitor survey',
  }
}

// ---------------- Social media (fictional) ----------------
const MOTIF = { tojinbo: 'cliff', fukui_station: 'train', katsuyama: 'dino', rainbow_line: 'lake', awara_onsen: 'onsen', eiheiji: 'temple' }
const POSTS = {
  tojinbo: [
    [0.8, 'Those basalt cliffs at golden hour. Worth the drive.', '夕暮れの柱状節理、来てよかった。'],
    [-0.4, 'Parking queue was 40 minutes on the coast road.', '沿岸道路で駐車待ち40分。'],
    [0.6, 'Grilled squid on a stick by the sea. Perfect.', '海辺でいか焼き。最高。'],
  ],
  fukui_station: [
    [0.5, 'The dinosaur outside the station moved and roared!', '駅前の恐竜が動いて吠えた！'],
    [0.3, 'Easy shinkansen transfer, lockers everywhere.', '新幹線の乗り換えが楽、ロッカーも多い。'],
    [-0.3, 'Bus to Tojinbo leaves every hour, missed it by a minute.', '東尋坊行きバスは1時間に1本、1分差で逃した。'],
  ],
  katsuyama: [
    [0.9, 'Kids did not want to leave the museum. Neither did I.', '子供が帰りたがらない。私も。'],
    [-0.5, 'Queue to get in wrapped round the building by 11.', '11時には入場待ちが建物を一周。'],
    [0.7, 'The skeleton hall is enormous. Book a timed ticket.', '骨格の展示室は圧巻。時間指定券がおすすめ。'],
  ],
  rainbow_line: [
    [0.8, 'All five lakes from the summit terrace. Clear skies.', '山頂テラスから五湖すべて。快晴。'],
    [0.4, 'Foot bath with a view of the sea. Cold wind though.', '海を見ながら足湯。風は冷たい。'],
    [-0.2, 'Fog rolled in, could not see a thing at the top.', '霧で山頂から何も見えず。'],
  ],
  awara_onsen: [
    [0.7, 'Open-air bath under the stars after the shinkansen.', '新幹線を降りて星空の露天風呂。'],
    [0.6, 'Kaiseki dinner with Echizen crab season coming soon.', '越前がにの季節ももうすぐ、会席料理。'],
    [0.2, 'Quiet town, the foot bath plaza is lovely at night.', '静かな町。夜の足湯広場が素敵。'],
  ],
  eiheiji: [
    [0.8, 'Morning service in the cedar mist. Unforgettable.', '杉の霧の中の朝のお勤め。忘れられない。'],
    [0.5, 'Sesame tofu at the gate shop. Simple and good.', '門前のごま豆腐。素朴でおいしい。'],
    [-0.1, 'Lots of stairs, bring good shoes.', '階段が多い、歩きやすい靴で。'],
  ],
}
const KIND = ['photo', 'photo', 'short', 'comment']
const social = {}
for (const id of Object.keys(live.nodes)) {
  const base = dailyArrivals(id, 0)
  const posts = POSTS[id].map(([s, en, ja], i) => ({
    id: `${id}-p${i}`,
    kind: KIND[i % KIND.length],
    handle: `visitor_${String(1000 + r0(rand() * 8999))}`,
    hours_ago: r0(1 + rand() * 20),
    sentiment: s,
    en,
    ja,
    likes: r0(5 + rand() * 180),
    comments: r0(rand() * 24),
    thumb: { motif: MOTIF[id], hue: r0(rand() * 360) },
  }))
  social[id] = {
    posts_24h: r0(base * 0.03 * (0.8 + rand() * 0.4)),
    images_24h: r0(base * 0.018 * (0.8 + rand() * 0.4)),
    comments_24h: r0(base * 0.05 * (0.8 + rand() * 0.4)),
    avg_sentiment: live.nodes[id].sentiment.score[0],
    feed: posts,
  }
}

// ---------------- Reviews (fictional sample, Google-reviews shape) ----------------
const REVIEWS = {
  tojinbo: [[5, 'Dramatic coastline, go at sunset.', '夕日の時間に行くべき絶景の海岸。'], [3, 'Crowded shops at the entrance, cliffs are great.', '入口の店は混雑、崖は素晴らしい。']],
  fukui_station: [[4, 'Clean, compact, fun dinosaur theme.', 'きれいでコンパクト、恐竜テーマが楽しい。'], [3, 'Not many signs in English for buses.', 'バスの英語案内が少ない。']],
  katsuyama: [[5, 'One of the best dinosaur museums anywhere.', '世界屈指の恐竜博物館。'], [4, 'Great but book ahead on weekends.', '素晴らしいが週末は予約を。']],
  rainbow_line: [[5, 'Stunning lake views from the top.', '山頂からの湖の眺めが見事。'], [4, 'Toll is worth it on a clear day.', '晴れた日なら通行料の価値あり。']],
  awara_onsen: [[5, 'Relaxing ryokan stay, great food.', 'くつろげる旅館、料理が絶品。'], [4, 'Quiet town, easy from the station.', '静かな町、駅から近い。']],
  eiheiji: [[5, 'Peaceful and profound. Allow two hours.', '静かで深い。2時間は見ておきたい。'], [4, 'Beautiful halls, many stairs.', '美しい伽藍、階段が多い。']],
}
const reviews = {}
for (const id of Object.keys(live.nodes)) {
  const rating = r1(4.0 + rand() * 0.6)
  const count = r0(1500 + rand() * 9000)
  const dist = [0.62, 0.24, 0.09, 0.03, 0.02].map((x) => r0(x * 100 * (0.9 + rand() * 0.2)))
  reviews[id] = {
    rating,
    count,
    rating_30d_ago: r1(rating - 0.2 + rand() * 0.3),
    new_30d: r0(count * (0.015 + rand() * 0.02)),
    distribution_pct: dist,
    snippets: REVIEWS[id].map(([stars, en, ja], i) => ({ stars, en, ja, days_ago: 2 + i * 5 + r0(rand() * 4) })),
    source: 'Google reviews shape (fictional sample)',
  }
}

const out = {
  demo: true,
  note: 'DEMO DATA. Simulated by scripts/gen_market_voice_demo.mjs. All posts, handles and reviews are fictional; thumbnails are abstract motifs drawn by the app. Replace with the real feeds in the same shape and demo: false.',
  generated_at: new Date().toISOString(),
  start: live.start,
  days: D,
  hotels,
  rsi,
  survey,
  social,
  reviews,
}
writeFileSync('public/data/market_voice_demo.json', JSON.stringify(out, null, 1) + '\n')
for (const h of hotels) console.log(h.id.padEnd(18), h.occupancy_pct.join(' '))
