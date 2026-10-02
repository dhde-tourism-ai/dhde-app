import type { ModeId, TransportModesFile } from '../../types/transport'
import { useLang } from '../../lib/i18n'

/**
 * Two groups a policy reader cares about, each in one hue family from the
 * app's validated categorical tokens: car (--s3) and public transport (--s1),
 * the second mode of each group a lighter tint of the same hue. Other is neutral.
 */
const CAR = 'var(--s3)'
const CAR_2 = 'color-mix(in oklab, var(--s3) 50%, #e9eef8)'
const PT = 'var(--s1)'
const PT_2 = 'color-mix(in oklab, var(--s1) 50%, #e9eef8)'
const OTHER = '#4a5770'

const GROUPS = [
  { id: 'car', en: 'By car', ja: '車', colour: CAR, modes: [
    { id: 'own_car' as ModeId, en: 'Own car', ja: '自家用車', colour: CAR },
    { id: 'rental_car' as ModeId, en: 'Rental car', ja: 'レンタカー', colour: CAR_2 },
  ] },
  { id: 'pt', en: 'By public transport', ja: '公共交通', colour: PT, modes: [
    { id: 'bus' as ModeId, en: 'Bus', ja: 'バス', colour: PT },
    { id: 'train' as ModeId, en: 'Train', ja: '鉄道', colour: PT_2 },
  ] },
]
const SEGMENTS: { id: ModeId; colour: string }[] = [
  { id: 'own_car', colour: CAR },
  { id: 'rental_car', colour: CAR_2 },
  { id: 'bus', colour: PT },
  { id: 'train', colour: PT_2 },
  { id: 'other', colour: OTHER },
]

const pct = (x: number) => `${Math.round(x * 100)}%`

/**
 * Top of the Transport view: how visitors get to the sites, for a government
 * reader. One answer, the car vs public transport split, then the same per site.
 * Numbers: transport_modes.json (site visitor estimate x survey mode share; Modelled).
 */
export function ModeShare({ data, name }: { data: TransportModesFile; name: (id: string) => string }) {
  const { t, lang } = useLang()
  const tot = data.totals.last_30_days
  const loc = lang === 'ja' ? 'ja-JP' : 'en-US'
  const round = (v: number) => (v >= 10_000 ? Math.round(v / 1000) * 1000 : Math.round(v / 100) * 100).toLocaleString(loc)
  const share = (m: ModeId) => tot.by_mode[m].share ?? 0
  const groupShare = (g: (typeof GROUPS)[number]) => g.modes.reduce((a, m) => a + share(m.id), 0)
  const groupVisitors = (g: (typeof GROUPS)[number]) => g.modes.reduce((a, m) => a + tot.by_mode[m.id].visitors, 0)
  const [car, pt] = GROUPS
  const month = tot.period ? new Date(`${tot.period[1]}T00:00:00`).toLocaleDateString(loc, { year: 'numeric', month: 'long' }) : ''
  const sites = Object.entries(data.nodes)
  const counted = sites.filter(([, n]) => n.by_mode_30d).length
  const answers = sites.reduce((a, [, n]) => a + n.responses, 0)
  const siteShare = (id: string, modes: ModeId[]) => modes.reduce((a, m) => a + (data.nodes[id].shares[m]?.share ?? 0), 0)

  return (
    <section className="ms">
      <p className="ms-eyebrow">{t(`How visitors get here · ${month}`, `来訪者の交通手段・${month}`)}</p>
      <h2 className="ms-title">{groupShare(car) > groupShare(pt) ? t('Most visitors come by car', '来訪者の多くは車で来ている') : t('Most visitors come by public transport', '来訪者の多くは公共交通で来ている')}</h2>
      <p className="ms-lead">
        {t(
          `Of an estimated ${round(tot.visitors)} visitors to ${counted} sites, ${pct(groupShare(car))} came by car and ${pct(groupShare(pt))} by bus or train.`,
          `${counted}地点の推計来訪者${round(tot.visitors)}人のうち、${pct(groupShare(car))}が車、${pct(groupShare(pt))}がバス・鉄道で来訪。`,
        )}
      </p>

      <div className="ms-groups">
        {GROUPS.map((g) => (
          <div key={g.id} className="ms-group">
            <div className="ms-group-head">
              <span className="ms-group-name">{t(g.en, g.ja)}</span>
              <span className="ms-group-pct num" style={{ color: g.colour }}>{pct(groupShare(g))}</span>
            </div>
            <div className="ms-group-sub num">{t(`${round(groupVisitors(g))} visitors`, `${round(groupVisitors(g))}人`)}</div>
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

      <h3 className="ms-h3">{t('At each site', '地点ごと')}</h3>
      <ul className="ms-sites">
        {sites.map(([id]) => {
          const c = siteShare(id, ['own_car', 'rental_car'])
          const p = siteShare(id, ['bus', 'train'])
          return (
            <li key={id} className="ms-site">
              <span className="ms-site-name">{name(id)}</span>
              <span className="ms-bar" aria-hidden="true">
                {SEGMENTS.map((s) => {
                  const v = data.nodes[id].shares[s.id]?.share ?? 0
                  return v > 0 ? <span key={s.id} style={{ flexGrow: v, background: s.colour }}></span> : null
                })}
              </span>
              <span className="ms-site-text">
                <span className="num">{pct(c)}</span> {t('car', '車')}
                <span className="ms-dotsep">·</span>
                <span className="num">{pct(p)}</span> {t('bus or train', 'バス・鉄道')}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="ms-key" aria-hidden="true">
        {GROUPS.flatMap((g) => g.modes).map((m) => (
          <span key={m.id}>
            <i style={{ background: m.colour }}></i>
            {t(m.en, m.ja)}
          </span>
        ))}
        <span>
          <i style={{ background: OTHER }}></i>
          {t('Other (taxi, bike, walking)', 'その他（タクシー・自転車・徒歩）')}
        </span>
      </div>

      <details className="ms-about">
        <summary>{t('Estimate · how it is calculated', '推計値・計算方法')}</summary>
        <p>
          {t(
            `Each site's visitor count for the last 30 days is split by how visitors there said they travelled in the Fukui Prefecture tourism survey (${answers.toLocaleString(loc)} answers over the past year). Fukui Station has no visitor count, so it is shown as shares only and left out of the total. Awara Onsen counts hotel guests. Survey answers are voluntary, so these are estimates, not counts.`,
            `各地点の直近30日の来訪者数を、福井県観光アンケートで来訪者が答えた交通手段（過去1年の回答${answers.toLocaleString(loc)}件）の割合で分けた推計値。福井駅は来訪者数がないため割合のみで、合計に含めない。あわら温泉は宿泊客数。回答は任意のため、実数ではなく推計値。`,
          )}{' '}
          <a href={data.survey.url} target="_blank" rel="noreferrer">
            {t('Survey data', 'アンケートデータ')}
          </a>
        </p>
      </details>
    </section>
  )
}
