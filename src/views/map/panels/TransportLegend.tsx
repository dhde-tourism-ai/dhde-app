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
        <span className="lg-dot" style={{ background: MODE_COLOUR.bus, border: '1.5px solid #ffffff', width: 10, height: 10 }}></span>
        {t('Buses, where the timetable puts them', 'バス（時刻表上の位置）')}
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
          'Bus timetables (GTFS-JP): scheduled positions, not GPS. At Now (Live) buses run on the real clock; at any other hour, or with Play, they preview that hour a minute a second. Hover a stop for its next buses. Walking areas: OpenStreetMap via Valhalla.',
          'バス時刻表（GTFS-JP）上の位置で、GPSではない。「現在」（ライブ）では実時刻で、他の時間や再生中はその1時間を1秒1分でプレビュー。停留所にカーソルを合わせると次のバスを表示。徒歩圏：OpenStreetMap（Valhalla）。',
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
        <span className="lg-dot" style={{ background: RAIL_LINE_COLOUR, border: '2px solid #ffffff', width: 11, height: 11 }}></span>
        {t('Trains (illustrative)', '列車（参考）')}
      </div>
      <div className="lg-row">
        <span className="lg-dot" style={{ background: '#ffffff', border: `2px solid ${RAIL_LINE_COLOUR}`, width: 10, height: 10 }}></span>
        {t('Stations', '駅')}
      </div>
      <p className="lg-note">
        {t(
          'Lines and stations: MLIT railway data (CC BY 4.0). Trains are illustrative: a typical interval per line, stopping at each station, not a timetable (rail timetables are not open data). Hover a station for its next trains.',
          '路線・駅：国土数値情報（鉄道データ、CC BY 4.0）。列車は参考表示：路線ごとの標準的な間隔で各駅に停車し、時刻表ではない（鉄道の時刻表は非公開）。駅にカーソルを合わせると次の列車を表示。',
        )}
      </p>
    </>
  )
}
