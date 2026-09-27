import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LangContext, readStoredLang, storeLang } from '../lib/i18n'
import type { Lang } from '../lib/i18n'

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    storeLang(l)
  }, [])
  const value = useMemo(
    () => ({ lang, setLang, t: (en: string, ja?: string | null) => (lang === 'ja' && ja ? ja : en) }),
    [lang, setLang],
  )
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}
