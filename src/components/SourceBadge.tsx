import type { SourceInfo } from '../types/live'
import { useLang } from '../lib/i18n'
import { fmtDate } from '../lib/format'
import { DemoBadge } from './DemoBadge'

/**
 * Provenance of a layer or panel: "Demo data", "Real · as of <date>", or
 * "Mixed · real to <date>" when only some nodes / roads / areas are real.
 */
export function SourceBadge({ info, compact = false }: { info?: SourceInfo | null; compact?: boolean }) {
  const { t, lang } = useLang()
  if (!info || info.status === 'demo') return <DemoBadge compact={compact} />
  const date = info.as_of ? fmtDate(info.as_of, lang).replace(/ \d{4}$/, '').replace(/^\d{4}年/, '') : ''
  const real = info.status === 'real'
  const title = real
    ? t(`Real data, latest ${info.as_of ?? ''}`, `実データ（最新 ${info.as_of ?? ''}）`)
    : t(`Real for ${info.real.length} item(s), demo for the rest. Latest real: ${info.as_of ?? ''}`, `一部実データ（${info.real.length}件）、残りはデモ。最新 ${info.as_of ?? ''}`)
  return (
    <span className={`src-badge ${real ? 'real' : 'mixed'}`} title={title}>
      <span className="src-dot" aria-hidden="true"></span>
      {real ? t('Real', '実データ') : t('Mixed', '一部実データ')}
      {!compact && date && <span className="src-date">· {date}</span>}
    </span>
  )
}
