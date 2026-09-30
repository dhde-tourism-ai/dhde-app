import { useLang } from '../lib/i18n'

/**
 * Placeholder for a screen fed by KDDI location data, which is not bought yet.
 * It never shows a number: the screen is built, the data is pending.
 */
export function KddiPending() {
  const { t } = useLang()
  return (
    <span className="pill pill-pending kddi-pending" title={t('Shown once the KDDI location data is purchased. No numbers are estimated here.', 'KDDI位置情報データの購入後に表示します。ここでは数値を推計しません。')}>
      <span className="pill-dot" aria-hidden="true"></span>
      {t('Pending: KDDI data', 'KDDIデータ待ち')}
    </span>
  )
}
