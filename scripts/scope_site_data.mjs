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
  const save = (name, data) => writeFile(`${root}/data/${name}.json`, JSON.stringify(data))
  const registry = await read('nodes')
  const node = registry.nodes.find((n) => n.id === site)
  const only = (nodes) => Object.fromEntries(Object.entries(nodes).filter(([id]) => id === site))
  await save('nodes', { ...registry, nodes: [node] })
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
  await save('transport', transport)
  const map = await read('transport_map')
  map.walk_areas.nodes = only(map.walk_areas.nodes)
  await save('transport_map', map)
  await cp('public/data/transport_trips.json', `${root}/data/transport_trips.json`)
  await cp('public/favicon.svg', `${root}/favicon.svg`)
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await scopeSite(process.argv[2] ?? process.env.VITE_SITE)
