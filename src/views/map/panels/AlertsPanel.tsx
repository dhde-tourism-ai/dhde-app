import type { AlertGroups, AlertItem } from '../../../lib/alerts'
import { SEV_COLOUR } from '../../../lib/alerts'
import { useLang } from '../../../lib/i18n'
import { Icon } from '../../../components/icons'
import type { IconName } from '../../../lib/icons'
import { DemoBadge } from '../../../components/DemoBadge'
import type { NodeFrame } from '../../../lib/live'
import type { MapNode } from '../../../lib/nodes'

const SEV_LABEL = {
  crit: ['Critical', '重大'],
  serious: ['Serious', '警戒'],
  warn: ['Advisory', '注意'],
  info: ['Info', '情報'],
} as const

function Group({ title, icon, items, empty, onPick }: { title: string; icon: IconName; items: AlertItem[]; empty: string; onPick: (id: string) => void }) {
  const { t } = useLang()
  return (
    <div className="al-group">
      <h3 className="al-title">
        <Icon name={icon} size={14} /> {title}
        {items.length > 0 && <span className="al-count">{items.length}</span>}
      </h3>
      {items.length === 0 ? (
        <p className="al-empty">{empty}</p>
      ) : (
        <ul className="al-list">
          {items.map((a) => {
            const body = (
              <>
                <span className="al-sev" style={{ background: SEV_COLOUR[a.sev] }} aria-hidden="true"></span>
                <span className="al-text">
                  <span className="sr-only">{t(SEV_LABEL[a.sev][0], SEV_LABEL[a.sev][1])}: </span>
                  {t(a.en, a.ja)}
                </span>
              </>
            )
            return (
              <li key={a.id}>
                {a.node ? (
                  <button className="al-item" onClick={() => onPick(a.node!)}>
                    {body}
                  </button>
                ) : (
                  <div className="al-item">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

interface Props {
  alerts: AlertGroups
  nodes: MapNode[]
  frame: Record<string, NodeFrame> | null
  isDemo: boolean
  onSelect: (id: string) => void
  onClose?: () => void
}

/** Right-hand panel when no node is selected: node board plus traffic, weather and operator alerts. */
export function AlertsPanel({ alerts, nodes, frame, isDemo, onSelect, onClose }: Props) {
  const { t } = useLang()
  const total = frame ? Object.values(frame).reduce((a, f) => a + f.onSite, 0) : 0
  return (
    <section className="float-panel alerts-panel" aria-label={t('Live board', 'ライブボード')}>
      <header className="fp-head">
        <h2 className="fp-title">
          <Icon name="alert" /> {t('Live board', 'ライブボード')}
        </h2>
        {isDemo && <DemoBadge />}
        {onClose && (
          <button className="icon-btn fp-close" onClick={onClose} aria-label={t('Close', '閉じる')}>
            <Icon name="close" />
          </button>
        )}
      </header>
      <div className="fp-body">
        {frame && (
          <div className="board">
            <div className="board-total">
              <span className="eyebrow">{t('People on site, six nodes', '6ノードの現地人数')}</span>
              <span className="board-num">{Math.round(total).toLocaleString()}</span>
            </div>
            <ul className="board-list">
              {nodes
                .filter((n) => frame[n.id])
                .map((n) => {
                  const f = frame[n.id]
                  return (
                    <li key={n.id}>
                      <button className="board-row" onClick={() => onSelect(n.id)}>
                        <span className="sw" style={{ background: f.tier.colour }} aria-hidden="true"></span>
                        <span className="board-name">{t(n.name.replace(' East Entrance', ''), n.name_ja)}</span>
                        <span className="board-tier">{t(f.tier.label, f.tier.label_ja)}</span>
                        <span className="board-val num">
                          {f.observed ? '' : '~'}
                          {Math.round(f.onSite).toLocaleString()}
                        </span>
                      </button>
                    </li>
                  )
                })}
            </ul>
          </div>
        )}
        <Group title={t('Traffic alerts', '交通アラート')} icon="traffic" items={alerts.traffic} empty={t('Roads flowing freely.', '道路は順調です。')} onPick={onSelect} />
        <Group title={t('Weather alerts', '気象アラート')} icon="weather" items={alerts.weather} empty={t('No advisories in force.', '発表中の注意報はありません。')} onPick={onSelect} />
        <Group title={t('Crowding', '混雑')} icon="people" items={alerts.crowd} empty={t('All sites comfortable.', 'すべて快適です。')} onPick={onSelect} />
        <Group title={t('For operators', '事業者向け')} icon="info" items={alerts.insights} empty={t('Nothing to act on.', '対応事項はありません。')} onPick={onSelect} />
      </div>
    </section>
  )
}
