import type { NodeFrame } from '../../../lib/live'
import { CONDITION_LABEL } from '../../../lib/live'
import type { MapNode } from '../../../lib/nodes'
import { useLang } from '../../../lib/i18n'
import { PrecipLayer } from './FieldLayers'

/**
 * Weather. Each site's weather is a row on its card (SiteCards.tsx: weatherRow in
 * cardRows.ts, WeatherDetail below); this layer only adds the optional precipitation tint.
 */
export function WeatherLayer({ nodes, frame, showPrecip }: { nodes: MapNode[]; frame: Record<string, NodeFrame>; showPrecip: boolean }) {
  return showPrecip ? <PrecipLayer nodes={nodes} frame={frame} /> : null
}

export function WeatherDetail({ n, f }: { n: MapNode; f: NodeFrame }) {
  const { t } = useLang()
  const w = f.weather
  return (
    <>
      <div className="tt-sec">
        {t('Weather', '気象')} · {t(CONDITION_LABEL[w.cond].en, CONDITION_LABEL[w.cond].ja)}
      </div>
      {w.hourly && (
        <>
          <div className="tip-row">
            {t('This hour', 'この時間')}: {w.temp.toFixed(1)}°C · {w.mm} mm/h · {t('wind', '風')} {w.wind} m/s{' '}
            <span className="tt-real">{w.hourly === 'observed' ? t('Observed', '観測') : t('Forecast', '予報')}</span>
          </div>
          <div className="tip-sub">
            {w.hourly === 'observed'
              ? t('JMA observation (past days).', '気象庁の観測値（過去の日）。')
              : t('JMA model forecast via Open-Meteo (CC BY 4.0), refreshed every 30 min.', '気象庁モデルの予報（Open-Meteo、CC BY 4.0）、30分ごとに更新。')}
          </div>
        </>
      )}
      {f.wxDay.real ? (
        <>
          <div className="tt-grid">
            <span className="tt-k">{t('Day mean temperature', '日平均気温')}</span>
            <span className="tt-v num">{f.wxDay.temp !== null ? `${f.wxDay.temp.toFixed(1)}°C` : '—'}</span>
            <span className="tt-k">{t('Rain (day total)', '降水量（日合計）')}</span>
            <span className="tt-v num">{f.wxDay.precip !== null ? `${f.wxDay.precip.toFixed(1)} mm` : '—'}</span>
            <span className="tt-k">{t('Wind (mean)', '風速（平均）')}</span>
            <span className="tt-v num">{f.wxDay.wind !== null ? `${f.wxDay.wind.toFixed(1)} m/s` : '—'}</span>
            <span className="tt-k">{t('Sunshine (hourly mean)', '日照（時間平均）')}</span>
            <span className="tt-v num">{f.wxDay.sun !== null ? `${f.wxDay.sun.toFixed(2)} h` : '—'}</span>
            <span className="tt-k">{t('Humidity', '湿度')}</span>
            <span className="tt-v num">{f.wxDay.humidity !== null ? `${Math.round(f.wxDay.humidity)}%` : '—'}</span>
            <span className="tt-k">{t('Snow depth', '積雪')}</span>
            <span className="tt-v num">{f.wxDay.snow !== null ? `${f.wxDay.snow} cm` : t('none reported', 'なし')}</span>
          </div>
          {!w.hourly && <div className="tip-sub">{t('Real daily values (JMA). The hourly curve and this hour’s figures are synthesised from them.', '日別は実データ（気象庁）。時間別は日別値から合成。')}</div>}
        </>
      ) : w.hourly ? null : (
        <div className="tip-row">
          {w.temp.toFixed(1)}°C · {t('rain', '降水確率')} {w.pop}% · {w.mm} mm/h · {t('wind', '風')} {w.wind} m/s <span className="tt-demo">{t('Demo', 'デモ')}</span>
        </div>
      )}
      {f.alerts.map((a) => (
        <div key={a.id} className="tip-row tip-alert">
          ⚠ {t(a.title_en, a.title_ja)} {a.demo && <span className="tt-demo">{t('Demo', 'デモ')}</span>}
        </div>
      ))}
      <div className="tip-sub">
        {t('JMA point', '気象庁観測点')}: {t(w.station, w.station_ja)} · {t(n.name, n.name_ja)}
      </div>
    </>
  )
}
