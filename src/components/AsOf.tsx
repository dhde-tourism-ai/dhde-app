import type { Freshness } from '../types/dashboard'
import { fmtDate } from '../lib/format'

interface AsOfProps extends Freshness {
  /** Fallback date when no as_of is given (e.g. generated_at). */
  generated_at?: string
  label?: string
  className?: string
}

/** "As of" freshness line. Renders only the fields that are present. */
export function AsOf({ as_of, shared_date, is_estimated, stale, generated_at, label = 'As of', className }: AsOfProps) {
  const date = as_of ?? generated_at
  if (!date && !shared_date && !is_estimated && !stale) return null
  return (
    <span className={`asof ${className ?? ''}`}>
      {date && (
        <span>
          {label} {fmtDate(date)}
        </span>
      )}
      {shared_date && <span>· aligned to {fmtDate(shared_date)}</span>}
      {is_estimated && <span className="asof-flag est">Estimated</span>}
      {stale && <span className="asof-flag stale">Stale</span>}
    </span>
  )
}
