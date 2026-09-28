/**
 * Where data files come from.
 *
 * - VITE_DATA_BASE_URL set (e.g. the CloudFront origin): fetch
 *   `${VITE_DATA_BASE_URL}/data/<file>`; if that fails, fall back to the
 *   snapshot bundled with the app and record the fallback so the shell can
 *   show a "Showing saved data from <date>" notice.
 * - Not set: fetch the bundled snapshot at `${BASE_URL}data/<file>` (relative,
 *   works at a domain root and under /dhde-app/ on GitHub Pages).
 *
 * Dev builds add a cache-busting query so files rewritten in place are re-read.
 */

const LIVE_BASE = (import.meta.env.VITE_DATA_BASE_URL ?? '').trim().replace(/\/+$/, '')

export const hasLiveSource = LIVE_BASE !== ''

function withCacheBust(url: string): string {
  return import.meta.env.DEV ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}` : url
}

export function bundledUrl(file: string): string {
  return `${import.meta.env.BASE_URL}data/${file}`
}

export function liveUrl(file: string): string | null {
  return hasLiveSource ? `${LIVE_BASE}/data/${file}` : null
}

async function fetchJson(url: string, file: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(withCacheBust(url), { signal })
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status} ${res.statusText}`)
  return res.json()
}

// ---- fallback notice store -------------------------------------------------

/** file -> snapshot date (ISO string or '') for each file served from the bundled copy after a live failure. */
const fallbacks = new Map<string, string>()
const listeners = new Set<() => void>()
/** Immutable snapshot for useSyncExternalStore: null while every file came from the live source. */
let fallbackState: { date: string | null } | null = null

function snapshotDateOf(json: unknown): string {
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>
    if (typeof o.generated_at === 'string') return o.generated_at
    const meta = o.meta as Record<string, unknown> | undefined
    if (meta && typeof meta.as_of === 'string') return meta.as_of
  }
  return ''
}

function recordFallback(file: string, json: unknown) {
  fallbacks.set(file, snapshotDateOf(json))
  // Newest date among the snapshot files actually shown.
  const dates = [...fallbacks.values()].filter(Boolean).sort()
  fallbackState = { date: dates.length ? dates[dates.length - 1] : null }
  listeners.forEach((l) => l())
}

export function subscribeFallback(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getFallbackState(): { date: string | null } | null {
  return fallbackState
}

// ---- loader ----------------------------------------------------------------

/** Load one data file: live source first when configured, bundled snapshot otherwise or on failure. */
export async function loadDataFile<T>(file: string, signal: AbortSignal): Promise<T> {
  const live = liveUrl(file)
  if (live) {
    try {
      return (await fetchJson(live, file, signal)) as T
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      console.warn(`Live data unavailable for ${file}; using the bundled copy`, err)
      const json = await fetchJson(bundledUrl(file), file, signal)
      recordFallback(file, json)
      return json as T
    }
  }
  return (await fetchJson(bundledUrl(file), file, signal)) as T
}
