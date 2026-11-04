import type { LiveData, DataSources } from '../types/live'
import type { MarketVoiceData } from '../types/market'
import type { LayerId } from '../views/map/layers'
import type { mergeAll } from './real'

export const SITE_ID: string = import.meta.env.VITE_SITE ?? ''

/** Only measured sources are available. */
export function siteLayerAllowed(layer: LayerId, sources?: DataSources): boolean {
  if (!SITE_ID) return true
  if (['transport', 'rail'].includes(layer)) return true
  if (['flow', 'traffic', 'nudges', 'density', 'economics'].includes(layer)) return false
  return Boolean(sources?.[layer as keyof DataSources]?.real.includes(SITE_ID))
}

/** Remove partial demo fallbacks after the shared merge, preserving daily estimates and model forecasts. */
export function cleanSiteMerge(merged: ReturnType<typeof mergeAll>): ReturnType<typeof mergeAll> {
  if (!SITE_ID) return merged
  const live: LiveData = structuredClone(merged.live)
  const market: MarketVoiceData | null = structuredClone(merged.market)
  if (!merged.real) live.nodes = {}
  live.demo = false
  live.flows = {}; live.traffic = {}; live.advisories = []
  live.weather_alerts = live.weather_alerts.filter((a) => !a.demo && a.nodes.includes(SITE_ID)).map((a) => ({ ...a, nodes: [SITE_ID] }))
  const n = live.nodes[SITE_ID]
  const meta = live.node_meta?.[SITE_ID]
  if (n && meta) {
    // The map uses daily totals at every hour. It makes no claim about hourly footfall.
    const forecast = merged.real?.nodes[SITE_ID]?.forecast?.days ?? []
    meta.forecast_method = 'Published daily model forecast; missing dates are omitted.'
    meta.forecast_source_daily = meta.forecast_source_daily.map((source) => source === 'model' ? source : null)
    for (let i = 0; i < live.hours; i++) {
      const d = Math.floor(i / 24)
      const actual = meta.visitors_daily[d]
      const predicted = (meta.forecast_source_daily[d] ? forecast.find((f) => f.date === live.days[d].date)?.visitors_est : null) ?? actual ?? 0
      for (const series of [n.on_site, n.arrivals]) {
        series.actual[i] = series === n.arrivals && actual != null ? actual / 24 : actual
        series.predicted[i] = series === n.arrivals ? predicted / 24 : predicted
        series.lo = undefined; series.hi = undefined
      }
    }
    n.comfortable_capacity = meta.normal_daily ?? 1
  }
  if (market && !merged.real) {
    market.hotels = []; market.rsi = []; market.survey = {}; market.social = {}; market.reviews = {}
  }
  if (market) {
    market.demo = false
    for (const layer of ['survey', 'social', 'reviews'] as const) {
      if (!siteLayerAllowed(layer, live.sources)) market[layer] = {}
    }
    const survey = market.survey[SITE_ID]
    if (survey && !survey.details_real) {
      delete market.survey[SITE_ID]
      if (live.sources?.survey) live.sources.survey.real = []
    }
    const review = market.reviews[SITE_ID]
    if (review) { review.snippets = []; review.source = 'Published review aggregates' }
    for (const social of Object.values(market.social)) social.feed = []
    // Area ids in mergeAll are mapped to the site id for the site's layer gate.
    market.hotels = market.hotels.filter((h) => h.real_feed_node === SITE_ID)
    market.rsi = market.rsi.filter((r) => r.gmb?.node === SITE_ID)
    if (live.sources?.hotels) live.sources.hotels.real = market.hotels.length ? [SITE_ID] : []
    if (live.sources?.rsi) live.sources.rsi.real = market.rsi.length ? [SITE_ID] : []
  }
  return { ...merged, live, market, sources: live.sources ?? {} }
}
