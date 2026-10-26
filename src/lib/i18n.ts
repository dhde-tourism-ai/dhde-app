import { createContext, useContext } from 'react'

export type Lang = 'en' | 'ja'

export interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  /** Pick the string for the active language (falls back to English). */
  t: (en: string, ja?: string | null) => string
}

export const LangContext = createContext<LangCtx>({
  lang: 'en',
  setLang: () => {},
  t: (en) => en,
})

export function useLang(): LangCtx {
  return useContext(LangContext)
}

/** The stored choice; with none, Japanese for a partner site page (#/site/...) and English elsewhere. */
export function readStoredLang(): Lang {
  const fallback: Lang = window.location.hash.startsWith('#/site/') ? 'ja' : 'en'
  try {
    const v = window.localStorage.getItem('dhde.lang')
    return v === 'ja' || v === 'en' ? v : fallback
  } catch {
    return fallback
  }
}

export function storeLang(l: Lang) {
  try {
    window.localStorage.setItem('dhde.lang', l)
  } catch {
    /* storage blocked: the toggle still works for this visit */
  }
}
