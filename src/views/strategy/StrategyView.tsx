import { useState } from 'react'
import type { StrategicQuestion, StrategicQuestions } from '../../types/strategy'
import { AsOf } from '../../components/AsOf'
import { PillLegend, StatusPill } from '../../components/StatusPill'
import { StrategyCardView } from './cards'

/**
 * Port of Gabriella's "Fukui Tourism Intelligence · five questions" pilot.
 * Layout only: every number comes from public/data/strategic_questions.json.
 */
export default function StrategyView({ data }: { data: StrategicQuestions }) {
  const [showSpecs, setShowSpecs] = useState(false)
  const { meta, equation } = data

  return (
    <div className="strategy">
      <section className="panel strat-head">
        <div className="section-head">
          <div>
            <div className="section-title">{meta.title}</div>
            <div className="section-sub">
              {meta.subtitle} · <AsOf as_of={meta.as_of} /> · {meta.author}
            </div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={showSpecs} onChange={(e) => setShowSpecs(e.target.checked)} />
            Show build specs
          </label>
        </div>
        <PillLegend labels={data.pills} />

        <div className="equation">
          <div className="equation-terms">
            {equation.terms.map((t, i) => (
              <span key={i} className="eq-term-wrap">
                <span className={`eq-term ${t.value_text === null ? 'pending' : ''}`}>
                  <span className="eq-value">{t.value_text ?? '[x]'}</span>
                  <span className="eq-label">{t.label}</span>
                </span>
                {t.op && <span className="eq-op">{t.op}</span>}
              </span>
            ))}
            <StatusPill status={equation.status} />
          </div>
          <p className="equation-caption">{equation.caption}</p>
        </div>

        {data.todos.map((t, i) => (
          <div key={i} className="todo-box">
            <strong>TODO for {t.for}:</strong> {t.text}
          </div>
        ))}
      </section>

      <nav className="strat-nav" aria-label="Questions">
        {data.questions.map((q) => (
          <a key={q.id} href={`#/strategy`} onClick={(e) => { e.preventDefault(); document.getElementById(q.id)?.scrollIntoView({ behavior: 'smooth' }) }}>
            <span className="q-num">Q{q.number}</span> {q.nav}
          </a>
        ))}
      </nav>

      {data.questions.map((q) => (
        <QuestionSection key={q.id} q={q} showSpecs={showSpecs} />
      ))}

      <section className="panel strat-foot">
        <p>{meta.footer}</p>
        <p className="small">Source: {meta.source_doc}</p>
      </section>
    </div>
  )
}

function QuestionSection({ q, showSpecs }: { q: StrategicQuestion; showSpecs: boolean }) {
  return (
    <section className="panel strat-q" id={q.id}>
      <div className="q-head">
        <span className="q-badge">Q{q.number}</span>
        <div>
          <h2 className="section-title">{q.title}</h2>
          <p className="q-why">{q.why}</p>
        </div>
      </div>
      <div className="q-subs">
        {q.subs.map((s) => (
          <span key={s} className="chip">
            {s}
          </span>
        ))}
      </div>
      <div className="answer">
        <div className="answer-label">Answer today</div>
        <div>{q.answer}</div>
      </div>
      <div className="card-grid">
        {q.cards.map((c) => (
          <StrategyCardView key={c.id} card={c} />
        ))}
      </div>
      {showSpecs && (
        <div className="spec">
          <div className="spec-title">Build spec</div>
          <dl>
            <dt>Data</dt>
            <dd>{q.spec.data}</dd>
            <dt>Model</dt>
            <dd>{q.spec.model}</dd>
            <dt>Outputs</dt>
            <dd>{q.spec.outputs}</dd>
            <dt>Acceptance test</dt>
            <dd>{q.spec.acceptance}</dd>
            <dt>Status</dt>
            <dd>{q.spec.status}</dd>
          </dl>
        </div>
      )}
    </section>
  )
}
