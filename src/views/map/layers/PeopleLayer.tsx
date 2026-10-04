import { Fragment, useMemo } from 'react'
import { CircleMarker, Marker, Pane, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { NodeFrame } from '../../../lib/live'
import type { MapNode } from '../../../lib/nodes'
import { isEstimatedMeasure } from '../../../lib/nodes'
import { escapeHtml, peopleRadius } from '../../../lib/live'
import { useLang } from '../../../lib/i18n'
import type { RealNodeMeta } from '../../../types/live'
import { measureLabel } from '../../../lib/real'
import { lastSignal } from './cardRows'

const ACCENT = '#8b9dff'

interface Props {
  nodes: MapNode[]
  frame: Record<string, NodeFrame> | null
  selectedId?: string
  onSelect: (id: string | undefined) => void
  kanazawa?: { lat: number; lon: number }
  meta?: Record<string, RealNodeMeta>
  day?: number
}

const CONF: Record<string, [string, string]> = { high: ['high', '高'], medium: ['medium', '中'], low: ['low', '低'], none: ['none', 'なし'] }

/**
 * People: circle area = people on site. Solid fill = observed count; dashed ring =
 * forecast; forecast-only hours (future) have a hollow, faint fill. Colour is the
 * crowding tier (status scale, always with a text label). Estimated measures
 * (footfall proxy, bookings, vehicle counts) get a dashed outline and "est." tag.
 * The site's name and count are on its card (SiteCards.tsx).
 */
export function PeopleLayer({ nodes, frame, selectedId, onSelect, kanazawa, meta, day = 0 }: Props) {
  const { t } = useLang()

  const kzIcon = useMemo(
    () =>
      L.divIcon({
        className: 'map-divicon',
        html: `<div class="node-tag dir-top ext" style="--r:14px"><span class="nt-name">${escapeHtml(t('Kanazawa', '金沢'))}</span><span class="nt-count none">${escapeHtml(t('inflow', '流入元'))}</span></div>`,
        iconSize: [0, 0],
      }),
    [t],
  )

  return (
    <Pane name="dhde-nodes" style={{ zIndex: 500 }}>
      {kanazawa && (
        <>
          <CircleMarker
            center={[kanazawa.lat, kanazawa.lon]}
            radius={8}
            pathOptions={{ color: '#c9d4ff', weight: 2, dashArray: '3 3', fillColor: '#0a1120', fillOpacity: 0.6 }}
          >
            <Tooltip className="map-tip" direction="top" offset={[0, -8]}>
              <strong>{t('Kanazawa (Ishikawa)', '金沢（石川県）')}</strong>
              <div className="tip-sub">
                {t('Inflow by Hokuriku Shinkansen and car to Awara Onsen and Fukui Station. Same-day correlation with Tojinbo arrivals r = 0.549.', '北陸新幹線と車であわら温泉・福井駅へ流入。東尋坊の来訪者数と同日相関 r = 0.549。')}
              </div>
            </Tooltip>
          </CircleMarker>
          <Marker position={[kanazawa.lat, kanazawa.lon]} icon={kzIcon} interactive={false} />
        </>
      )}

      {nodes.map((n) => {
        const f = frame?.[n.id]
        const selected = n.id === selectedId
        const click = { click: () => onSelect(selected ? undefined : n.id) }
        if (!f) {
          return (
            <CircleMarker
              key={n.id}
              center={[n.lat, n.lon]}
              radius={5}
              pathOptions={{ color: selected ? ACCENT : '#9aa6bd', weight: 1.5, dashArray: '2 3', fillColor: '#0a1120', fillOpacity: 0.7 }}
              eventHandlers={click}
            >
              <Tooltip className="map-tip" direction="top" offset={[0, -6]}>
                <strong>{t(n.name, n.name_ja)}</strong>
                <div className="tip-sub">{t('Not measured yet', '未計測')}</div>
              </Tooltip>
            </CircleMarker>
          )
        }
        if (f.noEstimate) {
          const sig = lastSignal(meta?.[n.id], day)
          return (
            <CircleMarker
              key={n.id}
              center={[n.lat, n.lon]}
              radius={9}
              eventHandlers={click}
              pathOptions={{ color: selected ? ACCENT : '#c9d4ff', weight: 2, dashArray: '2 3', fillColor: '#0a1120', fillOpacity: 0.65 }}
            >
              <Tooltip className="map-tip wide" direction="top" offset={[0, -10]}>
                <div className="tt-head">
                  <span>{t(n.name, n.name_ja)}</span>
                  <span className="tt-real">{t('Real signal', '実シグナル')}</span>
                </div>
                <div className="tt-hero">
                  <b className="num">{sig ? Math.round(sig.v).toLocaleString('en-US') : '—'}</b>
                  <span>{t('camera detections in the day (not unique visitors)', '1日のカメラ検知数（延べ、来訪者数ではない）')}</span>
                </div>
                <div className="tip-sub">
                  {t('No visitor estimate: there is no official annual count for this site to calibrate against.', '来訪者推計なし：換算に使う公式年間値がありません。')}
                  {sig && meta?.[n.id] ? ` ${t('Latest', '最新')}: ${meta[n.id].visitors_as_of ?? ''}` : ''}
                </div>
              </Tooltip>
            </CircleMarker>
          )
        }
        const m = meta?.[n.id]
        const realV = f.realDay?.visitors ?? null
        const est = isEstimatedMeasure(n.measure) || n.measure === 'vehicles'
        const rNow = peopleRadius(f.onSite)
        const rPred = peopleRadius(f.predicted)
        const col = f.tier.colour
        return (
          <Fragment key={n.id}>
            {selected && (
              <CircleMarker
                center={[n.lat, n.lon]}
                radius={Math.max(rNow, rPred) + 7}
                interactive={false}
                pathOptions={{ color: ACCENT, weight: 2.5, fillOpacity: 0, opacity: 0.95 }}
              />
            )}
            {/* forecast: dashed ring */}
            <CircleMarker
              center={[n.lat, n.lon]}
              radius={rPred}
              interactive={false}
              pathOptions={{ color: '#ffffff', weight: 1.8, dashArray: '3 4', fillOpacity: 0, opacity: 0.9 }}
            />
            {/* actual (or forecast-only) body */}
            <CircleMarker
              center={[n.lat, n.lon]}
              radius={rNow}
              eventHandlers={click}
              pathOptions={{
                color: est ? col : '#0a1120',
                weight: est ? 2.2 : 1.5,
                dashArray: est ? '4 3' : undefined,
                fillColor: col,
                fillOpacity: f.observed ? (est ? 0.55 : 0.88) : 0.22,
              }}
            >
              <Tooltip className="map-tip wide" direction="top" offset={[0, -rNow]}>
                <div className="tt-head">
                  <span>{t(n.name, n.name_ja)}</span>
                  {realV !== null ? <span className="tt-real">{t('Real day total', '実日合計')}</span> : m ? <span className="tt-demo">{t('Forecast', '予測')}</span> : <span className="tt-demo">{t('Demo', 'デモ')}</span>}
                </div>
                {realV !== null && (
                  <div className="tt-hero">
                    <b className="num">{Math.round(realV).toLocaleString('en-US')}</b>
                    <span>{t('visitors this day (modelled)', 'この日の来訪者数（推計）')}</span>
                  </div>
                )}
                <div className="tt-hero">
                  <b className="num">{Math.round(f.onSite).toLocaleString('en-US')}</b>
                  <span>{f.observed ? t('people on site now', '現在の人数') : t('people on site (forecast)', '予測人数')}</span>
                </div>
                <div className="tt-grid">
                  <span className="tt-k">{t('Crowding', '混雑')}</span>
                  <span className="tt-v">
                    <span className="sw" style={{ background: col }}></span>
                    {t(f.tier.label, f.tier.label_ja)} · {Math.round(f.load * 100)}%
                  </span>
                  <span className="tt-k">{t('Forecast', '予測')}</span>
                  <span className="tt-v num">
                    {Math.round(f.predicted).toLocaleString('en-US')}
                    {f.lo !== null && f.hi !== null ? ` (${f.lo.toLocaleString('en-US')}–${f.hi.toLocaleString('en-US')})` : ''}
                  </span>
                  <span className="tt-k">{t('Arriving this hour', 'この1時間の到着')}</span>
                  <span className="tt-v num">{Math.round(f.arrivals).toLocaleString('en-US')}</span>
                </div>
                {m ? (
                  <div className="tip-sub">
                    {m.method_text ? t(`Method: ${m.method_text}`, `方法：${m.method_text_ja ?? m.method_text}`) : `${t(`Method: ${measureLabel(m.measure)} scaled to the 2025 official annual count`, `方法：${measureLabel(m.measure)}を2025年公式年間値に換算`)} (${m.official_2025?.toLocaleString('en-US') ?? '—'})`} · {t('confidence', '信頼度')} {t(CONF[m.confidence][0], CONF[m.confidence][1])}. {t('Hourly shape simulated.', '時間別の形は模擬。')}
                  </div>
                ) : (
                  est && <div className="tip-sub">{t('Estimated measure (proxy / bookings / vehicles)', '推定値（代理指標・予約・車両）')}</div>
                )}
              </Tooltip>
            </CircleMarker>
          </Fragment>
        )
      })}

    </Pane>
  )
}
