/**
 * JMA weather warnings in force, read live from JMA (bosai/warning/data/r8, the
 * level system JMA moved to at the end of May 2026; CORS is open). Read at page
 * load and every REFRESH_MS, so they stay current overnight too, when the
 * preprocessing collector (which saves their history) doesn't run.
 * The code table and areas match dhde-preprocessing-model's
 * sources/weather_warnings.py and its nodes' `jma_warning` config.
 */
import type { LiveWeatherAlert } from '../types/live'

const URL = 'https://www.jma.go.jp/bosai/warning/data/r8/180000.json' // 福井県
export const REFRESH_MS = 10 * 60 * 1000
/** After this long without a good read, the last warnings are shown as unconfirmed and stop moving. */
export const STALE_MS = 30 * 60 * 1000

/** Node → JMA municipality (class20) codes. Rainbow Line crosses Mihama and Wakasa. */
const AREAS: Record<string, string[]> = {
  tojinbo: ['1821000'], // 坂井市
  fukui_station: ['1820100'], // 福井市
  katsuyama: ['1820600'], // 勝山市
  awara_onsen: ['1820800'], // あわら市
  eiheiji: ['1832200'], // 永平寺町
  rainbow_line: ['1844200', '1850100'], // 美浜町, 若狭町
}

type Hazard = keyof typeof HAZARD
const HAZARD = {
  rain: ['大雨', 'Heavy rain', 'heavy_rain'],
  landslide: ['土砂災害', 'Landslide', 'heavy_rain'],
  tide: ['高潮', 'Storm surge', 'waves'],
  wind: ['強風', 'Strong wind', 'wind'],
  wind_snow: ['風雪', 'Wind and snow', 'snow'],
  snow: ['大雪', 'Heavy snow', 'snow'],
  wave: ['波浪', 'High waves', 'waves'],
  thunder: ['雷', 'Thunderstorm', 'thunder'],
  snow_melting: ['融雪', 'Snowmelt', 'snow'],
  fog: ['濃霧', 'Dense fog', 'fog'],
  dry: ['乾燥', 'Dry air', 'other'],
  avalanche: ['なだれ', 'Avalanche', 'snow'],
  cold: ['低温', 'Low temperature', 'other'],
  frost: ['霜', 'Frost', 'other'],
  ice_accretion: ['着氷', 'Ice accretion', 'snow'],
  snow_accretion: ['着雪', 'Snow accretion', 'snow'],
} as const satisfies Record<string, readonly [string, string, LiveWeatherAlert['type']]>
const STRONGER: Partial<Record<Hazard, [string, string]>> = { wind: ['暴風', 'Storm'], wind_snow: ['暴風雪', 'Snowstorm'] }
const LEVEL: Record<number, [string, string]> = { 2: ['注意報', 'advisory'], 3: ['警報', 'warning'], 4: ['危険警報', 'danger warning'], 5: ['特別警報', 'emergency warning'] }
const LEVELLED = new Set<Hazard>(['rain', 'landslide', 'tide'])

const CODES: Record<string, [Hazard, number]> = {
  '10': ['rain', 2], '03': ['rain', 3], '43': ['rain', 4], '33': ['rain', 5],
  '29': ['landslide', 2], '09': ['landslide', 3], '49': ['landslide', 4], '39': ['landslide', 5],
  '19': ['tide', 2], '08': ['tide', 3], '48': ['tide', 4], '38': ['tide', 5],
  '15': ['wind', 2], '05': ['wind', 3], '35': ['wind', 5],
  '13': ['wind_snow', 2], '02': ['wind_snow', 3], '32': ['wind_snow', 5],
  '12': ['snow', 2], '06': ['snow', 3], '36': ['snow', 5],
  '16': ['wave', 2], '07': ['wave', 3], '37': ['wave', 5],
  '14': ['thunder', 2], '17': ['snow_melting', 2], '20': ['fog', 2], '21': ['dry', 2],
  '22': ['avalanche', 2], '23': ['cold', 2], '24': ['frost', 2], '25': ['ice_accretion', 2], '26': ['snow_accretion', 2],
}
const NOT_IN_FORCE = new Set(['解除', '発表警報・注意報はなし'])

/** One good read of JMA's file: the warnings in force and when they were read. */
export interface WarningsRead {
  warnings: JmaWarning[]
  readAt: Date
}

export interface JmaWarning {
  code: string
  hazard: Hazard
  level: number
  nodes: string[]
  /** Latest JMA report covering it (ISO, JST offset). */
  report: string
}

