import { useEffect, useState } from 'react'

const Q = '(max-width: 720px)'

/** True on phone widths (the map switches to a bottom sheet and tap popups). */
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(Q).matches)
  useEffect(() => {
    const m = window.matchMedia(Q)
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return narrow
}
