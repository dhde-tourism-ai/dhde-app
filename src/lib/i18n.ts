import { createContext, useContext } from 'react'

export type Lang = 'en' | 'ja' | 'ar'

export interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  /** Pick the string for the active language (falls back to English). Arabic comes from `ar`, then ar.json by the English text. */
  t: (en: string, ja?: string | null, ar?: string | null) => string
}

// Arabic text by its English string: ar.json plus one ar.<area>.json per part of the app.
const AR_TEXT: Record<string, string> = Object.assign(
  {},
  ...Object.values(import.meta.glob<Record<string, string>>('../i18n/ar*.json', { eager: true, import: 'default' })),
)

/** Arabic for an English string from the ar*.json files, or undefined. */
export const arText = (en: string): string | undefined => AR_TEXT[en]

/** The text for `lang`: Japanese when given, Arabic from `ar` or ar.json by the English text, else English. */
export function pick(lang: Lang, en: string, ja?: string | null, ar?: string | null): string {
  if (lang === 'ja') return ja || en
  if (lang === 'ar') return ar ?? AR_TEXT[en] ?? en
  return en
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
    return v === 'ja' || v === 'en' || v === 'ar' ? v : fallback
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
