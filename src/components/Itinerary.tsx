import type { JourneyLeg } from '../types/transport'
import { useLang } from '../lib/i18n'
import { placeName, routeName } from '../lib/transportNames'
import { MODE_COLOUR, MODE_LABEL, clockLabel } from '../lib/transport'

/** A journey's legs, one line each: time, mode, line, from → to. */
export function Itinerary({ legs }: { legs: JourneyLeg[] }) {
  const { t, lang } = useLang()
  // Route and stop names come from the feeds in Japanese: English or Arabic from the name lists.
  const place = (ja: string) => placeName(lang, ja)
  const arrow = lang === 'ar' ? '←' : '→'
  return (
    <ol className="itin">
      {legs.map((l, i) =>
        l.mode === 'walk' ? (
          <li key={i} className="itin-walk">
            {t(`Walk ${l.minutes} min to ${place(l.to)} (change)`, `${l.to}まで徒歩${l.minutes}分（乗換）`, `المشي ${l.minutes} د إلى ${place(l.to)} (تبديل)`)}
          </li>
        ) : (
          <li key={i}>
            <span className="itin-time num">{clockLabel(l.depart)}</span>
            <span className="itin-mode" style={{ borderColor: MODE_COLOUR[l.mode] }}>{t(...MODE_LABEL[l.mode])}</span>
            <span className="itin-route">{routeName(lang, l.route)}</span>
            <span className="itin-path">
              {place(l.from)} {arrow} {place(l.to)} <span className="num">{clockLabel(l.arrive)}</span>
            </span>
          </li>
        ),
      )}
    </ol>
  )
}
