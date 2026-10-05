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

const stationName = (nameJa: string): string => (nameJa.endsWith('駅') ? nameJa : `${nameJa}駅`)

/**
 * A railway line: public-transport directions between its two end stations, so Google draws the
 * route along that line. (Google Maps can't search a line by name: "ハピラインふくい線", "北陸新幹線"
 * and the others all come back as not found.)
 */
export function railLineUrl(stations: { name_ja: string; lat: number; lon: number }[]): string | null {
  if (stations.length < 2) return null
  let ends: [(typeof stations)[number], (typeof stations)[number]] = [stations[0], stations[1]]
  let best = -1
  for (let i = 0; i < stations.length; i++)
    for (let j = i + 1; j < stations.length; j++) {
      const d = km([stations[i].lat, stations[i].lon], [stations[j].lat, stations[j].lon])
      if (d > best) {
        best = d
        ends = [stations[i], stations[j]]
      }
    }
  const [a, b] = ends
  return `${BASE}/dir/?api=1&origin=${encodeURIComponent(stationName(a.name_ja))}&destination=${encodeURIComponent(stationName(b.name_ja))}&travelmode=transit`
}

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
