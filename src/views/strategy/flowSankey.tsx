import { useState } from 'react'
import { ResponsiveContainer, Sankey } from 'recharts'
import type { SankeyCard } from '../../types/strategy'
import { useLang } from '../../lib/i18n'
import { S } from './chartTheme'

// One colour per group; origins take their group's colour, stays their own.
const COLOUR: Record<string, string> = { res: '#6f5bd3', out: S[0], for: S[2], day: '#8a94a6', night: S[1] }
const GROUP_OF: Record<string, string> = { fukui: 'res', abroad: 'for' }

const fmtK = (k: number) => (k >= 1000 ? `${(k / 1000).toFixed(2)}M` : `${Math.round(k)}k`)
/** Values are in 億円 (¥100M): 805 → ¥80.5bn. */
const fmtOku = (v: number) => `¥${(v / 10).toFixed(1)}bn`

interface NodeP {
  x: number
  y: number
  width: number
  height: number
  payload: { name: string; value: number; depth: number }
}

interface LinkP {
  sourceX: number
  targetX: number
  sourceY: number
  targetY: number
  sourceControlX: number
  targetControlX: number
  linkWidth: number
  payload: { source: { name: string }; target: { name: string }; estimated?: boolean }
}

/**
 * Visitors (or spend) from origin to group to stay, with estimated links dashed and a small group
 * zoomed. Both measures are laid out in the same cell, the other hidden, so the card keeps one
 * size whichever is picked.
 */
export function FlowSankey({ card }: { card: SankeyCard }) {
  const { t } = useLang()
  const [alt, setAlt] = useState(false)
  return (
    <div>
      {card.alt && (
        <div className="seg" role="group" aria-label={t('Measure', '指標')}>
          <button aria-pressed={!alt} onClick={() => setAlt(false)}>
            {t(card.alt.base_label, card.alt.base_label_ja ?? card.alt.base_label)}
          </button>
          <button aria-pressed={alt} onClick={() => setAlt(true)}>
            {t(card.alt.label, card.alt.label_ja ?? card.alt.label)}
          </button>
        </div>
      )}
      <div className="flow-stack">
        <div className={`flow-view${alt && card.alt ? '' : ' on'}`} aria-hidden={alt && !!card.alt} inert={alt && !!card.alt}>
          <FlowView card={card} alt={false} />
        </div>
        {card.alt && (
          <div className={`flow-view${alt ? ' on' : ''}`} aria-hidden={!alt} inert={!alt}>
            <FlowView card={card} alt />
          </div>
        )}
      </div>
    </div>
  )
}

