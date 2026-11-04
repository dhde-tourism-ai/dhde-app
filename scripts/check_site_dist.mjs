import { readFile, readdir } from 'node:fs/promises'
import { sites } from './site-config.mjs'
const site = process.argv[2]
if (!sites[site]) throw new Error('Expected a configured site')
const others = new Set(Object.keys(sites).filter((id) => id !== site))
function check(value, file) {
  if (Array.isArray(value)) value.forEach((item) => check(item, file))
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
    if (others.has(key) || (key === 'id' && others.has(item))) throw new Error(`${file} contains another node: ${key === 'id' ? item : key}`)
    check(item, file)
  }
}
for (const file of await readdir(`dist/${site}/data`)) {
  if (file.endsWith('.json')) check(JSON.parse(await readFile(`dist/${site}/data/${file}`, 'utf8')), file)
}
console.log(`${site}: no other node keys or ids in data JSON`)
