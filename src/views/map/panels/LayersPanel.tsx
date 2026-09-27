import type { ReactNode } from 'react'
import { useLang } from '../../../lib/i18n'
import { Icon } from '../../../components/icons'
import { DemoBadge } from '../../../components/DemoBadge'
import { PillLegend } from '../../../components/StatusPill'
import { CROWD_TIERS, TRAFFIC_TIERS } from '../../../lib/live'
import { econCaveats } from '../../../lib/economics'
import type { RegionalEconomics } from '../../../types/economics'
import { BASEMAPS, GROUPS, LAYERS } from '../layers'
import type { MarketVoiceData } from '../../../types/market'
import { OCC_STEPS, RSI_STEPS } from '../../../lib/market'
import { SEV_COLOUR } from '../../../lib/alerts'
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
  onClose?: () => void
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

  const legend: Record<LayerId, ReactNode> = {
    nudges: (
      <>
        <div className="lg-row">
          <span className="lg-flag" style={{ background: SEV_COLOUR.crit }}></span>
          {t('#2 Weather-route (critical)', '#2 天候・ルート（重大）')}
        </div>
        <div className="lg-row">
          <span className="lg-flag" style={{ background: SEV_COLOUR.serious }}></span>
          {t('#1 Demand high / #3 over-booked', '#1 需要増／#3 予約過多')}
        </div>
        <div className="lg-row">
          <span className="lg-flag" style={{ background: SEV_COLOUR.info }}></span>
          {t('Opportunity (quiet day, empty rooms)', '機会（閑散日・空室）')}
        </div>
        <div className="lg-row">
          <span className="lg-line" style={{ borderColor: '#3fd8c4', borderTopStyle: 'dashed' }}></span>
          {t('Suggested indoor route', '推奨する屋内への経路')}
        </div>
        <p className="lg-note">{t('Flags show the selected day. Full list in the Nudges tab.', '旗は選択日の分。一覧はナッジタブ。')}</p>
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
        <p className="lg-note">{t('Denser, faster dots = more people per hour. Roads from OSRM / OpenStreetMap.', '点が密で速いほど人数が多い。道路はOSRM／OpenStreetMap。')}</p>
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
        <p className="lg-note">{t('Circle = municipal revenue · dashed line = visitor flow · grey dashed = pending.', '円＝市町の観光収入・破線＝来訪者の流れ・灰色破線＝データ待ち。')}</p>
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
    <section className="float-panel layers-panel" aria-label={t('Map layers', '地図レイヤー')}>
      <header className="fp-head">
        <h2 className="fp-title">
          <Icon name="layers" /> {t('Layers', 'レイヤー')}
        </h2>
        {p.isDemo && <DemoBadge />}
        {p.onClose && (
          <button className="icon-btn fp-close" onClick={p.onClose} aria-label={t('Close', '閉じる')}>
            <Icon name="close" />
          </button>
        )}
      </header>

      <div className="fp-body">
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
                    <label className="layer-row">
                      <span className="layer-ic">
                        <Icon name={l.icon} size={17} />
                      </span>
                      <span className="layer-text">
                        <span className="layer-name">
                          {t(l.en, l.ja)}
                          {l.demo && p.isDemo && on && <DemoBadge compact />}
                        </span>
                        <span className="layer-hint">{t(l.hint_en, l.hint_ja)}</span>
                      </span>
                      <span className="switch">
                        <input type="checkbox" checked={on} onChange={() => p.toggle(l.id)} aria-label={t(l.en, l.ja)} />
                        <span className="switch-track"></span>
                      </span>
                    </label>
                    {on && <div className="layer-legend">{legend[l.id]}</div>}
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
