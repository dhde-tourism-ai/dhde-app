import { useState } from 'react'
import type { ReactNode } from 'react'
import type { LiveData } from '../../../types/live'
import type { Nudge } from '../../../lib/nudges'
import { LOOP_LABEL } from '../../../lib/nudges'
import { SEV_COLOUR } from '../../../lib/alerts'
import { dayLabel, hourLabel } from '../../../lib/live'
import { useLang } from '../../../lib/i18n'
import { Icon } from '../../../components/icons'
import { SourceBadge } from '../../../components/SourceBadge'
import type { SourceInfo } from '../../../types/live'

const SEV_LABEL = { crit: ['Critical', '重大'], serious: ['High', '高'], warn: ['Medium', '中'], info: ['Opportunity', '機会'] } as const

interface Props {
  nudges: Nudge[]
  /** All nudges in the window before the top-3-per-day filter. */
  total: number
  showAll: boolean
  setShowAll: (v: boolean) => void
  live: LiveData
  day: number
  activeId?: string
  onPick: (n: Nudge) => void
  tabs: ReactNode
  source?: SourceInfo
  onClose?: () => void
}

/** The three nudge loops as an actionable list; clicking one focuses the map and timeline. */
export function NudgesPanel({ nudges, total, showAll, setShowAll, live, day, activeId, onPick, tabs, source, onClose }: Props) {
  const { t, lang } = useLang()
  const [loop, setLoop] = useState<0 | 1 | 2 | 3>(0)
  const list = nudges.filter((n) => loop === 0 || n.loop === loop)
  const count = (l: 1 | 2 | 3) => nudges.filter((n) => n.loop === l).length

  return (
    <section className="float-panel nudges-panel" aria-label={t('Nudges', 'ナッジ')}>
      <header className="fp-head">
        {tabs}
        <SourceBadge info={source} compact />
        {onClose && (
          <button className="icon-btn fp-close" onClick={onClose} aria-label={t('Close', '閉じる')}>
            <Icon name="close" />
          </button>
        )}
      </header>
      <div className="fp-body">
        <div className="seg nudge-filter" role="group" aria-label={t('Nudge loop', 'ナッジの種類')}>
          <button aria-pressed={loop === 0} onClick={() => setLoop(0)}>
            {t('All', 'すべて')} {nudges.length}
          </button>
          {([1, 2, 3] as const).map((l) => (
            <button key={l} aria-pressed={loop === l} onClick={() => setLoop(l)}>
              #{l} {t(LOOP_LABEL[l].en, LOOP_LABEL[l].ja)} {count(l)}
            </button>
          ))}
        </div>
        <div className="nudge-scope">
          <p className="lg-note">
            {showAll
              ? t('All nudges from the selected day onward.', '選択日以降のすべてのナッジ。')
              : t('Top 3 per day by severity, then size of deviation. Map flags follow this list.', '1日あたり上位3件（重要度・乖離の大きさ順）。地図の旗も同じ。')}
          </p>
          {total > nudges.length || showAll ? (
            <button className="btn btn-ghost nudge-all" aria-pressed={showAll} onClick={() => setShowAll(!showAll)}>
              {showAll ? t('Top 3 per day', '1日上位3件') : `${t('Show all', 'すべて表示')} (${total})`}
            </button>
          ) : null}
        </div>
        {list.length === 0 ? (
          <p className="al-empty">{t('No nudges for this window.', 'この期間のナッジはありません。')}</p>
        ) : (
          <ul className="nudge-list">
            {list.map((n) => (
              <li key={n.id}>
                <button className={`nudge-card ${n.id === activeId ? 'on' : ''} ${n.day === day ? 'today' : ''}`} onClick={() => onPick(n)}>
                  <div className="nc-top">
                    <span className="nc-sev">
                      <i style={{ background: SEV_COLOUR[n.sev] }} aria-hidden="true"></i>
                      {t(SEV_LABEL[n.sev][0], SEV_LABEL[n.sev][1])}
                    </span>
                    <span className="nc-loop">
                      #{n.loop} {t(LOOP_LABEL[n.loop].en, LOOP_LABEL[n.loop].ja)}
                    </span>
                    <span className="nc-time num">
                      {dayLabel(live, n.day, lang, true)} {hourLabel(n.start)}
                    </span>
                  </div>
                  <div className="nc-title">{t(n.title_en, n.title_ja)}</div>
                  <div className="nc-row">
                    <span className="nc-k">{t('Why', '根拠')}</span>
                    <span>{t(n.reason_en, n.reason_ja)}</span>
                  </div>
                  <div className="nc-row">
                    <span className="nc-k">{t('Do', '対応')}</span>
                    <span className="nc-action">{t(n.action_en, n.action_ja)}</span>
                  </div>
                  <div className="nc-foot">
                    {n.real ? (
                      <span className="pill pill-modelled">
                        <span className="pill-dot" aria-hidden="true"></span>
                        {t('Real data + forecast', '実データ＋予測')}
                      </span>
                    ) : (
                      <span className="pill pill-illustrative">
                        <span className="pill-dot" aria-hidden="true"></span>
                        {t('Demo', 'デモ')}
                      </span>
                    )}
                    <span className="nc-focus">
                      {t('Show on map', '地図で見る')} <Icon name="chevron" size={12} />
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
