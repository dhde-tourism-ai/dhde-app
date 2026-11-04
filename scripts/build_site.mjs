import { spawnSync } from 'node:child_process'
import { scopeSite } from './scope_site_data.mjs'
const site = process.argv[2] ?? process.env.VITE_SITE
await scopeSite(site)
for (const args of [['tsc', '-b'], ['vite', 'build']]) {
  const result = spawnSync('npx', args, { stdio: 'inherit', env: { ...process.env, VITE_SITE: site } })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
