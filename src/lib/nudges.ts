/**
 * The team's three nudge loops, run over the (demo) live and market data:
 *  #1 Demand alert: forecast well above / below normal for a node and day.
 *  #2 Weather-route: severe weather at a coastal node → indoor site + route.
 *  #3 Over / under-booking: hotel occupancy vs the demand forecast.
 * Pure functions; the Map view shows the result as a panel and map annotations.
 */
import type { LiveData } from '../types/live'
import type { MarketVoiceData } from '../types/market'
import type { RegistryNode } from '../types/nodes'
import type { Sev } from './alerts'
import { dailyArrivals, dayLabel, hourLabel } from './live'

export interface RouteLeg {
  id: string
  reverse?: boolean
}

export interface Nudge {
  id: string
  loop: 1 | 2 | 3
  sev: Sev
  node: string
  day: number
  /** Hour indices the nudge applies to. */
  start: number
  end: number
  title_en: string
  title_ja: string
  /** Which signals triggered it. */
  reason_en: string
  reason_ja: string
  action_en: string
  action_ja: string
  focus: [number, number]
  /** Suggested route to draw (loop #2). */
  route?: RouteLeg[]
  route_label_en?: string
  route_label_ja?: string
}

export const LOOP_LABEL: Record<Nudge['loop'], { en: string; ja: string }> = {
  1: { en: 'Demand alert', ja: '需要アラート' },
  2: { en: 'Weather-route', ja: '天候・ルート' },
  3: { en: 'Booking balance', ja: '予約バランス' },
}

const DEMAND_THRESHOLD = 0.35
const COASTAL: Record<string, { site_en: string; site_ja: string; to: string; route: RouteLeg[] }> = {
  tojinbo: {
    site_en: 'Fukui Prefectural Dinosaur Museum (indoor)',
    site_ja: '福井県立恐竜博物館（屋内）',
    to: 'katsuyama',
    route: [{ id: 'fukui_station-tojinbo', reverse: true }, { id: 'fukui_station-katsuyama' }],
  },
  rainbow_line: {
    site_en: 'Fukui City museums and Fukui Station area (indoor)',
    site_ja: '福井市内の博物館・福井駅周辺（屋内）',
    to: 'fukui_station',
    route: [{ id: 'fukui_station-rainbow_line', reverse: true }],
  },
}

function nm(reg: RegistryNode[], id: string, lang: 'en' | 'ja') {
  const n = reg.find((r) => r.id === id)
  if (!n) return id
  return lang === 'ja' ? n.name_ja : n.name.replace(' East Entrance', '')
}

/** "Normal" daily visitors: 2025 annual count ÷ 365, else the window's mean forecast. */
function normalDaily(live: LiveData, id: string): number {
  const a = live.nodes[id]?.annual_visitors_2025
  if (a) return a / 365
  const d = dailyArrivals(live, id)
  return d.reduce((s, x) => s + x.predicted, 0) / Math.max(1, d.length)
}

