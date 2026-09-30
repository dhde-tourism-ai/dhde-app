import { useState } from 'react'
import type { ReactNode } from 'react'
import { useLang } from '../../../lib/i18n'
import { Icon } from '../../../components/icons'
import { DemoBadge } from '../../../components/DemoBadge'
import { SourceBadge } from '../../../components/SourceBadge'
import type { DataSources, SourceInfo } from '../../../types/live'
import { PillLegend } from '../../../components/StatusPill'
import { CROWD_TIERS, TRAFFIC_TIERS } from '../../../lib/live'
import { econCaveats } from '../../../lib/economics'
import type { RegionalEconomics } from '../../../types/economics'
import { BASEMAPS, GROUPS, LAYERS, OVERVIEW_NOTE, readPanelOpen, storePanelOpen } from '../layers'
import type { MarketVoiceData } from '../../../types/market'
import { OCC_STEPS, RSI_STEPS } from '../../../lib/market'
import { PRIORITY } from '../../../lib/nudges'
import type { BasemapId, LayerId } from '../layers'

interface Props {
  basemap: BasemapId
  setBasemap: (b: BasemapId) => void
  active: Set<LayerId>
  toggle: (l: LayerId) => void
  showPrecip: boolean
  setShowPrecip: (v: boolean) => void
  isDemo: boolean
  economics: RegionalEconomics | null
  economicsError: Error | null
  market?: MarketVoiceData | null
  sources?: DataSources
  onClose?: () => void
}

const REAL_NOTE: Partial<Record<LayerId, [string, string]>> = {
  people: ["Day totals are real estimates (each site's daily signal times one calibration factor from its official annual count; confidence per node). The hourly shape is simulated so each day adds up to the real total. Future days: the 7-day model forecast, then the same-weekday average of the last 4 weeks. Fukui Station has no official count: camera detections and busyness (% of an average 2025 day) only.", '日合計は実推計（各地点の日次シグナルに公式年間値からの換算係数を掛けたもの）。時間別の形は模擬で日合計に一致。将来日は7日間モデル予測、その後は直近4週の同曜日平均。福井駅は公式値がなくカメラ検知数と混雑度（2025年の平均日比）のみ。'],
  density: ['Follows the People layer: real day totals, simulated hourly shape.', '人数レイヤーと同じ：日合計は実データ、時間別は模擬。'],
  flow: ['Route volumes follow each destination’s real day total; the split by road and hour is simulated.', '各目的地の実日合計に比例。道路・時間の配分は模擬。'],
  traffic: ['Roads with a counter (Katsuyama, Eiheiji, Rainbow Line) follow the real daily volume; others and all future days stay demo.', '計測器のある道路（勝山・永平寺・レインボーライン）は実交通量。その他と将来日はデモ。'],
  weather: ['Daily temperature, rain, wind, sun, humidity and snow are real (JMA); the hourly curve is synthesised. Advisories are demo.', '日別の気温・降水・風・日照・湿度・積雪は実データ（気象庁）。時間別は合成。注意報はデモ。'],
  hotels: ['Occupancy, ADR and rooms from FTAS reservation feeds, forward bookings up to 90 days (real). Rakuten availability is demo.', '稼働率・客室単価・室数はFTAS予約データ、90日先までの予約（実データ）。楽天の空室はデモ。'],
  rsi: ['Google Maps Business Profile map views, searches and directions for the node in each area (real, lags about 5 days). Other areas demo.', 'Googleビジネスプロフィールの表示・検索・経路（実データ、約5日遅れ）。その他はデモ。'],
  reviews: ['Rating and new reviews in 30 days are real (GMB). Total count and snippets are fictional demo.', '評価と30日の新規件数は実データ。総件数と抜粋は架空のデモ。'],
  survey: ['Response counts are real; satisfaction, NPS, reasons and origin are demo.', '回答数は実データ。満足度・NPS・理由・居住地はデモ。'],
  nudges: ['Demand and booking action nudges use real visitor history and forward bookings where available.', '需要・予約の推奨アクションは実データ（来訪者履歴・先行予約）を使用。'],
}

function Grad({ from, to, left, right }: { from: string; to: string; left: string; right: string }) {
  return (
    <div className="lg-grad">
      <span className="lg-grad-bar" style={{ background: `linear-gradient(90deg, ${from}, ${to})` }}></span>
      <span className="lg-grad-lab">
        <span>{left}</span>
        <span>{right}</span>
      </span>
    </div>
  )
}

