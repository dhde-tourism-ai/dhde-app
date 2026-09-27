import type { Tier } from '../lib/live'
import { useLang } from '../lib/i18n'

/** A status colour never travels alone: dot + label. */
export function StatusTag({ tier, suffix }: { tier: Tier; suffix?: string }) {
  const { t } = useLang()
  return (
    <span className="status-tag">
      <span className="sw" style={{ background: tier.colour }} aria-hidden="true"></span>
      {t(tier.label, tier.label_ja)}
      {suffix && <span className="muted">{suffix}</span>}
    </span>
  )
}
