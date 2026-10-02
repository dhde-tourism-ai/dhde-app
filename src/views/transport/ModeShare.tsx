import { useState } from 'react'
import type { ModeId, TransportModesFile } from '../../types/transport'
import { useLang } from '../../lib/i18n'
import { fmtCompact } from '../../lib/format'

const MODE_STYLE: Record<ModeId, { colour: string; en: string; ja: string; hint_en: string; hint_ja: string }> = {
  train: { colour: '#f0a43a', en: 'Train', ja: '鉄道', hint_en: 'local and JR trains', hint_ja: '在来線・JR' },
  bus: { colour: '#4fb3ff', en: 'Bus', ja: 'バス', hint_en: 'route and tour buses', hint_ja: '路線バス・ツアーバス' },
  own_car: { colour: '#c39bff', en: 'Own car', ja: '自家用車', hint_en: '', hint_ja: '' },
  rental_car: { colour: '#5fd3c4', en: 'Rental car', ja: 'レンタカー', hint_en: '', hint_ja: '' },
  other: { colour: '#56627a', en: 'Other', ja: 'その他', hint_en: 'taxi, rental bike, walking only', hint_ja: 'タクシー・レンタサイクル・徒歩のみ' },
}
const MAIN: ModeId[] = ['train', 'bus', 'own_car', 'rental_car']
type Period = 'last_30_days' | 'year_2025'

