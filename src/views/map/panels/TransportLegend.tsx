import type { TransportTrendsFile } from '../../../types/transport'
import { useJsonResource } from '../../../hooks/useJsonResource'
import { useLang } from '../../../lib/i18n'
import { sparkPath } from '../../../lib/market'
import { MODE_COLOUR } from '../../../lib/transport'

const TERM_JA: Record<string, string> = {
  'Echizen Railway': 'えちぜん鉄道',
  'Keifuku Bus': '京福バス',
  'Hokuriku Shinkansen Fukui': '北陸新幹線 福井',
  'Car rental Fukui': 'レンタカー 福井',
  'Bike rental Fukui': 'レンタサイクル 福井',
}
const TREND_COLOUR: Record<string, string> = { ...MODE_COLOUR, bike: '#c39bff' }

/** Legend for the Transport layer, plus Google Trends interest in transport terms (Illustrative). */
export function TransportLegend() {
  const { t } = useLang()
  const trends = useJsonResource<TransportTrendsFile>('transport_trends.json').data
  return (
    <>
      <div className="lg-row">
        <span className="lg-line" style={{ borderColor: MODE_COLOUR.bus }}></span>
        {t('Bus routes serving the six sites', '6地点に停まる路線バス')}
      </div>
      <div className="lg-row">
        <span className="lg-dot" style={{ background: '#e9eef8', width: 7, height: 7 }}></span>
        {t('Stops within walking distance of a site', '各地点の徒歩圏の停留所・駅')}
      </div>
      <div className="lg-row">
        <span className="lg-dot" style={{ background: 'rgba(111,220,147,.35)', border: '1px solid #6fdc93' }}></span>
        {t('15-minute walk (dashed: 30 minutes)', '徒歩15分圏（破線：30分）')}
      </div>
      <p className="lg-note">
        {t(
          'Scheduled bus timetables (GTFS-JP), not live. Rail is not shown: Echizen Railway and Fukui Railway have no open timetable. Walking areas: OpenStreetMap via Valhalla. Select a site for journey times and the last service back.',
          'バスの時刻表（GTFS-JP）に基づく予定で、リアルタイムではない。えちぜん鉄道・福井鉄道はオープンな時刻表がないため非表示。徒歩圏：OpenStreetMap（Valhalla）。地点を選ぶと所要時間と最終便を表示。',
        )}
      </p>
      {trends && trends.terms.length > 0 && (
        <>
          <div className="lg-row" style={{ marginTop: 6 }}>
            <strong>{t('Search interest, last 12 months', '検索関心（直近12か月）')}</strong>
            <span className="tt-demo" style={{ padding: '0 6px', marginLeft: 6 }}>{t('Illustrative', '参考')}</span>
          </div>
          <div className="trend-rows">
            {trends.terms.map((x) => (
              <div key={x.term} className="trend-row" title={x.term}>
                <span>{t(x.label, TERM_JA[x.label] ?? x.term)}</span>
                <svg viewBox="0 0 90 18" preserveAspectRatio="none" aria-hidden="true">
                  <path d={sparkPath(x.values, 90, 18)} stroke={TREND_COLOUR[x.mode] ?? '#c9d4ff'} />
                </svg>
                <span className="num">{x.values[x.values.length - 1]}</span>
              </div>
            ))}
          </div>
          <p className="lg-note">
            {t(
              'Google Trends, Japan, weekly. 0-100 relative to the busiest week of any term here: an interest index, not traveller numbers.',
              'Googleトレンド（日本・週次）。ここの語の中で最も多い週を100とした相対値で、利用者数ではない。',
            )}
          </p>
        </>
      )}
    </>
  )
}
