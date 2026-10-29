import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LangContext, pick, readStoredLang, storeLang } from '../lib/i18n'
import type { Lang } from '../lib/i18n'
import { arabicDigits } from '../lib/arabicDigits'

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    if (lang === 'ar') return arabicDigits(document.body)
  }, [lang])
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    storeLang(l)
  }, [])
  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (en: string, ja?: string | null, ar?: string | null) => pick(lang, en, ja, ar),
    }),
    [lang, setLang],
  )
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}
