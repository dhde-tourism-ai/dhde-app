import { Fragment, useMemo } from 'react'
import { CircleMarker, Marker, Pane, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { NodeFrame } from '../../../lib/live'
import type { MapNode } from '../../../lib/nodes'
import { isEstimatedMeasure } from '../../../lib/nodes'
import { escapeHtml, peopleRadius } from '../../../lib/live'
import { useLang } from '../../../lib/i18n'

const ACCENT = '#8b9dff'

interface Props {
  nodes: MapNode[]
  frame: Record<string, NodeFrame> | null
  selectedId?: string
  onSelect: (id: string | undefined) => void
  showCounts: boolean
  kanazawa?: { lat: number; lon: number }
}

/**
 * People: circle area = people on site. Solid fill = observed count; dashed ring =
 * forecast; forecast-only hours (future) have a hollow, faint fill. Colour is the
 * crowding tier (status scale, always with a text label). Estimated measures
 * (footfall proxy, bookings, vehicle counts) get a dashed outline and "est." tag.
 */
export function PeopleLayer({ nodes, frame, selectedId, onSelect, showCounts, kanazawa }: Props) {
  const { t, lang } = useLang()

  const labelIcons = useMemo(() => {
    const out: Record<string, L.DivIcon> = {}
    for (const n of nodes) {
      const f = frame?.[n.id]
      const est = f ? isEstimatedMeasure(n.measure) || n.measure === 'vehicles' : false
      const dir = n.label_dir ?? 'right'
      const r = f ? peopleRadius(Math.max(f.onSite, f.predicted)) : 6
      const name = escapeHtml(lang === 'ja' ? n.name_ja : n.name.replace(' East Entrance', ''))
      const count = f
        ? `<span class="nt-count${f.observed ? '' : ' fc'}">${f.observed ? '' : '~'}${Math.round(f.onSite).toLocaleString()}</span>`
        : `<span class="nt-count none">${escapeHtml(t('no data yet', 'データなし'))}</span>`
      const tier = f ? `<span class="nt-dot" style="background:${f.tier.colour}"></span>` : ''
      const estTag = est ? `<span class="nt-est">${escapeHtml(t('est.', '推定'))}</span>` : ''
      out[n.id] = L.divIcon({
        className: 'map-divicon',
        html: `<div class="node-tag dir-${dir}${n.id === selectedId ? ' sel' : ''}${f ? '' : ' muted-tag'}" style="--r:${r + 5}px">${tier}<span class="nt-name">${name}</span>${showCounts ? count : ''}${estTag}</div>`,
        iconSize: [0, 0],
      })
    }
    return out
  }, [nodes, frame, selectedId, showCounts, lang, t])

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
                  <span className="tt-demo">{t('Demo', 'デモ')}</span>
                </div>
                <div className="tt-hero">
                  <b className="num">{Math.round(f.onSite).toLocaleString()}</b>
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
                    {Math.round(f.predicted).toLocaleString()}
                    {f.lo !== null && f.hi !== null ? ` (${f.lo.toLocaleString()}–${f.hi.toLocaleString()})` : ''}
                  </span>
                  <span className="tt-k">{t('Arriving this hour', 'この1時間の到着')}</span>
                  <span className="tt-v num">{Math.round(f.arrivals).toLocaleString()}</span>
                </div>
                {est && <div className="tip-sub">{t('Estimated measure (proxy / bookings / vehicles)', '推定値（代理指標・予約・車両）')}</div>}
              </Tooltip>
            </CircleMarker>
          </Fragment>
        )
      })}

      {nodes.filter((n) => frame?.[n.id]).map((n) => (
        <Marker
          key={`lbl-${n.id}`}
          position={[n.lat, n.lon]}
          icon={labelIcons[n.id]}
          eventHandlers={{ click: () => onSelect(n.id === selectedId ? undefined : n.id) }}
          keyboard={false}
          zIndexOffset={frame?.[n.id] ? 100 : 0}
        />
      ))}
    </Pane>
  )
}
