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

/** ?lang=ja|en wins (a link can open in Japanese), then the viewer's last choice, else English. */
export function readStoredLang(): Lang {
  const q = new URLSearchParams(window.location.search).get('lang')
  if (q === 'ja' || q === 'en') return q
  try {
    const v = window.localStorage.getItem('dhde.lang')
    return v === 'ja' ? 'ja' : 'en'
  } catch {
    return 'en'
  }
}

export function storeLang(l: Lang) {
  try {
    window.localStorage.setItem('dhde.lang', l)
  } catch {
    /* storage blocked: the toggle still works for this visit */
  }
}
