import type { ReactNode } from 'react'
import type { AlertGroups } from '../../../lib/alerts'
import type { MapNode } from '../../../lib/nodes'
import type { LiveData } from '../../../types/live'
import { dayLabel } from '../../../lib/live'
import { LEVEL } from '../../../lib/briefing'
import type { DayFigure } from '../../../lib/briefing'
import { useLang } from '../../../lib/i18n'
import { Icon } from '../../../components/icons'
import { Group } from './AlertsPanel'

/**
 * Briefing mode's right-hand panel: each site's visitors for the selected day (real, or the
 * model's forecast), real JMA warnings, and sites running ahead of forecast. Simulated hourly
 * crowding, demo traffic and reroutes are left out.
 */
export function BriefingBoard({
  live,
  day,
  figures,
  alerts,
  nodes,
  onSelect,
  onClose,
  tabs,
}: {
  live: LiveData
  day: number
  figures: Record<string, DayFigure>
  alerts: AlertGroups | null
  nodes: MapNode[]
  onSelect: (id: string) => void
  onClose?: () => void
  tabs?: ReactNode
}) {
  const { t, lang } = useLang()
  const rows = nodes.filter((n) => figures[n.id])
  const counted = rows.filter((n) => figures[n.id].value !== null)
  const total = counted.reduce((a, n) => a + (figures[n.id].value ?? 0), 0)
  const anyForecast = counted.some((n) => figures[n.id].kind === 'forecast')
  const demoWx = new Set(live.weather_alerts.filter((a) => a.demo).map((a) => a.id))
  const weather = (alerts?.weather ?? []).filter((a) => !demoWx.has(a.id))
  // "Running ahead, add staff this afternoon" is advice for today, not for a past or future day.
  const ahead = day === (live.today_day ?? -1) ? (alerts?.insights ?? []).filter((a) => a.id.startsWith('ahead-')) : []

  return (
    <section className="float-panel alerts-panel" aria-label={t('Today at a glance', '本日の概況')}>
      <header className="fp-head">
        {tabs ?? (
          <h2 className="fp-title">
            <Icon name="alert" /> {t('Today at a glance', '本日の概況')}
          </h2>
        )}
        {onClose && (
          <button className="icon-btn fp-close" onClick={onClose} aria-label={t('Close', '閉じる')}>
            <Icon name="close" />
          </button>
        )}
      </header>
      <div className="fp-body">
        <div className="board">
          <div className="board-total">
            <span className="eyebrow">
              {anyForecast ? t(`Visitors forecast, ${dayLabel(live, day, 'en')}`, `来訪者予測 ${dayLabel(live, day, 'ja')}`) : t(`Visitors, ${dayLabel(live, day, 'en')}`, `来訪者数 ${dayLabel(live, day, 'ja')}`)}
              {' · '}
              {lang === 'ja' ? `${counted.length}地点` : `${counted.length} sites`}
            </span>
            <span className="board-num">{counted.length ? Math.round(total).toLocaleString('en-US') : '–'}</span>
          </div>
          <ul className="board-list">
            {rows.map((n) => {
              const f = figures[n.id]
              return (
                <li key={n.id}>
                  <button className="board-row" onClick={() => onSelect(n.id)}>
                    <span className="sw" style={{ background: f.level ? LEVEL[f.level].colour : 'transparent', boxShadow: f.level ? undefined : 'inset 0 0 0 1.5px var(--muted)' }} aria-hidden="true"></span>
                    <span className="board-name">{t(n.name.replace(' East Entrance', ''), n.name_ja)}</span>
                    <span className="board-tier">
                      {f.level ? t(LEVEL[f.level].en, LEVEL[f.level].ja) : f.kind === 'no_estimate' ? t('no count yet', '人数未推計') : t('no forecast yet', '予測なし')}
                    </span>
                    <span className="board-val num">{f.value !== null ? Math.round(f.value).toLocaleString('en-US') : '–'}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="board-note">
            {t(
              'Past days: estimates from real counts. Later days: the forecast model. "Usual" is each site\'s average real day.',
              '過去の日：実測からの推計。以降の日：予測モデル。「通常」は各地点の実データの平均日。',
            )}
          </p>
        </div>
        <Group title={t('Weather warnings (JMA)', '気象警報・注意報（気象庁）')} icon="weather" items={weather} empty={t('No warnings in force.', '発表中の警報・注意報はありません。')} onPick={onSelect} />
        {ahead.length > 0 && <Group title={t('Running ahead of forecast', '予測を上回る地点')} icon="info" items={ahead} empty="" onPick={onSelect} />}
      </div>
    </section>
  )
}
