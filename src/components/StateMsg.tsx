import { useLang } from '../lib/i18n'

export function Loading({ what }: { what: string }) {
  return (
    <div className="state-msg" role="status">
      <div>
        <div className="spinner" aria-hidden="true"></div>
        {what}
      </div>
    </div>
  )
}

export function LoadError({ file, error }: { file: string; error: Error | null }) {
  const { t } = useLang()
  return (
    <div className="state-msg error" role="alert">
      <div>
        <p>
          {t(
            `Could not load data/${file}. Make sure this file is served alongside index.html.`,
            null,
            `تعذّر تحميل data/${file}. تأكد من نشر هذا الملف مع index.html.`,
          )}
        </p>
        <p className="muted">{error ? error.message : t('Unknown error', null, 'خطأ غير معروف')}</p>
      </div>
    </div>
  )
}
