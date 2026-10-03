import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'dhde.theme'
const listeners = new Set<() => void>()

/** ?theme=light|dark wins (shareable), then the viewer's last choice, else light: the presentation default. */
function initial(): Theme {
  const q = new URLSearchParams(window.location.search).get('theme')
  if (q === 'light' || q === 'dark') return q
  try {
    const saved = window.localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* storage blocked: fall through to the default */
  }
  return 'light'
}

let current: Theme = initial()
document.documentElement.dataset.theme = current

export function setTheme(t: Theme) {
  current = t
  document.documentElement.dataset.theme = t
  try {
    window.localStorage.setItem(KEY, t)
  } catch {
    /* storage blocked: the choice still holds for this visit */
  }
  listeners.forEach((l) => l())
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