interface R8Report {
  reportDatetime?: string
  warning?: { class20Items?: { areaCode?: string; kinds?: { code?: string; status?: string }[] }[] }
}

/** Warnings in force at any of each node's areas, one entry per warning with the nodes it covers. */
export function parseWarnings(reports: unknown): JmaWarning[] {
  const byCode = new Map<string, JmaWarning>()
  const unknown = new Set<string>()
  if (!Array.isArray(reports)) throw new Error('JMA warnings: not a list of reports')
  for (const rep of reports as R8Report[]) {
    for (const item of rep.warning?.class20Items ?? []) {
      const nodes = Object.keys(AREAS).filter((id) => AREAS[id].includes(item.areaCode ?? ''))
      if (!nodes.length) continue
      for (const k of item.kinds ?? []) {
        const c = k.code
        if (!c || NOT_IN_FORCE.has(k.status ?? '')) continue
        if (!CODES[c]) {
          unknown.add(c)
          continue
        }
        const w = byCode.get(c) ?? { code: c, hazard: CODES[c][0], level: CODES[c][1], nodes: [], report: '' }
        for (const id of nodes) if (!w.nodes.includes(id)) w.nodes.push(id)
        if ((rep.reportDatetime ?? '') > w.report) w.report = rep.reportDatetime ?? ''
        byCode.set(c, w)
      }
    }
  }
  // Shown nowhere else: a code JMA adds (or one this table lacks) would otherwise vanish silently.
  if (unknown.size) console.warn(`JMA warnings: codes in force but not in the table, not shown: ${[...unknown].sort().join(', ')}`)
  return [...byCode.values()].sort((a, b) => b.level - a.level || a.code.localeCompare(b.code))
}

export function warningName(w: Pick<JmaWarning, 'hazard' | 'level'>): { ja: string; en: string } {
  const [hja, hen] = (w.level >= 3 && STRONGER[w.hazard]) || HAZARD[w.hazard]
  const [lja, len] = LEVEL[w.level]
  const lv = LEVELLED.has(w.hazard)
  return { ja: `${lv ? `レベル${'０１２３４５'[w.level]}` : ''}${hja}${lja}`, en: `${hen} ${len}${lv ? ` (level ${w.level})` : ''}` }
}

/**
 * As the app's weather alerts. JMA gives no end time, so a warning runs from its
 * latest report (or the timeline start) to 3 hours past now, and the next read
 * (every 10 minutes) moves or drops it. If JMA hasn't been read for STALE_MS, the
 * warnings are marked unconfirmed and end 3 hours after the last good read, so a
 * lifted one can't stay on screen while JMA is unreachable.
 */
export function toAlerts(read: WarningsRead, start: string, nowIndex: number, now: Date): LiveWeatherAlert[] {
  const t0 = new Date(`${start}T00:00:00+09:00`).getTime()
  const stale = now.getTime() - read.readAt.getTime() > STALE_MS
  const readIdx = Math.floor((read.readAt.getTime() - t0) / 3600000)
  const jst = new Date(read.readAt.getTime() + 9 * 3600000).toISOString().slice(11, 16)
  return read.warnings.map((w) => {
    const name = warningName(w)
    const fromIdx = w.report ? Math.floor((new Date(w.report).getTime() - t0) / 3600000) : nowIndex
    const hhmm = w.report.slice(11, 16)
    const end = stale ? readIdx + 3 : nowIndex + 3
    return {
      id: `jma-${w.code}`,
      type: HAZARD[w.hazard][2],
      level: w.level >= 3 ? 'warning' : 'advisory',
      nodes: w.nodes,
      start: Math.max(0, Math.min(fromIdx, end)),
      end,
      title_en: stale ? `${name.en} (unconfirmed since ${jst})` : name.en,
      title_ja: stale ? `${name.ja}（${jst}以降未確認）` : name.ja,
      detail_en: stale
        ? `JMA couldn't be reached since ${jst}; it may have been lifted.`
        : `In force (JMA${hhmm ? `, report ${hhmm}` : ''}). No end time is given until JMA lifts it.`,
      detail_ja: stale ? `${jst}以降、気象庁から取得できていません。解除されている可能性があります。` : `発表中（気象庁${hhmm ? `、${hhmm}発表` : ''}）。解除まで継続。`,
    }
  })
}

export async function fetchWarnings(signal?: AbortSignal): Promise<WarningsRead> {
  const r = await fetch(URL, { signal, cache: 'no-cache' })
  if (!r.ok) throw new Error(`JMA warnings: HTTP ${r.status}`)
  return { warnings: parseWarnings(await r.json()), readAt: new Date() }
}