const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`)

/**
 * Top of the Transport view: estimated visitors by train, bus, own car and
 * rental car (transport_modes.json): each site's visitor estimate x its mode
 * share from the Fukui Prefecture tourism survey. Modelled.
 */
export function ModeShare({ data, name }: { data: TransportModesFile; name: (id: string) => string }) {
  const { t, lang } = useLang()
  const [period, setPeriod] = useState<Period>('last_30_days')
  const tot = data.totals[period]
  const counted = Object.entries(data.nodes).filter(([, n]) => (period === 'last_30_days' ? n.by_mode_30d : n.by_mode_year))
  const fmt = (v: number) => (v >= 10000 ? fmtCompact(v) : v.toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-US'))
  const periodLabel =
    period === 'last_30_days' && tot.period
      ? t(`${tot.period[0]} to ${tot.period[1]}`, `${tot.period[0]}〜${tot.period[1]}`)
      : t('2025, from official visitor counts', '2025年（公式入込数ベース）')

  return (
    <section className="s-card ms" style={{ ['--span' as string]: 12 }}>
      <div className="s-card-head">
        <div>
          <h2 className="card-title">
            {t('How visitors travel to the sites', '来訪者の交通手段')} <span className="tr-tag ms-tag">{t('Modelled', '推計')}</span>
          </h2>
          <p className="card-sub">
            {t(
              `Estimated visitors by mode across the ${counted.length} sites with a visitor estimate, ${periodLabel}. Visitor estimate × each site's answers to the prefecture tourism survey's "how did you get around in Fukui" question (${Object.values(data.nodes).reduce((a, n) => a + n.responses, 0).toLocaleString()} responses, ${data.survey.from} to ${data.survey.to}).`,
              `来訪者数の推計がある${counted.length}地点の交通手段別の推計来訪者数（${periodLabel}）。来訪者数の推計×各地点での県観光アンケート「福井県内での交通手段」の回答（${Object.values(data.nodes).reduce((a, n) => a + n.responses, 0).toLocaleString()}件、${data.survey.from}〜${data.survey.to}）。`,
            )}
          </p>
        </div>
        <div className="access-days" role="tablist" aria-label={t('Period', '期間')}>
          <button role="tab" aria-selected={period === 'last_30_days'} onClick={() => setPeriod('last_30_days')}>
            {t('Last 30 days', '直近30日')}
          </button>
          <button role="tab" aria-selected={period === 'year_2025'} onClick={() => setPeriod('year_2025')}>
            {t('Year (2025)', '年間（2025年）')}
          </button>
        </div>
      </div>

      <div className="ms-tiles">
        {MAIN.map((m) => {
          const v = tot.by_mode[m]
          const st = MODE_STYLE[m]
          return (
            <div key={m} className="ms-tile" style={{ ['--mode' as string]: st.colour }}>
              <div className="ms-label">
                <i className="ms-dot" aria-hidden="true"></i>
                {t(st.en, st.ja)}
                <span className="muted small">{t(st.hint_en, st.hint_ja)}</span>
              </div>
              <div className="ms-big num">{fmt(v.visitors)}</div>
              <div className="ms-share">
                <strong className="num">{pct(v.share)}</strong> {t('of visitors', 'の来訪者')}
              </div>
              <div className="muted small num">
                {t(`range ${fmt(v.lo)} – ${fmt(v.hi)}`, `幅 ${fmt(v.lo)}〜${fmt(v.hi)}`)}
              </div>
            </div>
          )
        })}
      </div>
      <p className="muted small ms-other">
        {t(
          `Other (${MODE_STYLE.other.hint_en}): ${fmt(tot.by_mode.other.visitors)} (${pct(tot.by_mode.other.share)}). Total ${fmt(tot.visitors)} visitors.`,
          `その他（${MODE_STYLE.other.hint_ja}）：${fmt(tot.by_mode.other.visitors)}（${pct(tot.by_mode.other.share)}）。合計${fmt(tot.visitors)}人。`,
        )}
      </p>

      <div className="ms-sites">
        {Object.entries(data.nodes).map(([id, n]) => {
          const c = period === 'last_30_days' ? n.by_mode_30d : n.by_mode_year
          const total = period === 'last_30_days' ? n.visitors_30d : n.official_annual_2025
          return (
            <div key={id} className="ms-row">
              <div className="ms-site">
                <strong>{name(id)}</strong>
                <span className="muted small">
                  {total != null && c ? t(`${fmt(total)} visitors`, `来訪者${fmt(total)}人`) : t('no visitor estimate', '来訪者推計なし')}
                  {' · '}
                  {t(`${n.responses.toLocaleString()} survey answers`, `回答${n.responses.toLocaleString()}件`)}
                </span>
              </div>
              <div className="ms-bar" role="img" aria-label={(Object.keys(MODE_STYLE) as ModeId[]).map((m) => `${MODE_STYLE[m].en} ${pct(n.shares[m]?.share)}`).join(', ')}>
                {(Object.keys(MODE_STYLE) as ModeId[]).map((m) => {
                  const s = n.shares[m]?.share ?? 0
                  if (s <= 0) return null
                  return (
                    <span
                      key={m}
                      style={{ width: `${s * 100}%`, background: MODE_STYLE[m].colour }}
                      title={`${t(MODE_STYLE[m].en, MODE_STYLE[m].ja)}: ${pct(s)}${c ? ` · ${fmt(c[m].visitors)}` : ''} (${pct(n.shares[m].lo)}–${pct(n.shares[m].hi)})`}
                    >
                      {s >= 0.09 ? pct(s) : ''}
                    </span>
                  )
                })}
              </div>
              {n.note && <span className="muted small ms-note">{t(n.note, n.note_ja ?? n.note)}</span>}
            </div>
          )
        })}
      </div>
      <div className="chart-key ms-key">
        {(Object.keys(MODE_STYLE) as ModeId[]).map((m) => (
          <span key={m}>
            <i className="tr-swatch" style={{ background: MODE_STYLE[m].colour, height: 8, width: 12 }}></i>
            {t(MODE_STYLE[m].en, MODE_STYLE[m].ja)}
          </span>
        ))}
      </div>
      <p className="muted small tr-routes">
        {t(
          'How it is estimated: each site\'s daily visitor estimate (its camera, booking or hotel signal scaled to the official 2025 count) is split by the share of survey respondents at that site who got around by each mode. Several answers count equally; walking counts only when it was the only answer. Ranges are 95% intervals from the number of answers. Survey respondents choose to take part, so shares can lean towards visitors who use the survey app. Katsuyama has by far the most visitors, so its car-heavy split weighs most in the total.',
          '推計方法：各地点の日別来訪者推計（カメラ・予約・宿泊の指標を2025年の公式入込数に換算）を、その地点でのアンケート回答者の交通手段の割合で分けたもの。複数回答は均等に配分、徒歩は単独回答のみ計上。幅は回答数に基づく95%区間。回答は任意のため、アンケートアプリ利用者に偏る可能性がある。来訪者が最も多い勝山の車中心の割合が合計に最も効いている。',
        )}{' '}
        <a href={data.survey.url} target="_blank" rel="noreferrer">
          {t('Survey data (CC BY 4.0)', 'アンケートデータ（CC BY 4.0）')}
        </a>
      </p>
    </section>
  )
}
