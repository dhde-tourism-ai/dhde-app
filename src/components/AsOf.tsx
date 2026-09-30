import type { Freshness } from '../types/dashboard'
import { fmtDate } from '../lib/format'
import { useLang } from '../lib/i18n'

interface AsOfProps extends Freshness {
  /** Fallback date when no as_of is given (e.g. generated_at). */
  generated_at?: string
  label?: string
  className?: string
}

/** "As of" freshness line. Renders only the fields that are present. */
export function AsOf({ as_of, shared_date, is_estimated, stale, generated_at, label = 'As of', className }: AsOfProps) {
  const { t, lang } = useLang()
  const date = as_of ?? generated_at
  if (!date && !shared_date && !is_estimated && !stale) return null
  return (
    <span className={`asof ${className ?? ''}`}>
      {date && (
        <span>
          {lang === 'ja' && label === 'As of' ? `${fmtDate(date, lang)}時点` : `${label} ${fmtDate(date, lang)}`}
        </span>
      )}
      {shared_date && <span>· {t('aligned to', '基準日')} {fmtDate(shared_date, lang)}</span>}
      {is_estimated && <span className="asof-flag est">{t('Estimated', '推計')}</span>}
      {stale && <span className="asof-flag stale">{t('Stale', '古いデータ')}</span>}
    </span>
  )
}
