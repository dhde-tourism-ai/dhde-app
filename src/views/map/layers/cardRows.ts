/**
 * The rows of the site cards (SiteCards.tsx), as HTML for their Leaflet icons: one
 * per layer. Each layer's hover detail stays with its layer (WeatherDetail,
 * ReviewsDetail, SurveyDetail, SocialDetail).
 */
import type { NodeFrame } from '../../../lib/live'
import { escapeHtml, sentimentColour } from '../../../lib/live'
import type { MapNode } from '../../../lib/nodes'
import type { MarketVoiceData } from '../../../types/market'
import type { RealNodeMeta } from '../../../types/live'
import { iconSvg, weatherSvg } from '../../../lib/icons'
import { starsHtml } from '../../../lib/market'

type Survey = MarketVoiceData['survey'][string]
type Social = MarketVoiceData['social'][string]
type Review = MarketVoiceData['reviews'][string]

/** Latest real signal on or before day d (for nodes without a visitor estimate). */
export function lastSignal(m: RealNodeMeta | undefined, d: number): { v: number; day: number } | null {
  if (!m) return null
  for (let k = Math.min(d, m.signal_daily.length - 1); k >= 0; k--) {
    const v = m.signal_daily[k]
    if (v !== null && v !== undefined) return { v, day: k }
  }
  return null
}

/** Rain or wind at which the weather-route nudge fires (nudges.ts): worth flagging on a card. */
export function severeWeather(f: NodeFrame): boolean {
  return f.weather.mm >= 8 || f.weather.wind >= 13
}

/** The card row: JMA-style pictogram, temperature, chance of rain, wind, and warnings in force. */
export function weatherRow(f: NodeFrame, lang: 'en' | 'ja'): string {
  const w = f.weather
  const alerts = f.alerts.length
    ? `<span class="wx-alert" title="${escapeHtml(f.alerts.map((a) => (lang === 'ja' ? a.title_ja : a.title_en)).join(', '))}">${iconSvg('alert', 11)}${f.alerts.length}</span>`
    : ''
  return `<span class="sc-ic">${weatherSvg(w.cond, 18)}</span><b class="num">${Math.round(w.temp)}°</b><span class="ov-sub">${iconSvg('umbrella', 10)}${w.pop}% · ${iconSvg('wind', 10)}${Math.round(w.wind)} m/s</span>${alerts}`
}

export function surveyRow(s: Survey): string {
  return `<span class="sc-ic">${iconSvg('survey', 13)}</span><b class="num">${s.satisfaction.toFixed(1)}</b><span class="ov-sub">/5${s.nps !== null ? ` · NPS ${s.nps > 0 ? '+' : ''}${s.nps}` : ''}</span>`
}

/** The row's dot for real social counts without a sentiment score: neutral grey. */
const SOCIAL_REAL_DOT = '#8a94a6'

export function socialRow(s: Social, lang: 'en' | 'ja'): string {
  // Real posts (Instagram plus mentions) where they exist, the dot coloured by the real
  // sentiment where there's enough of it; else the fictional demo.
  if (s.real || s.mentions) {
    const days = Math.max(s.real?.days ?? 0, s.mentions?.days ?? 0)
    const total = (s.real?.posts ?? 0) + (s.mentions?.total ?? 0)
    const sc = s.sentiment_real?.score
    const dot = typeof sc === 'number' ? sentimentColour(sc) : SOCIAL_REAL_DOT
    return `<span class="sc-dot" style="background:${dot}"></span><b class="num">${total.toLocaleString('en-US')}</b><span class="ov-sub">${escapeHtml(lang === 'ja' ? `件/${days}日` : `posts ${days}d`)}</span>`
  }
  return `<span class="sc-dot" style="background:${sentimentColour(s.avg_sentiment)}"></span><b class="num">${s.posts_24h}</b><span class="ov-sub">${escapeHtml(lang === 'ja' ? '件/24h' : 'posts 24h')}</span>`
}

export function reviewsRow(r: Review): string {
  const ch = Math.round((r.rating - r.rating_30d_ago) * 10) / 10
  return `${starsHtml(r.rating)}<b class="num">${r.rating.toFixed(1)}</b><span class="ov-sub">(${r.real ? `+${r.new_30d}` : r.count.toLocaleString('en-US')})</span><span class="ov-delta ${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'}${Math.abs(ch).toFixed(1)}</span>`
}

export interface CardLayers {
  people: boolean
  weather: boolean
  reviews: boolean
  survey: boolean
  social: boolean
}

export interface CardRow {
  key: string
  html: string
  /** Shown zoomed out too: a weather warning in force, or severe weather. */
  attention: boolean
}

/** A site's card rows for the active layers. */
export function rowsFor(n: MapNode, frame: Record<string, NodeFrame> | null, market: MarketVoiceData | null, layers: CardLayers, lang: 'en' | 'ja'): CardRow[] {
  const f = frame?.[n.id]
  const rows: CardRow[] = []
  if (layers.weather && f) rows.push({ key: 'weather', html: weatherRow(f, lang), attention: f.alerts.length > 0 || severeWeather(f) })
  const r = layers.reviews ? market?.reviews[n.id] : undefined
  if (r) rows.push({ key: 'reviews', html: reviewsRow(r), attention: false })
  const s = layers.survey ? market?.survey[n.id] : undefined
  if (s) rows.push({ key: 'survey', html: surveyRow(s), attention: false })
  const so = layers.social ? market?.social[n.id] : undefined
  if (so) rows.push({ key: 'social', html: socialRow(so, lang), attention: false })
  return rows
}
