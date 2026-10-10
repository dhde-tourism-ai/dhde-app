import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadLiveFile } from './dataSource'
import { fetchForecast, forecastRows, s3ForecastRows, S3_FORECAST_MAX_AGE_MS, type OpenMeteoPoint, type S3Forecast } from './weatherHourly'

// The S3 file is read through dataSource; the direct Open-Meteo call through fetch.
vi.mock('./dataSource', () => ({ LIVE_DATA_URL: 'https://live.test', loadLiveFile: vi.fn() }))
const loadLive = vi.mocked(loadLiveFile)

const point = (temp: number): OpenMeteoPoint => ({
  hourly: {
    time: ['2026-10-05T13:00', '2026-10-05T14:00'],
    temperature_2m: [temp, temp + 1],
    precipitation: [0, 0.5],
    wind_speed_10m: [2, 3],
    relative_humidity_2m: [60, 70],
    weather_code: [3, 61],
  },
})
const A = { id: 'a', lat: 36, lon: 136 }
const B = { id: 'b', lat: 37, lon: 137 }
const NOW = Date.parse('2026-10-05T05:00:00Z')
const file = (generated_at: string, nodes: Record<string, OpenMeteoPoint>): S3Forecast => ({ generated_at, nodes })

/** fetch answering like Open-Meteo, one point per requested latitude; records the URLs asked. */
function stubOpenMeteo(temp: number) {
  const urls: string[] = []
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url)
    const n = new URL(url).searchParams.get('latitude')!.split(',').length
    const body = n === 1 ? point(temp) : Array.from({ length: n }, () => point(temp))
    return new Response(JSON.stringify(body))
  })
  return urls
}

afterEach(() => {
  vi.unstubAllGlobals()
  loadLive.mockReset()
})

describe('forecastRows', () => {
  it('turns an Open-Meteo point into rows keyed by the CSV hour', () => {
    const rows = forecastRows(point(10), '2026-10-05T04:05+00:00')!
    expect([...rows.keys()]).toEqual(['2026-10-05 13', '2026-10-05 14'])
    expect(rows.get('2026-10-05 14')).toEqual({
      source: 'forecast', temp_c: 11, precip_mm: 0.5, wind_ms: 3, humidity_pct: 70, weather_code: 61, issued_at: '2026-10-05T04:05+00:00',
    })
  })

  it('gives null for a point without hourly times, and null for a missing value', () => {
    expect(forecastRows(undefined, 'x')).toBeNull()
    expect(forecastRows({ hourly: {} }, 'x')).toBeNull()
    expect(forecastRows({ hourly: { time: ['2026-10-05T13:00'] } }, 'x')!.get('2026-10-05 13')!.temp_c).toBeNull()
  })
})

describe('s3ForecastRows', () => {
  it('uses a fresh file, with its generated_at as issued_at', () => {
    const out = s3ForecastRows(file('2026-10-05T04:05+00:00', { a: point(10) }), [A], NOW)
    expect(out.a.get('2026-10-05 13')!.issued_at).toBe('2026-10-05T04:05+00:00')
  })

  it('ignores a file 3 hours old or more, or without a readable date', () => {
    const at = (ms: number) => new Date(NOW - ms).toISOString()
    expect(s3ForecastRows(file(at(S3_FORECAST_MAX_AGE_MS - 60_000), { a: point(10) }), [A], NOW).a).toBeDefined()
    expect(s3ForecastRows(file(at(S3_FORECAST_MAX_AGE_MS), { a: point(10) }), [A], NOW)).toEqual({})
    expect(s3ForecastRows(file('', { a: point(10) }), [A], NOW)).toEqual({})
    expect(s3ForecastRows({ nodes: { a: point(10) } }, [A], NOW)).toEqual({})
  })

  it('leaves out nodes the file does not have', () => {
    expect(Object.keys(s3ForecastRows(file(new Date(NOW).toISOString(), { a: point(10) }), [A, B], NOW))).toEqual(['a'])
  })
})

describe('fetchForecast', () => {
  it('uses the S3 file alone when it is fresh and has every node', async () => {
    loadLive.mockResolvedValue(file(new Date().toISOString(), { a: point(10), b: point(20) }))
    const urls = stubOpenMeteo(0)
    const out = await fetchForecast([A, B])
    expect(urls).toEqual([])
    expect(out.b.get('2026-10-05 13')!.temp_c).toBe(20)
  })

  it('asks Open-Meteo directly for nodes the file lacks', async () => {
    loadLive.mockResolvedValue(file(new Date().toISOString(), { a: point(10) }))
    const urls = stubOpenMeteo(30)
    const out = await fetchForecast([A, B])
    expect(urls).toHaveLength(1)
    expect(new URL(urls[0]).searchParams.get('latitude')).toBe('37')
    expect(out.a.get('2026-10-05 13')!.temp_c).toBe(10)
    expect(out.b.get('2026-10-05 13')!.temp_c).toBe(30)
  })

  it('asks Open-Meteo for every node when the file is stale, unreadable or not configured', async () => {
    for (const s3 of [
      () => loadLive.mockResolvedValue(file(new Date(Date.now() - S3_FORECAST_MAX_AGE_MS).toISOString(), { a: point(10), b: point(20) })),
      () => loadLive.mockRejectedValue(new Error('Failed to load weather_forecast.json: 404')),
      () => loadLive.mockResolvedValue(null),
    ]) {
      s3()
      const urls = stubOpenMeteo(30)
      const out = await fetchForecast([A, B])
      expect(urls).toHaveLength(1)
      expect(new URL(urls[0]).searchParams.get('latitude')).toBe('36,37')
      expect(out.a.get('2026-10-05 13')!.temp_c).toBe(30)
    }
  })

  it('gives what it has when both fail', async () => {
    loadLive.mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', async () => new Response('', { status: 503 }))
    expect(await fetchForecast([A, B])).toEqual({})
  })
})