function FlowView({ card, alt }: { card: SankeyCard; alt: boolean }) {
  const { t } = useLang()
  const view = alt && card.alt ? card.alt : null
  const links = view ? view.links : card.links
  const fmt = view?.unit === 'oku_yen' ? fmtOku : fmtK

  // Only the nodes this view's links use, in the card's order.
  const used = new Set(links.flatMap((l) => [l[0], l[1]]))
  const ids = card.nodes.map((n) => n.id).filter((id) => used.has(id))
  const label = (id: string) => {
    const n = card.nodes.find((x) => x.id === id)
    return n ? t(n.label, n.label_ja ?? n.label) : id
  }
  const data = {
    nodes: ids.map((id) => ({ name: id })),
    links: links.map(([s, tg, v, est]) => ({ source: ids.indexOf(s), target: ids.indexOf(tg), value: v, estimated: Boolean(est) })),
  }
  // Shares: an origin as a share of the group it feeds, everything else of the whole.
  const into = (id: string) => links.filter((l) => l[1] === id).reduce((a, l) => a + l[2], 0)
  const outOf = (id: string) => links.filter((l) => l[0] === id).reduce((a, l) => a + l[2], 0)
  const total = ids.filter((id) => outOf(id) === 0).reduce((a, id) => a + into(id), 0)
  const shareOf = (id: string) => {
    // An origin that shares a middle group with other origins (Kansai → from outside) is a share of that group.
    const feed = into(id) === 0 ? links.find((l) => l[0] === id) : undefined
    const g = feed?.[1]
    const shared = g !== undefined && outOf(g) > 0 && links.filter((l) => l[1] === g).length > 1
    return ((into(id) || outOf(id)) / (shared ? into(g) : total)) * 100
  }
  const colourOf = (id: string) => COLOUR[id] ?? COLOUR[GROUP_OF[id] ?? 'out']

  const Node = ({ x, y, width, height, payload }: NodeP) => {
    const id = payload.name
    const left = payload.depth === 0
    const pct = shareOf(id)
    return (
      <g>
        <rect x={x} y={y} width={width} height={Math.max(height, 2)} fill={colourOf(id)} rx={2} />
        <text x={left ? x - 8 : x + width + 8} y={y + height / 2} textAnchor={left ? 'end' : 'start'} dominantBaseline="middle" className="flow-lbl">
          <tspan fontWeight={650}>{label(id)}</tspan>
          <tspan dx={6} className="flow-num">
            {fmt(into(id) || outOf(id))} · {pct < 1 ? pct.toFixed(1) : Math.round(pct)}%
          </tspan>
        </text>
      </g>
    )
  }

  const Link = ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload }: LinkP) => {
    // Origin → group bands take the group's colour; group → stay bands keep the group's too.
    const group = payload.target.name === 'day' || payload.target.name === 'night' ? payload.source.name : payload.target.name
    const d = `M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`
    return (
      <path
        d={d}
        fill="none"
        stroke={colourOf(group)}
        strokeOpacity={payload.estimated ? 0.9 : 0.32}
        strokeWidth={Math.max(linkWidth, payload.estimated ? 2 : 1)}
        strokeDasharray={payload.estimated ? '4 3' : undefined}
      />
    )
  }

  const insight = view ? (view.insight ? t(view.insight, view.insight_ja ?? view.insight) : null) : card.insight ? t(card.insight, card.insight_ja ?? card.insight) : null

  return (
    <>
      {/* grows to the view's full height (min 420 px), so the shorter view has no gap */}
      <div className="flow-plot">
        <ResponsiveContainer width="100%" height="100%" minHeight={420}>
          <Sankey key={view ? 'alt' : 'base'} data={data} node={Node} link={Link} nodeWidth={12} nodePadding={view ? 28 : 18} sort={false} margin={{ top: 10, right: 200, bottom: 10, left: 230 }} iterations={32} />
        </ResponsiveContainer>
      </div>
      {!view && links.some((l) => l[3]) && (
        <p className="flow-key muted small">
          <span className="flow-dash" aria-hidden="true"></span> {t('Dashed = estimated split. All other bands are published figures.', '破線＝推計の内訳。その他は公表値。')}
        </p>
      )}
      {insight && <p className="flow-insight">{insight}</p>}
      {view?.note && <p className="muted small">{t(view.note, view.note_ja ?? view.note)}</p>}
      {!view && card.zoom && (
        <div className="flow-zoom">
          <h4 className="mini-h">
            {t(card.zoom.label, card.zoom.label_ja ?? card.zoom.label)} · {fmtK(card.zoom.total)}
          </h4>
          {card.zoom.parts.map((p) => (
            <div key={p.label} className="flow-zoom-row">
              <span className="flow-zoom-lab">{t(p.label, p.label_ja ?? p.label)}</span>
              <span className="flow-zoom-track">
                <span className="flow-zoom-fill" style={{ width: `${(p.value / card.zoom!.total) * 100}%`, background: colourOf(/^over|宿泊/i.test(p.label) ? 'night' : 'day') }}></span>
              </span>
              <span className="num small">
                ~{fmtK(p.value)} · {Math.round((p.value / card.zoom!.total) * 100)}% · {t('range', '範囲')} {fmtK(p.low)}–{fmtK(p.high)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
