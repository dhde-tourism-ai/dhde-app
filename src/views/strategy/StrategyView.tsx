import { useEffect, useMemo, useState } from 'react'
import type { StrategicQuestion, StrategicQuestions } from '../../types/strategy'
import { AsOf } from '../../components/AsOf'
import { PillLegend, StatusPill } from '../../components/StatusPill'
import { useLang } from '../../lib/i18n'
import { StrategyCardView } from './cards'
import { useJsonResource } from '../../hooks/useJsonResource'
import { withMeasuredShares } from '../../lib/monthly'
import { localize } from '../../lib/localize'
import { withRealForecast } from '../../lib/dailyForecast'
import type { RealDailyFile } from '../../lib/dailyForecast'
import JA from '../../i18n/strategy.ja.json'
import type { MonthlyForecastFile } from '../../types/monthly'
import '../../styles/pages.css'

/**
 * The five strategic questions as dashboard components. Layout only: every
 * number comes from public/data/strategic_questions.json.
 */
export default function StrategyView({ data: raw, focus }: { data: StrategicQuestions; focus?: string }) {
  const { t, lang } = useLang()
  const [showSpecs, setShowSpecs] = useState(false)
  const [activeQ, setActiveQ] = useState(raw.questions[0]?.id)
  const monthly = useJsonResource<MonthlyForecastFile>('monthly_forecast.json').data
  const real = useJsonResource<RealDailyFile>('real_data.json').data
  // Real 2025 shares and the real 7-day forecast first, then the Japanese text (strategy.ja.json) when the page is in Japanese.
  const data = useMemo(() => {
    const measured = { ...raw, questions: withRealForecast(withMeasuredShares(raw.questions, monthly, lang), real, lang) }
    return lang === 'ja' ? localize(measured, JA as Record<string, string>) : measured
  }, [raw, monthly, real, lang])
  const { meta, equation, questions } = data

  // #/strategy/<question or card id> (the FAQ links) scrolls to it and flashes it.
  useEffect(() => {
    if (!focus) return
    const el = document.getElementById(focus)
    if (!el) return
    // A whole question is taller than the screen: bring its top into view.
    el.scrollIntoView({ block: el.classList.contains('q-section') ? 'start' : 'center' })
    el.classList.add('flash')
    const id = window.setTimeout(() => el.classList.remove('flash'), 1800)
    return () => window.clearTimeout(id)
  }, [focus])

  // Scroll-spy for the sticky question nav.
  useEffect(() => {
    const els = data.questions.map((q) => document.getElementById(q.id)).filter((e): e is HTMLElement => !!e)
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setActiveQ(vis[0].target.id)
      },
      { rootMargin: '-120px 0px -55% 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [data])

  return (
    <div className="page strategy">
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('Strategy', '戦略')}</div>
          <h1 className="page-title">{meta.title}</h1>
          <p className="page-sub">
            {meta.subtitle} · <AsOf as_of={meta.as_of} />
          </p>
        </div>
        <label className="spec-toggle">
          <span className="switch">
            <input type="checkbox" checked={showSpecs} onChange={(e) => setShowSpecs(e.target.checked)} />
            <span className="switch-track"></span>
          </span>
          {t('Show build specs', 'ビルド仕様を表示')}
        </label>
      </div>

      <div className="card strat-legend">
        <PillLegend labels={data.pills} />
      </div>

      <section className="card equation" aria-label={t('Revenue equation', '観光消費の式')}>
        <div className="eq-head">
          <h2 className="card-title">{t('How the total is built', '観光消費額の構成')}</h2>
          <StatusPill status={equation.status} />
        </div>
        <div className="eq-terms">
          {equation.terms.map((term, i) => (
            <div key={i} className="eq-part">
              <div className={`eq-term ${term.value_text === null ? 'pending' : ''} ${term.op === null ? 'total' : ''}`}>
                <span className="eq-value">{term.value_text ?? '[x]'}</span>
                <span className="eq-label">{term.label}</span>
              </div>
              {term.op && (
                <span className="eq-op" aria-hidden="true">
                  {term.op}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <nav className="q-nav" aria-label={t('Questions', '設問')}>
        {data.questions.map((q) => (
          <a
            key={q.id}
            href="#/strategy"
            className={activeQ === q.id ? 'on' : ''}
            aria-current={activeQ === q.id ? 'true' : undefined}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(q.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            <span className="q-num">Q{q.number}</span>
            <span className="q-nav-label">{q.nav}</span>
          </a>
        ))}
      </nav>

      {questions.map((q) => (
        <QuestionSection key={q.id} q={q} showSpecs={showSpecs} />
      ))}

    </div>
  )
}

/** Questions shown lean: just the title, figures and charts (no why line, sub-question chips, answer paragraph, card details, notes or sources). */
const LEAN_QUESTIONS = new Set(['q1', 'q5'])

function QuestionSection({ q, showSpecs }: { q: StrategicQuestion; showSpecs: boolean }) {
  const { t } = useLang()
  const lean = LEAN_QUESTIONS.has(q.id)
  return (
    <section className="q-section" id={q.id} aria-labelledby={`${q.id}-title`}>
      <header className="q-head">
        <span className="q-badge">Q{q.number}</span>
        <div>
          <h2 className="q-title" id={`${q.id}-title`}>
            {q.title}
          </h2>
          {!lean && (
            <>
              <p className="q-why">{q.why}</p>
              <div className="q-subs">
                {q.subs.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </header>
      {!lean && (
        <div className="answer">
          <span className="answer-label">{t('Answer today', '現時点の回答')}</span>
          <p>{q.answer}</p>
        </div>
      )}
      <div className="card-grid">
        {q.cards
          .filter((c) => !c.hidden)
          .map((c) => (
            <StrategyCardView key={c.id} card={c} lean={lean} />
          ))}
      </div>
      {showSpecs && (
        <div className="spec">
          <div className="spec-title">{t('Build spec', 'ビルド仕様')}</div>
          <dl>
            <dt>{t('Data', 'データ')}</dt>
            <dd>{q.spec.data}</dd>
            <dt>{t('Model', 'モデル')}</dt>
            <dd>{q.spec.model}</dd>
            <dt>{t('Outputs', '出力')}</dt>
            <dd>{q.spec.outputs}</dd>
            <dt>{t('Acceptance test', '受入基準')}</dt>
            <dd>{q.spec.acceptance}</dd>
            <dt>{t('Status', '状況')}</dt>
            <dd>{q.spec.status}</dd>
          </dl>
        </div>
      )}
    </section>
  )
}
