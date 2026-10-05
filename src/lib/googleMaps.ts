/**
 * Google Maps links for the map's transport: open a route, stop or station on the
 * real map (no API key; these are Google's public Maps URLs).
 */

const BASE = 'https://www.google.com/maps'

const km = (a: [number, number], b: [number, number]) =>
  Math.hypot((b[0] - a[0]) * 111.2, (b[1] - a[1]) * 111.2 * Math.cos((a[0] * Math.PI) / 180))

/**
 * A named place near a point: Google searches the name around it, so it finds that stop or
 * station (with its name and departures) rather than dropping a bare coordinate pin, which
 * showed only "36°03'55.3"N 136°09'14.9"E" and read as a random location.
 */
const nearUrl = (query: string, lat: number, lon: number): string => `${BASE}/search/${encodeURIComponent(query)}/@${lat.toFixed(6)},${lon.toFixed(6)},17z`

/** A bus stop, by its Japanese name (e.g. 安田 → "安田 バス停"), around its position. */
export const busStopUrl = (nameJa: string, lat: number, lon: number): string => nearUrl(`${nameJa} バス停`, lat, lon)

/** A railway station, by its Japanese name (e.g. 敦賀 → "敦賀駅"), around its position. */
export const stationUrl = (nameJa: string, lat: number, lon: number): string => nearUrl(nameJa.endsWith('駅') ? nameJa : `${nameJa}駅`, lat, lon)

/** A railway line by name (Google draws the line), e.g. "えちぜん鉄道 三国芦原線". */
export const railLineUrl = (nameJa: string): string => `${BASE}/search/?api=1&query=${encodeURIComponent(nameJa)}`

/**
 * A bus route: public-transport directions along it, from the start of its line to its
 * farthest point (a loop route starts and ends in the same place).
 */
export function busRouteUrl(path: [number, number][]): string | null {
  if (path.length < 2) return null
  const a = path[0]
  const b = path.reduce((far, p) => (km(a, p) > km(a, far) ? p : far), path[path.length - 1])
  return `${BASE}/dir/?api=1&origin=${a[0].toFixed(6)},${a[1].toFixed(6)}&destination=${b[0].toFixed(6)},${b[1].toFixed(6)}&travelmode=transit`
}
