import type { ModeId, TransportModesFile } from '../../types/transport'
import { useLang } from '../../lib/i18n'

/**
 * Two groups a policy reader cares about, each in one hue family from the
 * app's validated categorical tokens: car (--s3) and public transport (--s1);
 * the second mode of each group is a lighter tint of the same hue. Other is neutral.
 */
const CAR = 'var(--s3)'
const CAR_2 = 'color-mix(in oklab, var(--s3) 50%, #e9eef8)'
const PT = 'var(--s1)'
const PT_2 = 'color-mix(in oklab, var(--s1) 50%, #e9eef8)'
const OTHER = '#4a5770'

const GROUPS = [
  {
    id: 'car',
    en: 'By car',
    ja: '車',
    colour: CAR,
    modes: [
      { id: 'own_car' as ModeId, en: 'Own car', ja: '自家用車', colour: CAR },
      { id: 'rental_car' as ModeId, en: 'Rental car', ja: 'レンタカー', colour: CAR_2 },
    ],
  },
  {
    id: 'pt',
    en: 'By bus or train',
    ja: 'バス・鉄道',
    colour: PT,
    modes: [
      { id: 'bus' as ModeId, en: 'Bus', ja: 'バス', colour: PT },
      { id: 'train' as ModeId, en: 'Train', ja: '鉄道', colour: PT_2 },
    ],
  },
]
const SEGMENTS: { id: ModeId; colour: string }[] = [
  { id: 'own_car', colour: CAR },
  { id: 'rental_car', colour: CAR_2 },
  { id: 'bus', colour: PT },
  { id: 'train', colour: PT_2 },
  { id: 'other', colour: OTHER },
]

const pct = (x: number) => `${Math.round(x * 100)}%`

/** Car and public transport shares of the last-30-day total. */
// eslint-disable-next-line react-refresh/only-export-components
export function modeTotals(data: TransportModesFile) {
  const s = (m: ModeId) => data.totals.last_30_days.by_mode[m].share ?? 0
  return { car: s('own_car') + s('rental_car'), pt: s('bus') + s('train') }
}

/**
 * Exhibit 1 body: the car vs public transport split with its two modes each,
 * then the same split per site. Numbers: transport_modes.json (Modelled).
 */
export function ModeShare({ data, name }: { data: TransportModesFile; name: (id: string) => string }) {
  const { t, lang } = useLang()
  const tot = data.totals.last_30_days
  const loc = lang === 'ja' ? 'ja-JP' : 'en-US'
  const round = (v: number) => (v >= 10_000 ? Math.round(v / 1000) * 1000 : Math.round(v / 100) * 100).toLocaleString(loc)
  const share = (m: ModeId) => tot.by_mode[m].share ?? 0
  const sites = Object.entries(data.nodes)
  const siteShare = (id: string, modes: ModeId[]) => modes.reduce((a, m) => a + (data.nodes[id].shares[m]?.share ?? 0), 0)

  return (
    <div className="ms">
      <div className="ms-groups">
        {GROUPS.map((g) => (
          <div key={g.id} className="ms-group">
            <div className="ms-group-head">
              <span className="ms-group-name">{t(g.en, g.ja)}</span>
              <span className="ms-group-pct num" style={{ color: g.colour }}>
                {pct(g.modes.reduce((a, m) => a + share(m.id), 0))}
              </span>
            </div>
            <div className="ms-group-sub num">
              {t(`${round(g.modes.reduce((a, m) => a + tot.by_mode[m.id].visitors, 0))} visitors`, `${round(g.modes.reduce((a, m) => a + tot.by_mode[m.id].visitors, 0))}人`)}
            </div>
            <div className="ms-modes">
              {g.modes.map((m) => (
                <div key={m.id} className="ms-mode">
                  <i style={{ background: m.colour }} aria-hidden="true"></i>
                  <span className="ms-mode-name">{t(m.en, m.ja)}</span>
                  <span className="ms-mode-val num">{round(tot.by_mode[m.id].visitors)}</span>
                  <span className="ms-mode-pct num">{pct(share(m.id))}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="ms-by-head">
        <h3 className="ms-h3">{t('By site', '地点別')}</h3>
        <div className="ms-key" aria-hidden="true">
          {GROUPS.flatMap((g) => g.modes).map((m) => (
            <span key={m.id}>
              <i style={{ background: m.colour }}></i>
              {t(m.en, m.ja)}
            </span>
          ))}
          <span>
            <i style={{ background: OTHER }}></i>
            {t('Other', 'その他')}
          </span>
        </div>
      </div>
      <ul className="ms-sites">
        {sites.map(([id]) => (
          <li key={id} className="ms-site">
            <span className="ms-site-name">{name(id)}</span>
            <span className="ms-bar" aria-hidden="true">
              {SEGMENTS.map((s) => {
                const v = data.nodes[id].shares[s.id]?.share ?? 0
                return v > 0 ? <span key={s.id} style={{ flexGrow: v, background: s.colour }}></span> : null
              })}
            </span>
            <span className="ms-site-text">
              <span className="num">{pct(siteShare(id, ['own_car', 'rental_car']))}</span> {t('car', '車')}
              <span className="ms-dotsep">·</span>
              <span className="num">{pct(siteShare(id, ['bus', 'train']))}</span> {t('bus or train', 'バス・鉄道')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
