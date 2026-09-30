import { useEffect, useMemo } from 'react'
import { Marker, Polyline, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { LiveData } from '../../../types/live'
import type { RoutesFile } from '../../../types/routes'
import { FlowCanvas } from '../canvas/FlowCanvas'
import type { Stream } from '../canvas/FlowCanvas'
import { useLeafletLayer } from '../canvas/useLeafletLayer'
import { reversePath, routeById, slicePath } from '../../../lib/routes'
import { activeAdvisories, trafficTier } from '../../../lib/live'
import { useLang } from '../../../lib/i18n'
import { escapeHtml } from '../../../lib/live'

const GOOD = '#0ca30c'
const CRIT = '#d03b3b'

/**
 * Traffic flow: road segments coloured by congestion (free / slow / jammed) with
 * small moving vehicles (slower and denser where jammed). While an advisory is
 * active the congested corridor turns faded red dashed and the recommended
 * alternate is drawn in green, as in the original demo.
 */
export function TrafficLayer({ live, routes, t, paused }: { live: LiveData; routes: RoutesFile; t: number; paused: boolean }) {
  const { t: tr } = useLang()
  const canvas = useLeafletLayer(() => new FlowCanvas())
  const adv = activeAdvisories(live, t)
  const corridor = new Set(adv.map((a) => a.corridor))
  const alternates = new Set(adv.map((a) => a.alternate))

  useEffect(() => {
    canvas.setPaused(paused)
  }, [canvas, paused])

  useEffect(() => {
    const advNow = activeAdvisories(live, t)
    const alts = new Set(advNow.map((a) => a.alternate))
    const streams: Stream[] = []
    for (const [rid, tr] of Object.entries(live.traffic)) {
      const r = routeById(routes, rid)
      if (!r) continue
      if (r.kind === 'alternate' && !alts.has(rid)) continue
      const vph = tr.vehicles_per_hour[t] ?? 0
      tr.segments.forEach(([a, b], i) => {
        const c = tr.congestion[i]?.[t] ?? 0
        const base = {
          colour: '#f2f5fb',
          kind: 'vehicle' as const,
          density: 0.5 + (vph / 260) * (0.6 + 1.6 * c),
          speed: 8 + 46 * (1 - c) ** 1.4,
          lane: 2.6,
          size: 2,
        }
        streams.push({ ...base, key: `${rid}:${i}:f`, path: r.path, from: a, to: b })
        streams.push({ ...base, key: `${rid}:${i}:r`, path: reversePath(r.path), from: 1 - b, to: 1 - a })
      })
    }
    canvas.setStreams(streams)
  }, [canvas, live, routes, t])

  const altLabelIcon = useMemo(
    () =>
      L.divIcon({
        className: 'map-divicon',
        html: `<div class="route-flag good">${escapeHtml(tr('Recommended alternate', '推奨迂回路'))}</div>`,
        iconSize: [0, 0],
      }),
    [tr],
  )

  return (
    <>
      {Object.entries(live.traffic).map(([rid, traffic]) => {
        const r = routeById(routes, rid)
        if (!r) return null
        const isAlt = r.kind === 'alternate'
        if (isAlt && !alternates.has(rid)) return null
        if (isAlt || corridor.has(rid)) {
          const worst = Math.max(...traffic.congestion.map((s) => s[t] ?? 0))
          return (
            <Polyline
              key={rid + (isAlt ? ':alt' : ':avoid')}
              positions={r.path}
              pathOptions={
                isAlt
                  ? { color: GOOD, weight: 5, opacity: 0.95, lineCap: 'round' }
                  : { color: CRIT, weight: 4, opacity: 0.5, dashArray: '3 9', lineCap: 'round' }
              }
            >
              <Tooltip sticky className="map-tip">
                <strong>{tr(r.label, r.label_ja)}</strong>
                <div className="tip-row">
                  {isAlt
                    ? tr('Recommended while the coastal road is jammed', '沿岸道路の渋滞中の推奨ルート')
                    : `${tr('Congested corridor', '渋滞区間')} · ${tr(trafficTier(worst).label, trafficTier(worst).label_ja)} ${Math.round(worst * 100)}%`}
                </div>
                <div className="tip-sub">
                  {r.distance_km} km · {r.duration_min} min
                </div>
              </Tooltip>
            </Polyline>
          )
        }
        return traffic.segments.map(([a, b], i) => {
          const c = traffic.congestion[i]?.[t] ?? 0
          const tier = trafficTier(c)
          const pos = slicePath(r.path, a, b)
          return (
            <Polyline key={`${rid}:${i}`} positions={pos} pathOptions={{ color: tier.colour, weight: 4.5, opacity: 0.9, lineCap: 'butt' }}>
              <Tooltip sticky className="map-tip wide">
                <strong>{tr(r.label, r.label_ja)}</strong>
                <div className="tip-row">
                  <span className="sw" style={{ background: tier.colour }}></span>
                  {tr(tier.label, tier.label_ja)} · {tr('congestion', '混雑度')} <b className="num">{Math.round(c * 100)}%</b>
                </div>
                <div className="tip-sub">
                  {tr('Segment', '区間')} {i + 1}/{traffic.segments.length} · ~{(traffic.vehicles_per_hour[t] ?? 0).toLocaleString('en-US')} {tr('vehicles/h on the corridor', '台/時')}
                </div>
                {traffic.real_days?.[Math.floor(t / 24)] ? (
                  <div className="tip-row">
                    <span className="tt-real">{tr('Real', '実データ')}</span>
                    {tr('Counter', '計測器')} ({traffic.counter_node}): <b className="num">{(traffic.real_volume?.[Math.floor(t / 24)] ?? 0).toLocaleString('en-US')}</b> {tr('vehicles that day; hourly split simulated', '台/日（時間配分は模擬）')}
                  </div>
                ) : (
                  <div className="tip-row">
                    <span className="tt-demo">{tr('Demo', 'デモ')}</span>
                    {traffic.counter_node ? tr('No counter reading for this day', 'この日の計測値なし') : tr('No traffic counter on this road', 'この道路に計測器なし')}
                  </div>
                )}
              </Tooltip>
            </Polyline>
          )
        })
      })}
      {adv.map((a) => {
        const alt = routeById(routes, a.alternate)
        if (!alt) return null
        const mid = alt.path[Math.floor(alt.path.length * 0.45)]
        return <Marker key={a.id} position={mid} icon={altLabelIcon} interactive={false} />
      })}
    </>
  )
}
