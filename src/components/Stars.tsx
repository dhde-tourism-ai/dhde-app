import { useLang } from '../lib/i18n'

/** Star display: the filled share is rating / 5. Always paired with the number. */
export function Stars({ value, small = false }: { value: number; small?: boolean }) {
  const { lang } = useLang()
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <span className="stars" style={{ ['--pct' as string]: `${pct}%`, fontSize: small ? 11 : 13 }} role="img" aria-label={lang === 'ar' ? `${value} من 5` : `${value} of 5`}>
      ★★★★★
    </span>
  )
}
