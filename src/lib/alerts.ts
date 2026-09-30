import type { LiveData } from '../types/live'
import type { RoutesFile } from '../types/routes'
import type { RegistryNode } from '../types/nodes'
import { activeAdvisories, crowdTier, timeLabel, trafficTier } from './live'
import type { NodeFrame } from './live'

export type Sev = 'crit' | 'serious' | 'warn' | 'info'
export const SEV_RANK: Record<Sev, number> = { crit: 3, serious: 2, warn: 1, info: 0 }
export const SEV_COLOUR: Record<Sev, string> = { crit: '#d03b3b', serious: '#ec835a', warn: '#fab219', info: '#8b9dff' }

export interface AlertItem {
  id: string
  sev: Sev
  en: string
  ja: string
  node?: string
}

export interface AlertGroups {
  traffic: AlertItem[]
  weather: AlertItem[]
  crowd: AlertItem[]
  insights: AlertItem[]
}

function nm(reg: RegistryNode[], id: string, lang: 'en' | 'ja'): string {
  const n = reg.find((r) => r.id === id)
  if (!n) return id
  return lang === 'ja' ? n.name_ja : n.name.replace(' East Entrance', '')
}

const bySev = (a: AlertItem, b: AlertItem) => SEV_RANK[b.sev] - SEV_RANK[a.sev]

/** Traffic, weather, crowding and operator insights at hour t (the demo's alert panels, rebuilt). */
export function computeAlerts(live: LiveData, routes: RoutesFile | null, frame: Record<string, NodeFrame>, reg: RegistryNode[], t: number): AlertGroups {
  const traffic: AlertItem[] = []
  const weather: AlertItem[] = []
  const crowd: AlertItem[] = []
  const insights: AlertItem[] = []

  for (const a of activeAdvisories(live, t)) {
    traffic.push({ id: a.id, sev: 'crit', en: `Reroute advised. ${a.reason_en}`, ja: `迂回推奨。${a.reason_ja}` })
  }
  for (const [rid, tr] of Object.entries(live.traffic)) {
    const r = routes?.routes.find((x) => x.id === rid)
    if (!r || r.kind === 'alternate') continue
    const worst = Math.max(...tr.congestion.map((s) => s[t] ?? 0))
    const tier = trafficTier(worst)
    if (tier.key === 'good') continue
    traffic.push({
      id: `tr-${rid}`,
      sev: tier.key === 'crit' ? 'serious' : 'warn',
      en: `${tier.label}: ${r.label} (${Math.round(worst * 100)}% congestion)`,
      ja: `${tier.label_ja}：${r.label_ja}（混雑度${Math.round(worst * 100)}%）`,
      node: r.to,
    })
  }

  for (const a of live.weather_alerts) {
    const where = (lang: 'en' | 'ja') => a.nodes.map((id) => nm(reg, id, lang)).join(lang === 'ja' ? '・' : ', ')
    if (t >= a.start && t <= a.end) {
      weather.push({
        id: a.id,
        sev: a.level === 'warning' ? 'crit' : 'warn',
        en: `${a.title_en} · ${where('en')}. ${a.detail_en}`,
        ja: `${a.title_ja}・${where('ja')}。${a.detail_ja}`,
      })
    } else if (a.start > t && a.start - t <= 36) {
      weather.push({
        id: a.id,
        sev: 'info',
        en: `Expected from ${timeLabel(live, a.start, 'en')}: ${a.title_en} · ${where('en')}`,
        ja: `${timeLabel(live, a.start, 'ja')}から見込み：${a.title_ja}・${where('ja')}`,
      })
    }
  }

  for (const [id, f] of Object.entries(frame)) {
    if (f.noEstimate) continue
    if (f.tier.key === 'crit' || f.tier.key === 'serious') {
      crowd.push({
        id: `cr-${id}`,
        sev: f.tier.key,
        node: id,
        en: `${nm(reg, id, 'en')}: ${f.tier.label.toLowerCase()}, ${Math.round(f.onSite).toLocaleString('en-US')} on site (${Math.round(f.load * 100)}% of comfortable capacity)`,
        ja: `${nm(reg, id, 'ja')}：${f.tier.label_ja}、現地${Math.round(f.onSite).toLocaleString('en-US')}人（快適容量の${Math.round(f.load * 100)}%）`,
      })
    }
    // Operator insight: counts running ahead of forecast (the demo's "extend hours, staff up" nudge).
    if (f.observed && f.actual !== null && f.predicted > 50 && f.actual > f.predicted * 1.08) {
      const pct = Math.round((f.actual / f.predicted - 1) * 100)
      insights.push({
        id: `ahead-${id}`,
        sev: 'info',
        node: id,
        en: `${nm(reg, id, 'en')} is running ${pct}% ahead of forecast. Extend shop hours and add staff for the afternoon.`,
        ja: `${nm(reg, id, 'ja')}は予測を${pct}%上回っています。午後の営業時間延長と増員を。`,
      })
    }
    // Next forecast over-capacity window after t.
    const n = live.nodes[id]
    if (n) {
      for (let i = t + 1; i < Math.min(live.hours, t + 72); i++) {
        const v = n.on_site.predicted[i]
        if (crowdTier(v / n.comfortable_capacity).key === 'crit') {
          insights.push({
            id: `next-${id}`,
            sev: 'info',
            node: id,
            en: `${nm(reg, id, 'en')} forecast over capacity from ${timeLabel(live, i, 'en')}. Consider timed entry or promoting a nearby site.`,
            ja: `${nm(reg, id, 'ja')}は${timeLabel(live, i, 'ja')}から過密の予測。時間指定入場や周辺施設への誘導を検討。`,
          })
          break
        }
      }
    }
  }

  return { traffic: traffic.sort(bySev), weather: weather.sort(bySev), crowd: crowd.sort(bySev), insights }
}

export function topAlert(g: AlertGroups): AlertItem | null {
  const all = [...g.weather, ...g.crowd, ...g.traffic].sort(bySev)
  return all[0] ?? null
}