export function computeNudges(live: LiveData, market: MarketVoiceData | null, reg: RegistryNode[], fromDay: number): Nudge[] {
  const out: Nudge[] = []
  const pos = (id: string): [number, number] => {
    const n = reg.find((r) => r.id === id)
    return n ? [n.lat, n.lon] : [36.06, 136.22]
  }

  // #1 Demand alerts
  for (const id of Object.keys(live.nodes)) {
    const normal = normalDaily(live, id)
    for (const { d, predicted } of dailyArrivals(live, id)) {
      if (d < fromDay) continue
      const pct = predicted / normal - 1
      if (Math.abs(pct) < DEMAND_THRESHOLD) continue
      const day = live.days[d]
      const up = pct > 0
      const p = `${up ? '+' : ''}${Math.round(pct * 100)}%`
      out.push({
        id: `n1-${id}-${d}`,
        loop: 1,
        sev: up ? (pct >= 0.45 ? 'serious' : 'warn') : 'info',
        node: id,
        day: d,
        start: d * 24 + 9,
        end: d * 24 + 17,
        title_en: `${nm(reg, id, 'en')} ${dayLabel(live, d, 'en')}: ${p} vs normal`,
        title_ja: `${nm(reg, id, 'ja')} ${dayLabel(live, d, 'ja')}：平常比${p}`,
        reason_en: `Forecast ${Math.round(predicted).toLocaleString()} visitors vs normal ${Math.round(normal).toLocaleString()} (${day.weekend ? 'weekend' : 'weekday'}${up ? '' : ', weather or weekday dip'}).`,
        reason_ja: `予測${Math.round(predicted).toLocaleString()}人、平常${Math.round(normal).toLocaleString()}人（${day.weekend ? '週末' : '平日'}）。`,
        action_en: up ? 'Add staff, extend parking and shop hours; push timed entry.' : 'Run a same-week offer and promote to nearby overnight guests.',
        action_ja: up ? '増員、駐車場・営業時間の延長、時間指定入場の案内を。' : '今週限りの特典で近隣宿泊客へ告知を。',
        focus: pos(id),
      })
    }
  }

  // #2 Weather-route
  for (const [id, alt] of Object.entries(COASTAL)) {
    const n = live.nodes[id]
    if (!n) continue
    let open: number | null = null
    let peakMm = 0
    let peakWind = 0
    for (let i = fromDay * 24; i <= live.hours; i++) {
      const mm = n.weather.precip_mm[i] ?? 0
      const wind = n.weather.wind_ms[i] ?? 0
      const severe = i < live.hours && (mm >= 8 || wind >= 13)
      if (severe) {
        if (open === null) open = i
        peakMm = Math.max(peakMm, mm)
        peakWind = Math.max(peakWind, wind)
      } else if (open !== null) {
        const d = Math.floor(open / 24)
        const alerts = live.weather_alerts.filter((a) => a.nodes.includes(id) && a.start <= i - 1 && a.end >= open!)
        out.push({
          id: `n2-${id}-${open}`,
          loop: 2,
          sev: 'crit',
          node: id,
          day: d,
          start: open,
          end: i - 1,
          title_en: `${nm(reg, id, 'en')} ${dayLabel(live, d, 'en')} ${hourLabel(open)}–${hourLabel(i)}: severe weather`,
          title_ja: `${nm(reg, id, 'ja')} ${dayLabel(live, d, 'ja')} ${hourLabel(open)}–${hourLabel(i)}：荒天`,
          reason_en: `Rain up to ${peakMm.toFixed(0)} mm/h, wind ${peakWind.toFixed(0)} m/s${alerts.length ? '; ' + alerts.map((a) => a.title_en.toLowerCase()).join(', ') : ''}.`,
          reason_ja: `最大${peakMm.toFixed(0)}mm/h、風速${peakWind.toFixed(0)}m/s${alerts.length ? '、' + alerts.map((a) => a.title_ja).join('・') : ''}。`,
          action_en: `Recommend ${alt.site_en}; show the inland route on signage and apps.`,
          action_ja: `${alt.site_ja}を推奨し、内陸ルートを案内。`,
          focus: pos(id),
          route: alt.route,
          route_label_en: `Suggested: ${nm(reg, alt.to, 'en')}`,
          route_label_ja: `推奨：${nm(reg, alt.to, 'ja')}`,
        })
        open = null
        peakMm = 0
        peakWind = 0
      }
    }
  }

  // #3 Over / under-booking
  if (market) {
    const fukuiHotels = market.hotels.find((h) => h.id === 'fukui_station')
    for (const h of market.hotels) {
      const normal = normalDaily(live, h.node)
      const daily = dailyArrivals(live, h.node)
      h.occupancy_pct.forEach((occ, d) => {
        if (d < fromDay) return
        const ratio = (daily[d]?.predicted ?? normal) / normal
        const nights = `${dayLabel(live, d, 'en')} night`
        if (occ >= 85 && ratio >= 1.15) {
          const alt = h.id === 'fukui_station' ? market.hotels.find((x) => x.id === 'awara_onsen') : fukuiHotels
          out.push({
            id: `n3-${h.id}-${d}`,
            loop: 3,
            sev: 'serious',
            node: h.node,
            day: d,
            start: d * 24 + 15,
            end: d * 24 + 23,
            title_en: `${h.name}: ${occ}% booked for ${nights}`,
            title_ja: `${h.name_ja}：${dayLabel(live, d, 'ja')}泊は${occ}%予約済み`,
            reason_en: `Occupancy ${occ}% (${h.rooms_left[d]} rooms left) while demand at ${nm(reg, h.node, 'en')} is ${Math.round((ratio - 1) * 100)}% above normal.`,
            reason_ja: `稼働率${occ}%（残り${h.rooms_left[d]}室）、${nm(reg, h.node, 'ja')}の需要は平常比+${Math.round((ratio - 1) * 100)}%。`,
            action_en: `Raise rates; redirect overflow to ${alt?.name ?? 'nearby hotels'} (${alt ? alt.rooms_left[d] : '?'} rooms left).`,
            action_ja: `料金を引き上げ、${alt?.name_ja ?? '近隣ホテル'}（残り${alt ? alt.rooms_left[d] : '?'}室）へ誘導。`,
            focus: [h.lat, h.lon],
          })
        } else if (occ <= 40) {
          out.push({
            id: `n3u-${h.id}-${d}`,
            loop: 3,
            sev: 'info',
            node: h.node,
            day: d,
            start: d * 24 + 10,
            end: d * 24 + 20,
            title_en: `${h.name}: only ${occ}% booked for ${nights}`,
            title_ja: `${h.name_ja}：${dayLabel(live, d, 'ja')}泊は${occ}%のみ`,
            reason_en: `${h.rooms_left[d]} rooms free; ${nm(reg, h.node, 'en')} expects ${Math.round(daily[d]?.predicted ?? 0).toLocaleString()} day visitors (${ratio >= 1 ? 'at or above' : 'below'} normal).`,
            reason_ja: `空室${h.rooms_left[d]}室、${nm(reg, h.node, 'ja')}の日帰り客は${Math.round(daily[d]?.predicted ?? 0).toLocaleString()}人の見込み。`,
            action_en: 'Promote stay packages to day visitors and Kanazawa guests (dinner + room, late checkout).',
            action_ja: '日帰り客・金沢宿泊客に宿泊パッケージ（夕食付き・レイトチェックアウト）を訴求。',
            focus: [h.lat, h.lon],
          })
        }
      })
    }
  }

  const rank: Record<Sev, number> = { crit: 3, serious: 2, warn: 1, info: 0 }
  return out.sort((a, b) => a.day - b.day || rank[b.sev] - rank[a.sev] || a.start - b.start)
}
