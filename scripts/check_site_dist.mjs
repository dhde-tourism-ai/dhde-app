import { readFile, readdir } from 'node:fs/promises'
import { sites } from './site-config.mjs'
const site = process.argv[2]
if (!sites[site]) throw new Error('Expected a configured site')
const forbidden = ['tojinbo', 'fukui_station', 'katsuyama', 'rainbow_line', 'awara_onsen', 'eiheiji'].filter((id) => id !== site)
/** Check all JSON strings as well as keys, so nested references cannot escape the boundary. */
for (const name of await readdir(`dist/${site}/data`)) {
  const raw = await readFile(`dist/${site}/data/${name}`, 'utf8')
  JSON.parse(raw)
  for (const id of forbidden) if (raw.includes(id)) throw new Error(`${name} leaks ${id}`)
}
// Distinctive geometry coordinates, independent of minification and module names.
const fingerprints = { tojinbo: ['36.23856', '36.23785'], eiheiji: ['36.05578', '136.35183'], rainbow_line: ['135.89614', '135.87071'] }
for (const name of await readdir(`dist/${site}/assets`)) {
  if (!name.endsWith('.js')) continue
  const raw = await readFile(`dist/${site}/assets/${name}`, 'utf8')
  for (const [id, values] of Object.entries(fingerprints)) if (id !== site && values.every((v) => raw.includes(v))) throw new Error(`${name} contains ${id} geometry`)
}
console.log(`${site}: data and geometry isolation passed`)
