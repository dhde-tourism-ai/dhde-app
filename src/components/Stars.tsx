import { useLang, type Lang } from '../lib/i18n'

/** Star display: the filled share is rating / 5. Always paired with the number. Map tooltips render outside the language context, so they pass `lang`. */
export function Stars({ value, small = false, lang: forced }: { value: number; small?: boolean; lang?: Lang }) {
  const ctx = useLang().lang
  const lang = forced ?? ctx
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <span className="stars" style={{ ['--pct' as string]: `${pct}%`, fontSize: small ? 11 : 13 }} role="img" aria-label={lang === 'ar' ? `${value} من 5` : `${value} of 5`}>
      ★★★★★
    </span>
  )
}
