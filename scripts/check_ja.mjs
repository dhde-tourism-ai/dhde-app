// List the Strategy page's display strings that have no Japanese in
// src/i18n/strategy.ja.json. Strings are looked up by their exact English
// text (src/lib/localize.ts), so editing an English string silently drops its
// Japanese: run this after changing public/data/strategic_questions.json.
//
//   node scripts/check_ja.mjs            report only (exit 0)
//   node scripts/check_ja.mjs --strict   exit 1 if any string is missing
import { readFileSync } from 'node:fs'

// Keep in step with SKIP in src/lib/localize.ts: these keys hold code or ids.
const SKIP = new Set(['id', 'type', 'status', 'series', 'total', 'domestic', 'foreign', 'unit', 'spec', 'formula', 'prefix', 'links', 'nodes', 'severity', 'counts', 'layers', 'node', 'year'])
// Not text to translate: numbers, dates, ids and figures such as "¥198.7bn" or "3 / 5".
const HAS_WORDS = /[A-Za-z]{3,}/

const data = JSON.parse(readFileSync('public/data/strategic_questions.json', 'utf8'))
const dict = JSON.parse(readFileSync('src/i18n/strategy.ja.json', 'utf8'))

const missing = new Map() // string -> first path it appears at
const walk = (v, path) => {
  if (typeof v === 'string') {
    const s = v.trim()
    if (HAS_WORDS.test(s) && !(s in dict) && !missing.has(s)) missing.set(s, path)
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => walk(x, `${path}[${i}]`))
  } else if (v && typeof v === 'object') {
    if (v.hidden === true) return // a hidden card (e.g. the Q4 funnel) isn't shown
    for (const [k, x] of Object.entries(v)) if (!SKIP.has(k) && !k.endsWith('_ja')) walk(x, path ? `${path}.${k}` : k)
  }
}
walk(data, '')

if (missing.size === 0) {
  console.log('Every Strategy display string has a Japanese entry.')
} else {
  console.log(`${missing.size} display string(s) without Japanese in src/i18n/strategy.ja.json:`)
  for (const [s, path] of missing) console.log(`- ${path}: ${s.length > 90 ? `${s.slice(0, 90)}…` : s}`)
}
const unused = Object.keys(dict).filter((k) => !JSON.stringify(data).includes(JSON.stringify(k).slice(1, -1)))
if (unused.length) console.log(`\n${unused.length} Japanese entr(ies) no longer used (safe to remove once nothing needs them).`)
process.exit(process.argv.includes('--strict') && missing.size ? 1 : 0)
