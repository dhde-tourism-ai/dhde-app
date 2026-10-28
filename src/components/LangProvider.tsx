import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LangContext, readStoredLang, storeLang } from '../lib/i18n'
import type { Lang } from '../lib/i18n'
import AR from '../i18n/ar.json'

const ar = AR as Record<string, string>

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    storeLang(l)
  }, [])
  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (en: string, ja?: string | null, arText?: string | null) =>
        lang === 'ja' && ja ? ja : lang === 'ar' ? (arText ?? ar[en] ?? en) : en,
    }),
    [lang, setLang],
  )
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}
