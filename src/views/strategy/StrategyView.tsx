import { useEffect, useMemo, useState } from 'react'
import type { StrategicQuestion, StrategicQuestions } from '../../types/strategy'
import { AsOf } from '../../components/AsOf'
import { StatusPill } from '../../components/StatusPill'
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

/** Questions shown lean: just the title, figures and charts (no why line, sub-question chips, answer paragraph, card badges, details, notes or sources). */
const LEAN_QUESTIONS = new Set(['q1', 'q5'])
/** Questions shown with just their title and cards: no why line, sub-question chips or answer paragraph. */
const NO_INTRO = new Set(['q2', 'q3', 'q4'])

function QuestionSection({ q, showSpecs }: { q: StrategicQuestion; showSpecs: boolean }) {
  const { t } = useLang()
  const lean = LEAN_QUESTIONS.has(q.id)
  const noIntro = lean || NO_INTRO.has(q.id)
  const themes = q.themes ?? []
  const [picked, setTheme] = useState<string | undefined>(undefined)
  const theme = themes.find((th) => th.id === picked)?.id ?? themes[0]?.id ?? ''
  const cards = q.cards.filter((c) => !c.hidden)
  // Cards with a group (Q2-Q4): one group at a time, picked from tabs like Q1's, in the order
  // their first card appears. Questions with themes (Q1, Q5) use their own theme tabs.
  const groups = themes.length ? [] : [...new Set(cards.map((c) => c.group).filter((g): g is string => !!g))]
  const [group, setGroup] = useState<string | undefined>(undefined)
  const shownGroup = groups.length > 1 ? (groups.includes(group ?? '') ? group : groups[0]) : undefined
  return (
    <section className="q-section" id={q.id} aria-labelledby={`${q.id}-title`}>
      <header className="q-head">
        <span className="q-badge">Q{q.number}</span>
        <div>
          <h2 className="q-title" id={`${q.id}-title`}>
            {q.title}
          </h2>
          {!noIntro && q.why && <p className="q-why">{q.why}</p>}
          {!noIntro && q.subs.length > 0 && (
            <div className="q-subs">
              {q.subs.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>
      {!noIntro && (
        <div className="answer">
          <span className="answer-label">{t('Answer today', '現時点の回答')}</span>
          <p>{q.answer}</p>
        </div>
      )}
      {shownGroup !== undefined && (
        <div className="q-themes seg" role="tablist" aria-label={t('Themes', 'テーマ')}>
          {groups.map((g) => (
            <button key={g} role="tab" aria-selected={shownGroup === g} aria-pressed={shownGroup === g} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>
      )}
      {shownGroup !== undefined && (
        // Every group is laid out in the same cell, the others hidden, so the panel is as tall as
        // the tallest group and its cards stretch to it: the cards keep one size whichever tab is on.
        <div className="q-group-stack" role="tabpanel">
          {groups.map((g) => (
            <div key={g} className={`card-grid q-group${g === shownGroup ? ' on' : ''}`} aria-hidden={g !== shownGroup} inert={g !== shownGroup}>
              {cards
                .filter((c) => !c.group || c.group === g)
                .map((c) => (
                  <StrategyCardView key={c.id} card={c} lean={lean} />
                ))}
            </div>
          ))}
        </div>
      )}
      {shownGroup === undefined && (() => {
        const fixed = cards.filter((c) => !themes.length || !c.theme)
        const inTheme = themes.length ? cards.filter((c) => c.theme?.includes(theme)) : []
        return (
          <>
            {fixed.length > 0 && (
              <div className="card-grid">
                {fixed.map((c) => (
                  <StrategyCardView key={c.id} card={c} lean={lean} />
                ))}
              </div>
            )}
            {themes.length > 0 && (
              <>
                <div className="q-themes seg" role="tablist" aria-label={t('Themes', 'テーマ')}>
                  {themes.map((th) => (
                    <button key={th.id} role="tab" aria-selected={theme === th.id} aria-pressed={theme === th.id} onClick={() => setTheme(th.id)}>
                      {th.label}
                    </button>
                  ))}
                </div>
                <div className="card-grid" role="tabpanel">
                  {inTheme.map((c) => (
                    <StrategyCardView key={c.id} card={c} lean={lean} theme={theme} />
                  ))}
                </div>
              </>
            )}
          </>
        )
      })()}
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
