import type { ReactNode } from 'react'
import { useLang } from '../../lib/i18n'

/** One exhibit: number, action title (the finding), what is measured, the body, and its source. */
export function Exhibit({
  n,
  title,
  sub,
  actions,
  source,
  children,
}: {
  n: number
  title: string
  sub: string
  actions?: ReactNode
  source: ReactNode
  children: ReactNode
}) {
  const { t } = useLang()
  return (
    <section className="tx-exhibit" aria-labelledby={`tx-ex-${n}`} id={`tx-exhibit-${n}`}>
      <header className="tx-ex-head">
        <div>
          <div className="tx-ex-n">{t(`Exhibit ${n}`, `図表${n}`)}</div>
          <h2 id={`tx-ex-${n}`} className="tx-ex-title">
            {title}
          </h2>
          <p className="tx-ex-sub">{sub}</p>
        </div>
        {actions}
      </header>
      <div className="tx-ex-body">{children}</div>
      <footer className="tx-ex-source">{source}</footer>
    </section>
  )
}
