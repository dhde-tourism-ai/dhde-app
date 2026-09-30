import { useState } from 'react'
import { Circle, CircleMarker, Polyline, Tooltip, useMapEvents } from 'react-leaflet'
import type { EconomicsFigures, Metric, RegionalEconomics } from '../../../types/economics'
import { fmtMetric } from '../../../lib/format'
import { fmtLost, resolvePoint, sameNode } from '../../../lib/economics'
import type { MapNode } from '../../../lib/nodes'
import { StatusPill } from '../../../components/StatusPill'
import { KddiPending } from '../../../components/KddiPending'
import { useLang } from '../../../lib/i18n'
import { Tip } from './Tip'

const STATUS_STROKE: Record<Metric['status'], string> = {
  real: '#3dbb6e',
  modelled: '#5b9cf0',
  illustrative: '#e0a33a',
  pending: '#8a94a6',
}

function MetricKV({ label, m, kind }: { label: string; m: Metric; kind?: 'yen' | 'count' }) {
  return (
    <>
      <span className="tt-k">{label}</span>
      <span className="tt-v">
        <b className="num">{fmtMetric(m, kind)}</b>
        <StatusPill status={m.status} />
      </span>
    </>
  )
}

function FiguresTooltip({ title, titleJa, f, note }: { title: string; titleJa: string; f: EconomicsFigures; note?: string }) {
  const { t } = useLang()
  const o = f.opportunity_lost_yen
  return (
    <div className="econ-tip">
      <div className="tt-head">
        <span>
          {title} <span className="ja-sub">{titleJa}</span>
        </span>
      </div>
      <div className="tt-hero">
        <b className="num">{fmtMetric(f.revenue_yen, 'yen')}</b>
        <span>{t('tourism revenue', '観光収入')}</span>
      </div>
      <div className="tt-grid">
        <MetricKV label={t('Visitors', '来訪者')} m={f.visitors} />
        <MetricKV label={t('Revenue', '観光収入')} m={f.revenue_yen} kind="yen" />
        <span className="tt-k">{t('Opportunity lost', '機会損失')}</span>
        <span className="tt-v">
          <b className="num">{fmtLost(f)}</b>
        </span>
        <MetricKV label={t('· overnight gap', '・宿泊ギャップ')} m={o.overnight_gap} kind="yen" />
        <MetricKV label={t('· weather', '・天候')} m={o.weather} kind="yen" />
        <MetricKV label={t('· idle rooms', '・空室')} m={o.idle_rooms} kind="yen" />
      </div>
      {note && <div className="tip-sub">{note}</div>}
    </div>
  )
}

/**
 * Economics overlay: municipality circles sized by revenue, node annotations
 * and dashed visitor-flow lines. Null values are drawn as grey dashed shapes
 * and labelled "[pending]"; nothing is sized from a missing number.
 */
export function EconomicsLayer({ economics, nodes, selectedId }: { economics: RegionalEconomics; nodes: MapNode[]; selectedId?: string }) {
  const { t } = useLang()
  // Annotations are permanent when zoomed in (or for the selected node); at
  // prefecture zoom the close northern nodes would overlap, so they show on hover.
  const [zoom, setZoom] = useState<number | null>(null)
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const zoomedIn = (zoom ?? map.getZoom()) >= 11
  const maxRevenue = Math.max(1, ...economics.regions.map((r) => r.revenue_yen.value ?? 0))
  const maxFlow = Math.max(1, ...economics.flows.map((f) => f.visitors.value ?? 0))

  return (
    <>
      {economics.regions.map((r) => {
        const v = r.revenue_yen.value
        const radius = v === null ? 2500 : 2500 + 9000 * Math.sqrt(v / maxRevenue)
        return (
          <Circle
            key={`region-${r.id}`}
            center={r.centroid}
            radius={radius}
            pathOptions={{
              color: STATUS_STROKE[r.revenue_yen.status],
              weight: 1.5,
              dashArray: r.revenue_yen.status === 'real' ? undefined : '5,4',
              fillColor: v === null ? '#8a94a6' : '#e0a33a',
              fillOpacity: v === null ? 0.08 : 0.16,
            }}
          >
            <Tip sticky>
              <FiguresTooltip title={r.name} titleJa={r.name_ja} f={r} note={economics.visitor_window?.regions ? `Visitors: JTA, ${economics.visitor_window.regions}` : undefined} />
            </Tip>
          </Circle>
        )
      })}

      {economics.flows.map((f, i) => {
        const a = resolvePoint(economics, nodes, f.from, f.from_coord)
        const b = resolvePoint(economics, nodes, f.to, f.to_coord)
        if (!a || !b) return null
        const v = f.visitors.value
        return (
          <Polyline
            key={`flow-${i}`}
            positions={[a.latlng, b.latlng]}
            pathOptions={{
              color: v === null ? '#8a94a6' : '#c9d4ff',
              weight: v === null ? 1.5 : 1.5 + 4 * Math.sqrt(v / maxFlow),
              dashArray: '6,8',
              opacity: 0.8,
            }}
          >
            <Tip sticky>
              <div className="tt-head">
                <span>
                  {a.name} → {b.name}
                </span>
                <StatusPill status={f.status} />
              </div>
              {v === null ? (
                <div className="tt-hero">
                  <KddiPending />
                  <span>{t('Measured journeys from KDDI location data will replace this line.', 'KDDI位置情報による実測の移動がこの線に置き換わります。')}</span>
                </div>
              ) : (
                <div className="tt-hero">
                  <b className="num">{fmtMetric(f.visitors)}</b>
                  <span>{t('visitors on this flow', 'この経路の来訪者')}</span>
                </div>
              )}
              <div className="tip-sub">{f.note}</div>
            </Tip>
          </Polyline>
        )
      })}

      {economics.nodes
        .filter((n) => n.priority !== false)
        .map((n) => {
          const reg = nodes.find((r) => sameNode(r, n))
          const permanent = zoomedIn || (reg !== undefined && reg.id === selectedId)
          return (
            <CircleMarker
              key={`econ-node-${n.id}-${permanent ? 'p' : 'h'}`}
              center={reg ? [reg.lat, reg.lon] : [n.lat, n.lon]}
              radius={14}
              pathOptions={{ stroke: false, fillOpacity: 0 }}
            >
              {permanent ? (
                <Tooltip permanent direction="bottom" offset={[0, 12]} className="econ-note map-tip">
                  {n.name}: {fmtMetric(n.visitors)} visitors · {fmtMetric(n.revenue_yen, 'yen')} · lost {fmtLost(n)}
                </Tooltip>
              ) : (
                <Tip>
                  <FiguresTooltip title={n.name} titleJa={n.name_ja} f={n} note={n.annotation} />
                </Tip>
              )}
            </CircleMarker>
          )
        })}
    </>
  )
}
