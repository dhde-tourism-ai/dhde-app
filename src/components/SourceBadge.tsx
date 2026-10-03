import type { SourceInfo } from '../types/live'
import { useLang } from '../lib/i18n'
import { fmtDate } from '../lib/format'
import { DemoBadge } from './DemoBadge'

/**
 * Provenance of a layer or panel: "Demo data", "Real · as of <date>", or
 * "Partly estimated or demo · <date>" when only some values are real. `note`
 * (EN, JA) says which part is estimated or demo; without it the tooltip gives the count.
 */
export function SourceBadge({ info, compact = false, note }: { info?: SourceInfo | null; compact?: boolean; note?: readonly [string, string] }) {
  const { t, lang } = useLang()
  if (!info || info.status === 'demo') return <DemoBadge compact={compact} />
  const date = info.as_of ? fmtDate(info.as_of, lang).replace(/ \d{4}$/, '').replace(/^\d{4}年/, '') : ''
  const real = info.status === 'real'
  const latest = info.as_of ? t(` Latest real data: ${info.as_of}.`, `最新の実データ：${info.as_of}。`) : ''
  const title = real
    ? t(`Real data, latest ${info.as_of ?? ''}`, `実データ（最新 ${info.as_of ?? ''}）`)
    : (note
        ? t(note[0], note[1])
        : t(`Partly estimated or demo: real data for ${info.real.length} item(s), the rest is estimated or demo.`, `一部推計・デモ：${info.real.length}件は実データ、残りは推計またはデモ。`)) + latest
  return (
    <span className={`src-badge ${real ? 'real' : 'mixed'}`} title={title}>
      <span className="src-dot" aria-hidden="true"></span>
      <span className="src-label">{real ? t('Real', '実データ') : t('Partly estimated or demo', '一部推計・デモ')}</span>
      {!compact && date && <span className="src-date">· {date}</span>}
    </span>
  )
}
