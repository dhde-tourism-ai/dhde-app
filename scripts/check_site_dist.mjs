import { readFile, readdir } from 'node:fs/promises'
import ts from 'typescript'
import { sites } from './site-config.mjs'
const site = process.argv[2]
if (!sites[site]) throw new Error('Expected a configured site')
const read = async (name) => JSON.parse(await readFile(`public/data/${name}.json`, 'utf8'))
const [registry, economics, market, real] = await Promise.all(['nodes', 'regional_economics', 'market_voice_demo', 'real_data'].map(read))
const own = registry.nodes.find((n) => n.id === site)
const ownEconomics = economics.nodes.find((n) => n.id === sites[site].economicsNode)
const allowed = new Set([site, ...(own.aliases ?? []), own.municipality, sites[site].town, sites[site].hotel, ownEconomics?.id, ...(ownEconomics?.aliases ?? [])])
const forbidden = new Set()
const add = (...ids) => ids.flat().filter(Boolean).forEach((id) => { if (!allowed.has(id)) forbidden.add(id) })
for (const n of registry.nodes) if (n.id !== site) add(n.id, n.aliases ?? [], n.municipality)
for (const n of economics.nodes) if (n.id !== ownEconomics?.id) add(n.id, n.aliases ?? [], n.region)
for (const r of economics.regions) add(r.id)
for (const h of market.hotels) add(h.id)
for (const r of market.rsi) add(r.id)

function checkString(value, name, path = '') {
  for (const id of forbidden) if (value.split('-').includes(id)) {
    // Shared prefecture metadata and the weather station field are schema, not partner identifiers.
    if (id === 'fukui' && (path.endsWith('.prefecture') || path.startsWith('prefectures.') || path.endsWith('.origin_pct.fukui'))) continue
    if (id === 'kanazawa' && path.endsWith('.from_far.kanazawa')) continue
    if (id === 'station' && path.endsWith('.weather.station')) continue
    throw new Error(`${name} leaks ${id} at ${path}`)
  }
}
const numbers = []
function check(value, name, path = '') {
  if (typeof value === 'string') checkString(value, name, path)
  else if (typeof value === 'number') numbers.push(value)
  else if (Array.isArray(value)) value.forEach((v, i) => check(v, name, `${path ? path + '.' : ''}${i}`))
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
    const next = path ? `${path}.${key}` : key
    checkString(key, name, next)
    check(item, name, next)
  }
}
// Numeric fingerprints do not include the legitimately shared hotel feed.
const fingerprints = registry.nodes.filter((n) => n.priority && n.id !== site).flatMap((n) => {
  const data = real.nodes[n.id]
  if (!data) return []
  const calibration = ['factor', 'official_annual_2025'].flatMap((key) => data.calibration[key] == null ? [] : [{ id: n.id, label: key, values: [data.calibration[key]] }])
  let run = []
  for (const d of data.daily) {
    run = d.visitors_est == null ? [] : [...run, d.visitors_est]
    if (run.length === 5 && new Set(run).size > 2) break
  }
  return [...calibration, ...(run.length >= 5 ? [{ id: n.id, label: 'daily visitors', values: run }] : [])]
})
function checkNumbers(values, name) {
  for (const f of fingerprints) {
    // Daily visitor fields are separated by other metrics in serialized objects.
    let index = 0
    for (const value of values) if (value === f.values[index]) {
      if (++index === f.values.length) throw new Error(`${name} contains ${f.id} ${f.label} fingerprint`)
    }
  }
}
for (const name of await readdir(`dist/${site}/data`)) {
  if (!name.endsWith('.json')) continue
  numbers.length = 0
  check(JSON.parse(await readFile(`dist/${site}/data/${name}`, 'utf8')), name)
  checkNumbers(numbers, name)
}

for (const name of await readdir(`dist/${site}/assets`)) {
  if (!name.endsWith('.js')) continue
  const raw = await readFile(`dist/${site}/assets/${name}`, 'utf8')
  const ast = ts.createSourceFile(name, raw, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  numbers.length = 0
  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // A JSON.parse payload can contain an entire inlined source file.
      try { const parsed = JSON.parse(node.text); check(parsed, name); } catch (e) { if (!(e instanceof SyntaxError)) throw e }
      // Executable code keeps shared lookup IDs. Only embedded JSON is token-scanned;
      // numeric source fingerprints below also catch compiled object imports.
    }
    if (ts.isNumericLiteral(node)) numbers.push(Number(node.text))
    ts.forEachChild(node, visit)
  }
  visit(ast)
  checkNumbers(numbers, name)
  for (const [id, values] of Object.entries(sites)) if (id !== site && values.geometryFingerprint.every((v) => raw.includes(v))) throw new Error(`${name} contains ${id} geometry`)
}
console.log(`${site}: data, aliases, numeric fingerprints and geometry isolation passed`)
