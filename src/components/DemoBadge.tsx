import { useLang } from '../lib/i18n'
import { useBriefing } from '../lib/briefing'
import { Icon } from './icons'

/**
 * Shown wherever a layer or panel runs on simulated data (live_demo.json with demo: true).
 * Briefing mode hides demo content altogether, so it has nothing to mark.
 */
export function DemoBadge({ compact = false }: { compact?: boolean }) {
  const { t } = useLang()
  const briefing = useBriefing()
  if (briefing) return null
  return (
    <span className="demo-badge" title={t('Simulated data for layout and interaction. Not observations; do not quote.', 'レイアウト確認用の模擬データです。実測値ではありません。引用しないでください。')}>
      <Icon name="lab" size={11} />
      {compact ? t('Demo', 'デモ') : t('Demo data', 'デモデータ')}
    </span>
  )
}
