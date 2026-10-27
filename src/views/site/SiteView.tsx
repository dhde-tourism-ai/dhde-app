import { useEffect, useMemo, useState } from 'react'
import { Circle, MapContainer, Polygon, Polyline, Tooltip, useMap, ZoomControl } from 'react-leaflet'
import type { FitBoundsOptions, LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../../styles/map.css'
import '../../styles/site.css'
import type { ProductData } from '../../hooks/useProductData'
import type { RealForecast } from '../../types/real'
import { useLang } from '../../lib/i18n'
import { useIsNarrow } from '../../hooks/useIsNarrow'
import { CONDITION_LABEL } from '../../lib/live'
import { fmtDate } from '../../lib/format'
import { SITES } from '../../lib/sites'
import { demandLevel, normalDay, siteDays } from '../../lib/site'
import type { DemandLevel, SiteDay } from '../../lib/site'
import { Basemap } from '../map/Basemap'
import { SiteData } from './SiteData'
import { SiteTransit } from './SiteTransit'

const LEVEL: Record<DemandLevel, { en: string; ja: string }> = {
  quiet: { en: 'Quiet', ja: '少なめ' },
  normal: { en: 'Normal', ja: 'ふつう' },
  busy: { en: 'Busy', ja: '多い' },
}
/** Halo around the counting point, by the picked day's demand (metres). */
const HALO_M: Record<DemandLevel, number> = { quiet: 220, normal: 320, busy: 460 }
const OSM_CREDIT = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (ODbL)'
const DOW_JA = '日月火水木金土'

function jstToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

const n0 = (v: number) => Math.round(v).toLocaleString('en-US')
const pct = (v: number | null) => (v === null ? '?' : `${Math.round(v * 100)}%`)

/** "10/26（月）" or "Mon 26 Oct". */
function dayName(iso: string, lang: 'en' | 'ja'): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (lang === 'ja') return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${DOW_JA[d.getUTCDay()]}）`
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** Fits the site again when the layout switches between desktop (panels over the map) and phone. */
function FitSite({ bounds, options }: { bounds: LatLngBoundsExpression; options: FitBoundsOptions }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
    map.fitBounds(bounds, options)
  }, [map, bounds, options])
  return null
}

const FIT_WIDE: FitBoundsOptions = { paddingTopLeft: [24, 24], paddingBottomRight: [360, 150] }
const FIT_NARROW: FitBoundsOptions = { padding: [12, 12] }

function Weather({ day }: { day: SiteDay }) {
  const { lang } = useLang()
  const w = day.weather
  if (!w) return <span className="muted">—</span>
  const temp = w.tMin === null ? '' : w.tMin === w.tMax || w.tMax === null ? `${Math.round(w.tMin)}℃` : `${Math.round(w.tMin)}${lang === 'ja' ? '〜' : '–'}${Math.round(w.tMax)}℃`
  return (
    <>
      {CONDITION_LABEL[w.cond][lang]}
      <span className="muted">
        {w.mm !== null && w.mm >= 1 ? ` ${Math.round(w.mm)}mm` : ''}
        {w.wind !== null && w.wind >= 10 ? (lang === 'ja' ? ` 風${Math.round(w.wind)}m/s` : ` wind ${Math.round(w.wind)} m/s`) : ''}
        {temp ? ` · ${temp}` : ''}
      </span>
    </>
  )
}

function Level({ level }: { level: DemandLevel }) {
  const { t } = useLang()
  return (
    <span className={`site-level ${level}`}>
      <i aria-hidden="true"></i>
      {t(LEVEL[level].en, LEVEL[level].ja)}
    </span>
  )
}

function Hotel({ day }: { day: SiteDay }) {
  const h = day.hotel
  if (!h) return <span className="muted">—</span>
  return (
    <>
      {pct(h.occ)}
      {h.sold !== null && h.total ? <span className="muted"> {n0(h.sold)}/{n0(h.total)}</span> : null}
    </>
  )
}

/** One line on how good the model is, from its walk-forward backtest. */
function modelLine(f: RealForecast, t: (en: string, ja: string) => string): string {
  return t(
    `Model forecast (${f.model}): typical error ${pct(f.backtest_wape)} vs ${pct(f.baseline_wape)} for "same weekday last week"; ${pct(f.range_coverage)} of past test days fell inside the range.`,
    `予測モデル（${f.model}）：誤差 ${pct(f.backtest_wape)}（「先週の同じ曜日」なら ${pct(f.baseline_wape)}）。過去の検証日の ${pct(f.range_coverage)} が予測範囲内。`,
  )
}

interface Props {
  data: ProductData
  id: string
}

/**
 * #/site/<node>: one partner site on one page, real data only. A map of the site
 * (road, counting point), the picked day's numbers, a strip of recent counts and
 * the forecast, the week's forecast table, and the node's other real data
 * (SiteData).
 */
export default function SiteView({ data, id }: Props) {
  const { t, lang } = useLang()
  const narrow = useIsNarrow()
  const site = SITES[id]
  const rn = data.merged?.real?.nodes[id]
  const live = data.merged?.live ?? null
  const reg = data.registry.data?.nodes.find((n) => n.id === id)
  const today = jstToday()
  const days = useMemo(() => (rn ? siteDays(id, rn, live, today) : []), [id, rn, live, today])
  const normal = useMemo(() => (rn ? normalDay(rn) : null), [rn])
  const week = days.filter((d) => d.kind === 'forecast' && d.date >= today)
  const [picked, setPicked] = useState<string | null>(null)
  const sel = days.find((d) => d.date === picked) ?? week[0] ?? days.at(-1)

  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    if (!site) return null
    const pts = [...site.lines.flat(), ...site.polygons.flatMap((p) => p.polygon), ...('area' in site.counting ? site.counting.area : [site.counting.point])]
    return [
      [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1]))],
      [Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))],
    ]
  }, [site])

  if (!site || !rn || !bounds || !days.length || !sel) {
    return (
      <div className="state-msg" role="status">
        <div>{t('No real data for this site yet.', 'この地点の実データはまだありません。')}</div>
      </div>
    )
  }

  const colour = reg?.colour ?? '#eda100'
  const counting = site.counting
  const surveyProxy = rn.measure === 'proxy_survey'
  const signalLabel = rn.measure === 'vehicles'
    ? t('Cars', '駐車台数')
    : rn.measure === 'camera'
      ? t('Camera detections', 'カメラ検知数')
      : surveyProxy
        ? t('Survey-response proxy', 'アンケート回答の代理指標')
        : t('Measured signal', '計測値')
  const signalLine = (value: number, forecast: boolean) => {
    const n = n0(value)
    if (rn.measure === 'vehicles') return forecast ? t(`about ${n} cars`, `駐車場 約${n}台`) : t(`${n} cars`, `駐車場 ${n}台`)
    if (rn.measure === 'camera') return forecast ? t(`about ${n} camera detections`, `カメラ検知 約${n}件`) : t(`${n} camera detections`, `カメラ検知 ${n}件`)
    if (surveyProxy) return t(`Survey-response proxy: ${n} ${value === 1 ? 'response' : 'responses'}`, `アンケート回答の代理指標 ${n}件`)
    return t(`${signalLabel}: ${n}`, `${signalLabel} ${n}`)
  }
  const cal = rn.calibration
  const level = demandLevel(sel.visitors, normal?.visitors ?? null)
  const max = Math.max(...days.map((d) => Math.max(d.visitors, d.hi ?? 0)))
  const normalLabel = normal
    ? normal.annual
      ? t(`normal day ${n0(normal.visitors)} (${cal.official_period_label ?? '2025'} average)`, `平常 ${n0(normal.visitors)}人（${cal.official_period_label_ja ?? '2025年'}の1日平均）`)
      : t(`normal day ${n0(normal.visitors)} (recent average)`, `平常 ${n0(normal.visitors)}人（直近の平均）`)
    : null
  const firstForecast = days.findIndex((d) => d.kind === 'forecast')
  const hotelArea = t(site.hotel_area.en, site.hotel_area.ja)

  return (
    <div className="siteview">
      <section className="site-map" aria-label={t('Site map', '地図')}>
        <MapContainer
          className="map-canvas"
          bounds={bounds}
          boundsOptions={narrow ? FIT_NARROW : FIT_WIDE}
          zoomControl={false}
          scrollWheelZoom
          attributionControl
        >
          <FitSite bounds={bounds} options={narrow ? FIT_NARROW : FIT_WIDE} />
          <Basemap id="hybrid" />
          <ZoomControl position="topleft" />
          <SiteTransit />
          {site.lines.map((line, i) => (
            <Polyline key={`c${i}`} positions={line} pathOptions={{ color: '#000', opacity: 0.55, weight: 9, interactive: false }} />
          ))}
          {site.lines.map((line, i) => (
            <Polyline key={`r${i}`} positions={line} pathOptions={{ color: colour, weight: 4.5, interactive: false }} />
          ))}
          {'point' in counting ? (
            <Circle attribution={OSM_CREDIT} center={counting.point} radius={HALO_M[level]} pathOptions={{ className: `site-halo ${level}`, weight: 1.5 }}>
              <Tooltip permanent direction="right" offset={[18, 0]} className="map-tip site-tip">
                {t(counting.en, counting.ja)}
              </Tooltip>
            </Circle>
          ) : (
            <Polygon attribution={OSM_CREDIT} positions={counting.area} pathOptions={{ className: `site-halo ${level}`, weight: 1.5 }}>
              <Tooltip permanent direction="center" className="map-tip site-tip">
                {t(counting.en, counting.ja)}
              </Tooltip>
            </Polygon>
          )}
          {site.polygons.map((p) => (
            <Polygon key={p.id} positions={p.polygon} pathOptions={{ color: '#fff', weight: 1.5, fillColor: colour, fillOpacity: 0.45 }}>
              <Tooltip permanent direction="center" className={p.badge ? 'site-park-tip' : 'map-tip site-tip'}>{p.badge ?? t(p.en, p.ja)}</Tooltip>
            </Polygon>
          ))}
        </MapContainer>

        <aside className="site-drawer">
          <div className="eyebrow">
            {sel.kind === 'forecast' ? t(`Forecast · ${dayName(sel.date, lang)}`, `${dayName(sel.date, lang)}の予測`) : surveyProxy ? t(`Estimate · ${dayName(sel.date, lang)}`, `${dayName(sel.date, lang)}の推計`) : t(`Count · ${dayName(sel.date, lang)}`, `${dayName(sel.date, lang)}の実績`)}
          </div>
          <div className="site-big">
            {n0(sel.visitors)}
            <small>{surveyProxy ? t(' estimated visitors', '人（推計）') : t(' visitors', '人')}</small>
          </div>
          <div className="site-sub">
            {sel.lo !== null && sel.hi !== null && <>{t(`Range ${n0(sel.lo)} to ${n0(sel.hi)}`, `予測範囲 ${n0(sel.lo)}〜${n0(sel.hi)}人`)} · </>}
            {sel.signal !== null && signalLine(sel.signal, sel.kind === 'forecast')}
          </div>
          {surveyProxy && <p className="site-estimate">{t('Visitor estimate from survey responses. Calibration confidence is low.', '来場者数はアンケート回答からの推計です。校正の信頼度は低いです。')}</p>}
          <div className="site-level-row">
            <Level level={level} />
            {normalLabel && <span className="muted">{normalLabel}</span>}
          </div>
          <dl className="site-facts">
            <dt>{t('Weather', '天気')}</dt>
            <dd>
              <Weather day={sel} />
            </dd>
            <dt>{t(`Hotels, ${hotelArea}`, `${hotelArea}の宿泊`)}</dt>
            <dd>
              <Hotel day={sel} />
              {sel.hotel && <span className="muted">{sel.kind === 'forecast' ? t(' booked', ' 予約済み') : t(' occupied', ' 稼働')}</span>}
            </dd>
            <dt>{t('Method', '計測方法')}</dt>
            <dd>{t(cal.method_text ?? '', cal.method_text_ja)}</dd>
            {sel.kind === 'forecast' && rn.forecast && (
              <>
                <dt>{t('Accuracy', '精度')}</dt>
                <dd>{modelLine(rn.forecast, t)}</dd>
              </>
            )}
          </dl>
        </aside>

        <div className="site-strip">
          <div className="site-strip-head">
            <span>{surveyProxy ? t('Visitors, recent estimates', '来場者 推計値') : t('Visitors, recent counts', '来場者 実績')}</span>
            {firstForecast >= 0 && <span>{t('Forecast', '予測')}</span>}
          </div>
          <div className="site-bars" role="group" aria-label={t('Pick a day', '日を選ぶ')}>
            {normal && <div className="site-normal" style={{ bottom: `${(normal.visitors / max) * 100}%` }} aria-hidden="true"></div>}
            {days.map((d, i) => (
              <button
                key={d.date}
                className={`site-bar ${d.kind}${d.weekend || d.holiday ? ' off' : ''}${i === firstForecast ? ' first' : ''}${(days.length - 1 - i) % 3 ? ' minor' : ''}`}
                aria-pressed={d.date === sel.date}
                aria-label={`${dayName(d.date, lang)} ${n0(d.visitors)}`}
                onClick={() => setPicked(d.date)}
              >
                <span className="fill" style={{ height: `${(d.visitors / max) * 100}%` }}></span>
                {d.lo !== null && d.hi !== null && <span className="whisker" style={{ bottom: `${(d.lo / max) * 100}%`, height: `${((d.hi - d.lo) / max) * 100}%` }}></span>}
                <span className="lbl">{Number(d.date.slice(8))}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="page site-week">
        <h2 className="site-h2">{t('This week', '今週の予測')}</h2>
        {week.length ? (
          <div className="site-table-wrap">
            <table className="site-table">
              <thead>
                <tr>
                  <th>{t('Day', '日付')}</th>
                  <th className="num">{signalLabel}</th>
                  <th className="num">{t('Visitors', '来場者')}</th>
                  <th title={rn.forecast ? modelLine(rn.forecast, t) : undefined}>{t('Range', '予測範囲')}</th>
                  <th>{t('Demand', '混雑')}</th>
                  <th>{t('Weather', '天気')}</th>
                  <th className="num">{t(`Hotels, ${hotelArea}`, `宿泊（${hotelArea}）`)}</th>
                </tr>
              </thead>
              <tbody>
                {week.map((d) => {
                  const top = Math.max(...week.map((w) => w.hi ?? w.visitors))
                  return (
                    <tr key={d.date} className={`${d.weekend || d.holiday ? 'off' : ''}${d.date === sel.date ? ' sel' : ''}`} onClick={() => setPicked(d.date)}>
                      <td>{dayName(d.date, lang)}</td>
                      <td className="num">{d.signal === null ? '—' : n0(d.signal)}</td>
                      <td className="num">{n0(d.visitors)}</td>
                      <td className="site-range">
                        <span className="rng" style={{ left: `${((d.lo ?? d.visitors) / top) * 100}%`, width: `${(((d.hi ?? d.visitors) - (d.lo ?? d.visitors)) / top) * 100}%` }}></span>
                        <span className="pt" style={{ left: `${(d.visitors / top) * 100}%` }}></span>
                      </td>
                      <td>
                        <Level level={demandLevel(d.visitors, normal?.visitors ?? null)} />
                      </td>
                      <td>
                        <Weather day={d} />
                      </td>
                      <td className="num">
                        <Hotel day={d} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{t('No forecast for the coming days yet.', 'これからの予測はまだありません。')}</p>
        )}
        <p className="site-note">
          {rn.measure === 'vehicles' ? t(
            `Visitors = cars × ${cal.factor?.toFixed(2) ?? '?'}, scaled to the official ${n0(cal.official_annual_2025 ?? 0)} visitors in 2025.`,
            `来場者 = 駐車台数 × ${cal.factor?.toFixed(2) ?? '?'}人（2025年の公式値 ${n0(cal.official_annual_2025 ?? 0)}人で校正）。`,
          ) : t(cal.method_text ?? '', cal.method_text_ja)}{' '}
          {surveyProxy && <>{t('Visitor counts are estimates from survey responses with low calibration confidence.', '来場者数はアンケート回答からの推計で、校正の信頼度は低いです。')}{' '}</>}
          {rn.measure === 'camera' && <>{t('The map marks the site area, not verified camera positions or coverage.', '地図は施設周辺のエリアを示しています。カメラの位置や検知範囲は未確認です。')}{' '}</>}
          {t(
            `Demand: 35% or more above or below the normal day. Hotels: rooms booked in the ${hotelArea} reservation feed. Weather: JMA observations and the JMA model forecast. Counts to ${fmtDate(rn.as_of.visitors, lang)}.`,
            `混雑は平常日より35%以上多いか少ないか。宿泊は${hotelArea}の予約データ。天気は気象庁の観測とモデル予報。実績は${fmtDate(rn.as_of.visitors, lang)}まで。`,
          )}
        </p>
      </section>

      <SiteData data={data} id={id} rn={rn} />
    </div>
  )
}