export function LayersPanel(p: Props) {
  const { t } = useLang()
  // On a phone the panel is a sheet with its own close button, so it never collapses.
  const collapsible = !p.onClose
  const [openState, setOpenState] = useState(readPanelOpen)
  const open = !collapsible || openState
  const flip = () => {
    storePanelOpen(!openState)
    setOpenState(!openState)
  }
  const src = (id: LayerId): SourceInfo | undefined => (p.sources as Record<string, SourceInfo | undefined> | undefined)?.[id]
  const anyReal = Object.values(p.sources ?? {}).some((x) => x && x.status !== 'demo')
  const realNote = (id: LayerId): ReactNode => {
    const i = src(id)
    if (!i || i.status === 'demo') return null
    return (
      <div className="lg-src">
        <SourceBadge info={i} note={REAL_NOTE[id]} />
        <span className="lg-note">{REAL_NOTE[id] ? t(REAL_NOTE[id]![0], REAL_NOTE[id]![1]) : ''}</span>
      </div>
    )
  }

  const legend: Record<LayerId, ReactNode> = {
    nudges: (
      <>
        {(['high', 'medium', 'low'] as const).map((k) => (
          <div key={k} className="lg-row lg-priority">
            <span className="lg-flag" style={{ background: PRIORITY[k].colour }}></span>
            <span>
              <strong>{t(PRIORITY[k].en, PRIORITY[k].ja)}</strong>
              <span className="lg-note">{t(PRIORITY[k].hint_en, PRIORITY[k].hint_ja)}</span>
            </span>
          </div>
        ))}
        <div className="lg-row">
          <span className="lg-line" style={{ borderColor: '#3fd8c4', borderTopStyle: 'dashed' }}></span>
          {t('Suggested indoor route', '推奨する屋内への経路')}
        </div>
        <p className="lg-note">{t('Flags show the selected day. Full list in the Action nudges tab.', '旗は選択日の分。一覧は推奨アクションタブ。')}</p>
      </>
    ),
    hotels: (
      <>
        <div className="lg-tiers">
          {OCC_STEPS.map((x) => (
            <span key={x.en} className="lg-row">
              <span className="lg-sq" style={{ background: x.colour }}></span>
              {t(x.en, x.ja)}
            </span>
          ))}
        </div>
        <p className="lg-note">{t('Badge: occupancy tonight (follows the timeline day) and rooms left. FTAS reservation feeds + Rakuten availability within 3 km.', 'バッジ：当日の稼働率と残室。FTAS予約データと楽天の3km圏空室。')}</p>
      </>
    ),
    rsi: (
      <>
        <div className="lg-tiers">
          {RSI_STEPS.map((x) => (
            <span key={x.label} className="lg-row">
              <span className="lg-sq" style={{ background: x.colour }}></span>
              {x.label}
            </span>
          ))}
        </div>
        <p className="lg-note">{t('Route-search interest index per municipality; sparkline = last 7 days, ▲▼ = vs previous week.', '市町ごとのルート検索指数。線＝直近7日、▲▼＝前週比。')}</p>
      </>
    ),
    survey: <p className="lg-note">{t('Badge: satisfaction (1–5) and NPS. Hover for reasons and origin share. FTAS / tourism federation survey.', 'バッジ：満足度（1〜5）とNPS。ホバーで理由と居住地。')}</p>,
    social: (
      <>
        <Grad from="#e66767" to="#3987e5" left={t('Negative', '不評')} right={t('Positive', '好評')} />
        <p className="lg-note">{t('Badge edge = average sentiment; thumbnails are abstract placeholders. Click for the feed. All posts fictional.', '縁の色＝平均感情。サムネイルは抽象的な仮画像。クリックでフィード。投稿は架空。')}</p>
      </>
    ),
    reviews: <p className="lg-note">{t('Stars, average rating, review count, ▲▼ change over 30 days. Snippets are fictional.', '星・平均評価・件数・30日の変化。抜粋は架空。')}</p>,
    people: (
      <>
        <div className="lg-row">
          <span className="lg-dot" style={{ background: '#aeb9cd' }}></span>
          {t('Solid = counted on site', '塗り＝実測')}
        </div>
        <div className="lg-row">
          <span className="lg-ring" style={{ borderColor: '#fff' }}></span>
          {t('Dashed ring = forecast', '破線の輪＝予測')}
        </div>
        <div className="lg-row">
          <span className="lg-dot" style={{ background: 'rgba(174,185,205,.25)', boxShadow: 'inset 0 0 0 1px #aeb9cd' }}></span>
          {t('Faint fill = forecast only (future hour)', '薄い塗り＝予測のみ（将来）')}
        </div>
        <div className="lg-row">
          <span className="lg-dot" style={{ background: 'rgba(174,185,205,.5)', outline: '1.5px dashed #aeb9cd', outlineOffset: 1 }}></span>
          {t('Dashed edge + “est.” = estimated (proxy, bookings, vehicles)', '破線の縁＋「推定」＝推定値（代理指標・予約・車両）')}
        </div>
        <div className="lg-tiers">
          {CROWD_TIERS.map((x) => (
            <span key={x.key} className="lg-row">
              <span className="lg-dot" style={{ background: x.colour }}></span>
              {t(x.label, x.label_ja)}
            </span>
          ))}
        </div>
        <p className="lg-note">{t('Area = people on site. Colour = share of comfortable capacity.', '面積＝現地の人数。色＝快適容量に対する割合。')}</p>
      </>
    ),
    density: <Grad from="rgba(236,131,90,0.1)" to="rgba(236,131,90,0.75)" left={t('Few', '少')} right={t('Many visitors', '多')} />,
    flow: (
      <>
        <div className="lg-row">
          <span className="lg-line" style={{ borderColor: 'var(--arrive)' }}></span>
          {t('Arriving (toward a site, or into Fukui)', '到着（目的地へ／福井県内へ）')}
        </div>
        <div className="lg-row">
          <span className="lg-line" style={{ borderColor: 'var(--depart)' }}></span>
          {t('Departing (heading back)', '出発（帰路）')}
        </div>
        <div className="lg-row">
          <span className="lg-line" style={{ borderColor: '#c9d4ff', borderTopStyle: 'dotted' }}></span>
          {t('Hokuriku Shinkansen (approx. line)', '北陸新幹線（概略）')}
        </div>
        <p className="lg-note">{t('Denser, faster dots = more people per hour. Roads from OSRM / OpenStreetMap. The dots follow each site’s daily total; measured origin-to-destination journeys are Pending: KDDI data.', '点が密で速いほど人数が多い。道路はOSRM／OpenStreetMap。点は各地点の日合計に沿った表示で、出発地から目的地までの実測の移動はKDDIデータ待ち。')}</p>
      </>
    ),
    traffic: (
      <>
        <div className="lg-tiers">
          {TRAFFIC_TIERS.map((x) => (
            <span key={x.key} className="lg-row">
              <span className="lg-line" style={{ borderColor: x.colour }}></span>
              {t(x.label, x.label_ja)}
            </span>
          ))}
        </div>
        <div className="lg-row">
          <span className="lg-line" style={{ borderColor: 'var(--crit)', borderTopStyle: 'dashed', opacity: 0.7 }}></span>
          {t('Congested corridor (avoid)', '渋滞区間（回避）')}
        </div>
        <div className="lg-row">
          <span className="lg-line" style={{ borderColor: 'var(--good)' }}></span>
          {t('Recommended alternate', '推奨迂回路')}
        </div>
        <div className="lg-row">
          <span className="lg-dot" style={{ background: '#f2f5fb', width: 6, height: 6 }}></span>
          {t('Vehicles (slower where jammed)', '車両（渋滞では低速）')}
        </div>
      </>
    ),
    weather: (
      <>
        <p className="lg-note">{t('Chip: sky, temperature, chance of rain, wind. ⚠ = JMA-style advisory in force.', 'チップ：天気・気温・降水確率・風速。⚠＝注意報発表中。')}</p>
        <label className="lg-check">
          <span className="switch">
            <input type="checkbox" checked={p.showPrecip} onChange={(e) => p.setShowPrecip(e.target.checked)} />
            <span className="switch-track"></span>
          </span>
          {t('Precipitation tint', '降水の色付け')}
        </label>
        {p.showPrecip && <Grad from="rgba(70,140,230,0.15)" to="rgba(120,170,255,0.8)" left={t('Light', '弱')} right={t('Heavy rain', '強い雨')} />}
      </>
    ),
    sentiment: (
      <>
        <Grad from="#e66767" to="#3987e5" left={t('Negative', '不評')} right={t('Positive', '好評')} />
        <div className="lg-row">
          <span className="lg-ring" style={{ borderStyle: 'solid', borderColor: '#3987e5' }}></span>
          {t('Pulsing ring = hotspot (strong opinion, 25+ posts)', '点滅する輪＝ホットスポット（25件以上）')}
        </div>
      </>
    ),
    economics: (
      <>
        <p className="lg-note">{t('Circle = municipal revenue · dashed line = visitor flow · grey dashed = Pending: KDDI data (journeys not measured yet).', '円＝市町の観光収入・破線＝来訪者の流れ・灰色破線＝KDDIデータ待ち（移動は未計測）。')}</p>
        <PillLegend />
        {p.economics?.sample && (
          <div className="banner banner-warn">
            <Icon name="alert" />
            <span>
              <strong>{t('Sample data.', 'サンプルデータ。')}</strong> {t('Placeholder in the agreed shape; do not quote.', '仮データです。引用しないでください。')}
            </span>
          </div>
        )}
        {p.economics &&
          econCaveats(p.economics).map((c) => (
            <div key={c} className="banner banner-warn">
              <Icon name="alert" />
              <span>
                <strong>{t('Check before quoting:', '引用前に確認：')}</strong> {c}
              </span>
            </div>
          ))}
        {p.economicsError && <div className="banner banner-warn">{p.economicsError.message}</div>}
      </>
    ),
  }

  return (
    <section className={`float-panel layers-panel ${open ? '' : 'collapsed'}`} aria-label={t('Map layers', '地図レイヤー')}>
      <header className="fp-head">
        <h2 className="fp-title">
          {collapsible ? (
            <button className="fp-toggle" onClick={flip} aria-expanded={open} aria-controls="layers-body">
              <Icon name="layers" /> {t('Layers', 'レイヤー')}
              {p.active.size > 0 && <span className="count-badge">{p.active.size}</span>}
              <span className="fp-arrow">
                <Icon name="chevron" size={16} />
              </span>
            </button>
          ) : (
            <>
              <Icon name="layers" /> {t('Layers', 'レイヤー')}
            </>
          )}
        </h2>
        {p.isDemo && (anyReal ? <SourceBadge info={{ status: 'mixed', as_of: null, real: [] }} compact note={OVERVIEW_NOTE} /> : <DemoBadge />)}
        {p.onClose && (
          <button className="icon-btn fp-close" onClick={p.onClose} aria-label={t('Close', '閉じる')}>
            <Icon name="close" />
          </button>
        )}
      </header>

      <div className="fp-body" id="layers-body" hidden={!open}>
        <div className="basemap-row">
          <span className="eyebrow">{t('Basemap', 'ベースマップ')}</span>
          <div className="seg" role="group" aria-label={t('Basemap', 'ベースマップ')}>
            {BASEMAPS.map((b) => (
              <button key={b.id} aria-pressed={p.basemap === b.id} onClick={() => p.setBasemap(b.id)}>
                {t(b.en, b.ja)}
              </button>
            ))}
          </div>
        </div>

        {GROUPS.map((g) => (
          <div key={g.id} className="layer-group">
            <h3 className="layer-group-title">{t(g.en, g.ja)}</h3>
            <ul className="layer-list">
              {LAYERS.filter((l) => l.group === g.id).map((l) => {
                const on = p.active.has(l.id)
                return (
                  <li key={l.id} className={`layer-item ${on ? 'on' : ''}`}>
                    <label className="layer-row" title={t(l.tip_en, l.tip_ja)}>
                      <span className="layer-ic">
                        <Icon name={l.icon} size={17} />
                      </span>
                      <span className="layer-text">
                        <span className="layer-name">
                          {t(l.en, l.ja)}
                          {l.demo && p.isDemo && on && <SourceBadge info={src(l.id)} compact note={REAL_NOTE[l.id]} />}
                        </span>
                        <span className="layer-hint">{t(l.hint_en, l.hint_ja)}</span>
                      </span>
                      <span className="switch">
                        <input type="checkbox" checked={on} onChange={() => p.toggle(l.id)} aria-label={t(l.en, l.ja)} />
                        <span className="switch-track"></span>
                      </span>
                    </label>
                    {on && (
                      <div className="layer-legend">
                        {realNote(l.id)}
                        {legend[l.id]}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        <p className="fp-foot">
          {t('Visitor counts: DHDE nodes. Annual scale: Fukui Prefecture 2025 counts. Forecast model credit: FTAS.', '来訪者数：DHDEノード。年間規模：福井県2025年入込数。予測モデル：FTAS。')}
        </p>
      </div>
    </section>
  )
}
