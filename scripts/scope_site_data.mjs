import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { sites } from './site-config.mjs'
const read = async (name) => JSON.parse(await readFile(`public/data/${name}.json`, 'utf8'))

/** Write an allowlisted snapshot. New source files require an explicit rule here. */
export async function scopeSite(site) {
  const config = sites[site]
  if (!config) throw new Error(`Unknown VITE_SITE: ${site}`)
  const root = `build/site-public/${site}`
  await rm(root, { recursive: true, force: true })
  await mkdir(`${root}/data`, { recursive: true })
  const save = (name, data) => {
    // Timetable dates are keyed by operator, including operators outside this site.
    if (data.timetable_dates) for (const day of Object.keys(data.timetable_dates)) {
      const dates = data.timetable_dates[day]
      for (const id of Object.keys(dates)) if (['katsuyama_city_bus', 'eiheiji_town_bus'].includes(id) && !JSON.stringify(data.nodes ?? {}).includes(id)) delete dates[id]
    }
    return writeFile(`${root}/data/${name}.json`, JSON.stringify(data))
  }
  const registry = await read('nodes')
  const node = registry.nodes.find((n) => n.id === site)
  const inside = ([lat, lon]) => Math.abs(lat - node.lat) <= config.radiusKm / 111 && Math.abs(lon - node.lon) <= config.radiusKm / (111 * Math.cos(node.lat * Math.PI / 180))
  const only = (nodes) => Object.fromEntries(Object.entries(nodes).filter(([id]) => id === site))
  await save('nodes', { generated_at: registry.generated_at, prefectures: registry.prefectures, nodes: [node] })
  const real = await read('real_data')
  real.nodes = only(real.nodes)
  real.shared_date = real.nodes[site].as_of.visitors
  real.notes = []
  await save('real_data', real)
  const live = await read('live_demo')
  live.nodes = only(live.nodes)
  live.flows = {}; live.traffic = {}; live.advisories = []; live.weather_alerts = []
  live.note = 'Site snapshot. Daily counts and forecasts replace the neutral timeline template.'
  // Neutral templates supply required array shapes, never fictional intraday variation.
  const n = live.nodes[site]
  for (const k of ['on_site', 'arrivals']) n[k] = { actual: Array(live.hours).fill(null), predicted: Array(live.hours).fill(1) }
  n.sentiment = { score: Array(live.days.length).fill(0), posts: Array(live.days.length).fill(0), keywords: Array.from({ length: live.days.length }, () => []) }
  for (const [key, value] of Object.entries(n.weather)) if (Array.isArray(value)) n.weather[key] = value.map(() => key === 'condition' ? 'clear' : 0)
  await save('live_demo', live)
  const market = await read('market_voice_demo')
  market.note = 'Neutral templates; only fields replaced by real sources may be displayed.'
  market.hotels = market.hotels.filter((h) => h.id === config.hotel).map((h) => ({ ...h, node: site, serves: [site], booking_curve: { target_day: 0, points: [] }, rakuten: { ...h.rakuten, share_with_rooms_pct: { d1: 0, d7: 0, d30: 0 } }, rooms_total: 0, hotels_in_feed: 0, occupancy_pct: Array(market.days).fill(0), rooms_left: Array(market.days).fill(0) }))
  market.rsi = market.rsi.filter((r) => r.id === config.town).map((r) => ({ ...r, index: 0, history: [], change_7d_pct: 0 }))
  market.survey = { [site]: { responses_30d: 0, satisfaction: 0, nps: null, top_reasons: [], origin_share: [], source: '' } }
  market.social = { [site]: { posts_24h: 0, images_24h: 0, comments_24h: 0, avg_sentiment: 0, feed: [] } }
  market.reviews = { [site]: { rating: 0, count: 0, rating_30d_ago: 0, new_30d: 0, distribution_pct: [], snippets: [], source: '' } }
  await save('market_voice_demo', market)
  // Dashboard values are a legacy snapshot. The map takes its site data from real_data.
  const dashboard = await read('dashboard_data')
  await save('dashboard_data', { generated_at: dashboard.generated_at, nodes: {}, aggregate: {} })
  await save('routes', { routes: [] })
  const transport = await read('transport')
  transport.nodes = only(transport.nodes)
  const feeds = new Set(Object.values(transport.nodes[site].days).flatMap((d) => d.routes.map((r) => r.feed)))
  transport.sources = transport.sources.filter((s) => feeds.has(s.id))
  delete transport.hub
  await save('transport', transport)
  const map = await read('transport_map')
  delete map.hub
  const routeIds = new Set(Object.values(transport.nodes[site].days).flatMap((d) => d.routes.map((r) => r.id)))
  map.lines = map.lines.filter((l) => routeIds.has(l.id)).map((l) => ({ ...l, path: l.path.filter(inside) })).filter((l) => l.path.length > 1)
  map.stops = map.stops.filter((s) => inside([s.lat, s.lon])).map((s) => ({ ...s, nodes: s.nodes.filter((id) => id === site) }))
  map.walk_areas.nodes = only(map.walk_areas.nodes)
  map.rail.lines = map.rail.lines.map((l) => ({ ...l, paths: l.paths.map((p) => p.filter(inside)).filter((p) => p.length > 1) })).filter((l) => l.paths.length)
  map.rail.stations = map.rail.stations.filter((s) => inside([s.lat, s.lon]))
  await save('transport_map', map)
  const trips = await read('transport_trips')
  delete trips.hub
  const stopMap = new Map(); const routeMap = new Map()
  const stopIndices = trips.stops.map((p, i) => inside(p) ? i : -1).filter((i) => i >= 0)
  stopIndices.forEach((i, j) => stopMap.set(i, j))
  const routeIndices = trips.routes.map((r, i) => routeIds.has(r.id) ? i : -1).filter((i) => i >= 0)
  routeIndices.forEach((i, j) => routeMap.set(i, j))
  for (const key of ['stops', 'stop_ids', 'stop_names']) trips[key] = stopIndices.map((i) => trips[key][i])
  trips.routes = routeIndices.map((i) => trips.routes[i])
  for (const [day, rows] of Object.entries(trips.trips)) trips.trips[day] = rows.filter((r) => routeMap.has(r[0])).map(([r, stops, times]) => {
    const indices = stops.map((s, i) => stopMap.has(s) ? i : -1).filter((i) => i >= 0)
    return [routeMap.get(r), indices.map((i) => stopMap.get(stops[i])), indices.map((i) => times[i])]
  }).filter((r) => r[1].length > 1)
  await save('transport_trips', trips)
  const economics = await read('regional_economics')
  economics.nodes = economics.nodes.filter((n) => n.id === site)
  economics.regions = economics.regions.filter((r) => r.id === node.municipality).map((r) => ({ ...r, nodes: [site] }))
  economics.prefecture = {}; economics.assumptions = {}; economics.flows = []; economics.comparison_regions = []; economics.external_points = {}
  economics.notes = ['Modelled town economics. Municipal totals cover the whole town, not just this site.']
  await save('regional_economics', economics)
  await cp('public/favicon.svg', `${root}/favicon.svg`)
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await scopeSite(process.argv[2] ?? process.env.VITE_SITE)
