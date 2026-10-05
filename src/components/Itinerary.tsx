import type { JourneyLeg } from '../types/transport'
import { useLang } from '../lib/i18n'
import { placeEn, routeEn } from '../lib/transportNames'
import { MODE_COLOUR, MODE_LABEL, clockLabel } from '../lib/transport'

/** A journey's legs, one line each: time, mode, line, from → to. */
export function Itinerary({ legs }: { legs: JourneyLeg[] }) {
  const { t, lang } = useLang()
  // Route and stop names come from the feeds in Japanese: English in the English page.
  const place = (ja: string) => (lang === 'ja' ? ja : placeEn(ja))
  return (
    <ol className="itin">
      {legs.map((l, i) =>
        l.mode === 'walk' ? (
          <li key={i} className="itin-walk">
            {t(`Walk ${l.minutes} min to ${place(l.to)} (change)`, `${l.to}まで徒歩${l.minutes}分（乗換）`)}
          </li>
        ) : (
          <li key={i}>
            <span className="itin-time num">{clockLabel(l.depart)}</span>
            <span className="itin-mode" style={{ borderColor: MODE_COLOUR[l.mode] }}>{t(...MODE_LABEL[l.mode])}</span>
            <span className="itin-route">{lang === 'ja' ? l.route : routeEn(l.route)}</span>
            <span className="itin-path">
              {place(l.from)} → {place(l.to)} <span className="num">{clockLabel(l.arrive)}</span>
            </span>
          </li>
        ),
      )}
    </ol>
  )
}
