import type { TransportTrendsFile } from '../../../types/transport'
import { useJsonResource } from '../../../hooks/useJsonResource'
import { useLang } from '../../../lib/i18n'
import { sparkPath } from '../../../lib/market'
import { MODE_COLOUR, RAIL_LINE_COLOUR } from '../../../lib/transport'

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
        <span className="lg-dot" style={{ background: '#ffffff', border: '1.5px solid #0a1120', width: 10, height: 10 }}></span>
        {t('Bus stops', 'バス停')}
      </div>
      <div className="lg-row">
        <span className="lg-dot" style={{ background: 'rgba(111,220,147,.35)', border: '1px solid #6fdc93' }}></span>
        {t('15-minute walk (dashed: 30 minutes)', '徒歩15分圏（破線：30分）')}
      </div>
      <p className="lg-note">
        {t(
          'Bus routes serving the six sites, from the bus timetables (GTFS-JP), not live. Walking areas: OpenStreetMap via Valhalla. Select a site for journey times and the last bus back.',
          '6地点を結ぶバス路線（時刻表GTFS-JPに基づく予定で、リアルタイムではない）。徒歩圏：OpenStreetMap（Valhalla）。地点を選ぶと所要時間と最終バスを表示。',
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

export function RailLegend() {
  const { t } = useLang()
  return (
    <>
      <div className="lg-row">
        <span className="lg-line" style={{ borderColor: RAIL_LINE_COLOUR, borderTopWidth: 4 }}></span>
        {t('Hokuriku Shinkansen', '北陸新幹線')}
      </div>
      <div className="lg-row">
        <span className="lg-line" style={{ borderColor: RAIL_LINE_COLOUR }}></span>
        {t('Other railway lines', 'その他の鉄道路線')}
      </div>
      <div className="lg-row">
        <span className="lg-line" style={{ borderColor: RAIL_LINE_COLOUR, borderTopStyle: 'dashed' }}></span>
        {t('Fukui Railway (tram)', '福井鉄道（路面電車）')}
      </div>
      <div className="lg-row">
        <span className="lg-dot" style={{ background: '#ffffff', border: `2px solid ${RAIL_LINE_COLOUR}`, width: 10, height: 10 }}></span>
        {t('Stations', '駅')}
      </div>
      <p className="lg-note">
        {t(
          'MLIT railway data (国土数値情報, CC BY 4.0): routes and stations only. Rail timetables are not open data, so journey times on this map are by bus.',
          '国土数値情報（鉄道データ、CC BY 4.0）：路線と駅のみ。鉄道の時刻表はオープンデータでないため、所要時間はバスで計算。',
        )}
      </p>
    </>
  )
}
