// One-off: fetch real road geometry between the priority node pairs from the
// public OSRM demo server and write public/data/routes.json. The app only
// reads that file; it never calls OSRM at runtime. Run with:
//   node scripts/fetch_routes.mjs
// Keep it polite: 8 requests, one at a time, with a pause between them.
import { readFileSync, writeFileSync } from 'node:fs'

const nodes = JSON.parse(readFileSync('public/data/nodes.json', 'utf8')).nodes
const P = Object.fromEntries(nodes.map((n) => [n.id, [n.lat, n.lon]]))
P.tsuruga = [35.6451, 136.0754] // Tsuruga Station (waypoint for the Rainbow Line run)

// [id, from, to, via[], label, label_ja, kind]
const PAIRS = [
  ['fukui_station-tojinbo', 'fukui_station', 'tojinbo', [], 'Fukui Station ↔ Tojinbo', '福井駅↔東尋坊', 'corridor'],
  ['fukui_station-eiheiji', 'fukui_station', 'eiheiji', [], 'Fukui Station ↔ Eiheiji', '福井駅↔永平寺', 'corridor'],
  ['fukui_station-awara_onsen', 'fukui_station', 'awara_onsen', [], 'Fukui Station ↔ Awara Onsen', '福井駅↔あわら温泉', 'corridor'],
  ['fukui_station-katsuyama', 'fukui_station', 'katsuyama', [], 'Fukui Station ↔ Katsuyama', '福井駅↔勝山', 'corridor'],
  ['fukui_station-rainbow_line', 'fukui_station', 'rainbow_line', ['tsuruga'], 'Fukui Station ↔ Rainbow Line (via Tsuruga)', '福井駅↔レインボーライン（敦賀経由）', 'corridor'],
  ['awara_onsen-tojinbo', 'awara_onsen', 'tojinbo', [], 'Awara Onsen ↔ Tojinbo', 'あわら温泉↔東尋坊', 'corridor'],
  ['kanazawa-awara_onsen', 'kanazawa', 'awara_onsen', [], 'Kanazawa → Awara Onsen', '金沢→あわら温泉', 'inflow'],
  // Recommended alternate to the coastal Fukui Station ↔ Tojinbo corridor: inland via Maruoka / Route 8.
  ['fukui_station-tojinbo-alt', 'fukui_station', 'tojinbo', ['maruoka'], 'Alternate: Fukui Station → Tojinbo via Maruoka (Route 8)', '迂回路：福井駅→東尋坊（丸岡経由・国道8号）', 'alternate'],
]

function perpDist(p, a, b) {
  const [x, y] = p, [x1, y1] = a, [x2, y2] = b
  const dx = x2 - x1, dy = y2 - y1
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(x - x1, y - y1)
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l2))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}
function simplify(pts, eps) {
  if (pts.length < 3) return pts
  let idx = 0, max = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1])
    if (d > max) { max = d; idx = i }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]]
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)]
}

// Hokuriku Shinkansen (Kanazawa → Awara-Onsen → Fukui, opened March 2024). Rail is not
// routable on OSRM, so these two lines are hand-digitised from station positions and
// are APPROXIMATE (they follow the corridor, not the exact track).
const RAIL = [
  {
    id: 'rail-kanazawa-awara_onsen', from: 'kanazawa', to: 'awara_onsen', via: [], kind: 'rail',
    label: 'Hokuriku Shinkansen: Kanazawa → Awara-Onsen (approx.)', label_ja: '北陸新幹線：金沢→芦原温泉（概略）',
    approximate: true, distance_km: 58, duration_min: 25,
    path: [[36.578, 136.648], [36.548, 136.618], [36.497, 136.562], [36.445, 136.503], [36.402, 136.453], [36.356, 136.389], [36.303, 136.315], [36.262, 136.268], [36.2185, 136.2305], [36.2215, 136.2115], [36.2256, 136.1942]],
  },
  {
    id: 'rail-awara_onsen-fukui_station', from: 'awara_onsen', to: 'fukui_station', via: [], kind: 'rail',
    label: 'Hokuriku Shinkansen: Awara-Onsen → Fukui (approx.)', label_ja: '北陸新幹線：芦原温泉→福井（概略）',
    approximate: true, distance_km: 18, duration_min: 9,
    path: [[36.2185, 136.2305], [36.178, 136.239], [36.135, 136.238], [36.098, 136.228], [36.0614, 136.2217]],
  },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const out = []
for (const [id, from, to, via, label, label_ja, kind] of PAIRS) {
  const pts = [P[from], ...via.map((v) => P[v]), P[to]]
  const coords = pts.map(([lat, lon]) => `${lon},${lat}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full`
  const res = await fetch(url, { headers: { 'User-Agent': 'dhde-app route snapshot (one-off, 8 requests; Sakura DHDE project)' } })
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`)
  const j = await res.json()
  if (j.code !== 'Ok') throw new Error(`${id}: ${j.code}`)
  const r = j.routes[0]
  const latlng = r.geometry.coordinates.map(([lon, lat]) => [lat, lon])
  const path = simplify(latlng, 0.00015).map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)])
  out.push({ id, from, to, via, kind, label, label_ja, distance_km: +(r.distance / 1000).toFixed(1), duration_min: Math.round(r.duration / 60), path })
  console.log(id, out.at(-1).distance_km, 'km', out.at(-1).duration_min, 'min', path.length, 'pts')
  await sleep(1500)
}

writeFileSync(
  'public/data/routes.json',
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      source: 'OSRM demo server (router.project-osrm.org), driving profile, road data © OpenStreetMap contributors (ODbL)',
      note: 'Fetched once by scripts/fetch_routes.mjs and committed. The app reads this file and never calls OSRM at runtime. Paths are [lat, lon], simplified (Douglas-Peucker, ~15 m). Rail entries (kind "rail") are hand-digitised and approximate. Rerun the script to refresh.',
      routes: [...out, ...RAIL],
    },
    null,
    0,
  ).replace(/\{"id"/g, '\n{"id"') + '\n',
)
