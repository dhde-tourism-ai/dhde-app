import { useMemo } from 'react'
import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { NodeFrame } from '../../../lib/live'
import { CONDITION_LABEL, escapeHtml } from '../../../lib/live'
import type { MapNode } from '../../../lib/nodes'
import { iconSvg, weatherSvg } from '../../../lib/icons'
import { useLang } from '../../../lib/i18n'
import { PrecipLayer } from './FieldLayers'

/**
 * Weather: a compact chip per node (JMA-style pictogram, temperature, chance of
 * rain, wind) with an advisory badge, plus an optional precipitation tint.
 */
export function WeatherLayer({ nodes, frame, showPrecip }: { nodes: MapNode[]; frame: Record<string, NodeFrame>; showPrecip: boolean }) {
  const { t, lang } = useLang()
  const live = nodes.filter((n) => frame[n.id])

  const icons = useMemo(() => {
    const out: Record<string, L.DivIcon> = {}
    for (const n of live) {
      const w = frame[n.id].weather
      const alerts = frame[n.id].alerts
      const side = n.label_dir === 'left' ? 'left' : n.label_dir === 'right' ? 'right' : 'center'
      const badge = alerts.length
        ? `<span class="wx-alert" title="${escapeHtml(alerts.map((a) => (lang === 'ja' ? a.title_ja : a.title_en)).join(', '))}">${iconSvg('alert', 11)}${alerts.length}</span>`
        : ''
      out[n.id] = L.divIcon({
        className: 'map-divicon',
        html: `<div class="wx-chip side-${side}${alerts.length ? ' has-alert' : ''}">
          <span class="wx-ic">${weatherSvg(w.cond, 22)}</span>
          <span class="wx-main"><b class="wx-t">${Math.round(w.temp)}°</b>${badge}</span>
          <span class="wx-sub">${iconSvg('umbrella', 10)}${w.pop}% · ${iconSvg('wind', 10)}${Math.round(w.wind)} m/s</span>
        </div>`,
        iconSize: [0, 0],
      })
    }
    return out
  }, [live, frame, lang])

  return (
    <>
      {showPrecip && <PrecipLayer nodes={nodes} frame={frame} />}
      {live.map((n) => {
        const f = frame[n.id]
        const w = f.weather
        return (
          <Marker key={n.id} position={[n.lat, n.lon]} icon={icons[n.id]} keyboard={false}>
            <Tooltip className="map-tip" direction="top" offset={[0, -40]}>
              <strong>
                {t(n.name, n.name_ja)} · {t(CONDITION_LABEL[w.cond].en, CONDITION_LABEL[w.cond].ja)}
              </strong>
              <div className="tip-row">
                {w.temp.toFixed(1)}°C · {t('rain', '降水確率')} {w.pop}% · {w.mm} mm/h · {t('wind', '風')} {w.wind} m/s
              </div>
              {f.alerts.map((a) => (
                <div key={a.id} className="tip-row tip-alert">
                  ⚠ {t(a.title_en, a.title_ja)}
                </div>
              ))}
              <div className="tip-sub">
                {t('JMA point', '気象庁観測点')}: {t(w.station, w.station_ja)}
              </div>
            </Tooltip>
          </Marker>
        )
      })}
    </>
  )
}
