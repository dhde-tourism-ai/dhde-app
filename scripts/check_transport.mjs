#!/usr/bin/env node
// Validate public/data/transport.json, transport_map.json, transport_trips.json and transport_trends.json
// (dhde-preprocessing-model scripts/build_transport.py, run daily). Each file is optional:
// a missing file is OK (the app hides the card or layer), a malformed one exits 1
// so the deploy stops and the previous site stays up.
import { existsSync, readFileSync } from 'node:fs'

const dir = process.argv[2] ?? 'public/data'
const errors = []
const fail = (msg) => errors.push(msg)
const TIME = /^\d{2}:\d{2}$/
const mins = (hm) => Number(hm.slice(0, -3)) * 60 + Number(hm.slice(-2))
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isLatLon = (p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180

function load(name) {
  const path = `${dir}/${name}`
  if (!existsSync(path)) {
    console.log(`OK: ${path} absent`)
    return null
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    fail(`${path}: invalid JSON (${e.message})`)
    return null
  }
}

const tr = load('transport.json')
if (tr) {
  if (typeof tr.hub !== 'string') fail('transport.json: hub missing')
  if (!Array.isArray(tr.sources) || tr.sources.length === 0) fail('transport.json: sources missing')
  for (const s of tr.sources ?? []) {
    if (!['ok', 'check', 'research_only'].includes(s.publish_status)) fail(`transport.json: source ${s.id} publish_status ${s.publish_status}`)
    if (!s.licence) fail(`transport.json: source ${s.id} has no licence`)
  }
  if (typeof tr.nodes !== 'object' || !tr.nodes) fail('transport.json: nodes missing')
  for (const [id, n] of Object.entries(tr.nodes ?? {})) {
    if (!isNum(n.anchor?.lat) || !isNum(n.anchor?.lon)) fail(`transport.json: ${id} anchor`)
    for (const [day, d] of Object.entries(n.days ?? {})) {
      const where = `transport.json: ${id}.${day}`
      if (!Number.isInteger(d.departures) || d.departures < 0) fail(`${where} departures`)
      for (const k of ['first_departure', 'last_departure', 'first_arrival', 'last_arrival']) {
        if (d[k] != null && !TIME.test(d[k])) fail(`${where}.${k} = ${d[k]}`)
      }
      if (d.to_hub && !TIME.test(d.to_hub.leave)) fail(`${where}.to_hub.leave`)
      if (d.from_hub && !isNum(d.from_hub.fastest_min)) fail(`${where}.from_hub.fastest_min`)
      // every trip's minutes must equal its displayed arrive - depart
      const trips = [
        d.from_hub?.fastest,
        d.from_hub?.after_0900,
        d.to_hub && { depart: d.to_hub.leave, arrive: d.to_hub.arrive_hub, minutes: d.to_hub.minutes },
      ]
      for (const j of trips.filter(Boolean)) {
        if (mins(j.arrive) - mins(j.depart) !== j.minutes) fail(`${where}: ${j.depart} -> ${j.arrive} is not ${j.minutes} min`)
      }
      if (d.from_hub && d.from_hub.fastest_min !== d.from_hub.fastest?.minutes) fail(`${where}: fastest_min differs from the fastest trip`)
      for (const [city, f] of Object.entries(d.from_far ?? {})) if (f.minutes != null && !isNum(f.minutes)) fail(`${where}.from_far.${city}`)
    }
    for (const s of n.stops ?? []) if (!isLatLon([s.lat, s.lon])) fail(`transport.json: ${id} stop ${s.id}`)
  }
}

const map = load('transport_map.json')
if (map) {
  for (const l of map.lines ?? []) {
    if (!Array.isArray(l.path) || l.path.length < 2 || !l.path.every(isLatLon)) fail(`transport_map.json: line ${l.id} path`)
  }
  for (const s of map.stops ?? []) if (!isLatLon([s.lat, s.lon])) fail(`transport_map.json: stop ${s.id}`)
  for (const [id, rings] of Object.entries(map.walk_areas?.nodes ?? {})) {
    for (const [m, ring] of Object.entries(rings)) {
      if (!Array.isArray(ring) || ring.length < 3 || !ring.every(isLatLon)) fail(`transport_map.json: walk area ${id} ${m} min`)
    }
  }
}

const trends = load('transport_trends.json')
if (trends) {
  const n = trends.weeks?.length ?? 0
  if (!n) fail('transport_trends.json: weeks missing')
  for (const t of trends.terms ?? []) {
    if (!Array.isArray(t.values) || t.values.length !== n || !t.values.every((v) => isNum(v) && v >= 0 && v <= 100)) {
      fail(`transport_trends.json: ${t.term} values`)
    }
  }
}

// Moving buses: every trip needs valid stops and departure minutes that never go backwards.
const trips = load('transport_trips.json')
if (trips) {
  const ns = trips.stops?.length ?? 0
  const nr = trips.routes?.length ?? 0
  if (!ns || !trips.stops.every(isLatLon)) fail('transport_trips.json: stops')
  for (const day of ['weekday', 'saturday', 'sunday']) {
    const list = trips.trips?.[day]
    if (!Array.isArray(list)) {
      fail(`transport_trips.json: ${day} missing`)
      continue
    }
    list.forEach(([r, s, m], i) => {
      const ok =
        Number.isInteger(r) &&
        r >= 0 &&
        r < nr &&
        Array.isArray(s) &&
        Array.isArray(m) &&
        s.length >= 2 &&
        s.length === m.length &&
        s.every((x) => Number.isInteger(x) && x >= 0 && x < ns) &&
        m.every((x, j) => isNum(x) && x >= 0 && x < 30 * 60 && (j === 0 || x >= m[j - 1]))
      if (!ok) fail(`transport_trips.json: ${day} trip ${i}`)
    })
  }
}

const modes = load('transport_modes.json')
if (modes) {
  for (const [period, tot] of Object.entries(modes.totals ?? {})) {
    let sum = 0
    for (const [m, v] of Object.entries(tot.by_mode ?? {})) {
      if (!isNum(v.visitors) || v.lo > v.visitors || v.visitors > v.hi) fail(`transport_modes.json: ${period}.${m} range`)
      sum += v.visitors
    }
    // per-mode counts are rounded per site, so allow a little drift from the total
    if (Math.abs(sum - tot.visitors) > 10) fail(`transport_modes.json: ${period} modes add to ${sum}, total ${tot.visitors}`)
  }
  for (const [id, n] of Object.entries(modes.nodes ?? {})) {
    const s = Object.values(n.shares ?? {}).reduce((a, v) => a + v.share, 0)
    if (n.responses > 0 && Math.abs(s - 1) > 0.01) fail(`transport_modes.json: ${id} shares add to ${s}`)
  }
}

const market = load('transport_market.json')
if (market) {
  const STATUS = ['official', 'press', 'not_published']
  for (const r of market.revenue ?? []) {
    if (!STATUS.includes(r.status)) fail(`transport_market.json: revenue ${r.id} status`)
    if (r.yen != null && (!isNum(r.yen) || r.yen <= 0)) fail(`transport_market.json: revenue ${r.id} yen`)
    if (r.yen != null && !r.url) fail(`transport_market.json: revenue ${r.id} has a value but no source`)
  }
  for (const r of market.ridership ?? []) if (!isNum(r.passengers) || !r.url) fail(`transport_market.json: ridership ${r.id}`)
  for (const f of market.fares ?? []) if (!Number.isInteger(f.yen) || !f.url) fail(`transport_market.json: fare ${f.from}->${f.to}`)
}

if (errors.length) {
  for (const e of errors) console.error(`ERROR: ${e}`)
  process.exit(1)
}
console.log('OK: transport files valid')
