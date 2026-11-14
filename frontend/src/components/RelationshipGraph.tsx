import { useMemo, useState } from 'react'
import type { Channel, Graph, GraphEdge, PersonId } from '../api'
import { PEOPLE, ROWS, personColor, personName } from '../mock/data'
import { fmtDate } from '../lib/format'

export const CHANNEL_STYLE: Record<Channel, { stroke: string; dash?: string; label: string; order: number }> = {
  call: { stroke: 'var(--ink-2)', label: 'Calls', order: 0 },
  message: { stroke: 'var(--ink-2)', dash: '2 4', label: 'Texts', order: 1 },
  transfer: { stroke: 'var(--accent)', label: 'Money', order: 2 },
  colocation: { stroke: 'var(--amber)', dash: '8 5', label: 'Together, no contact', order: 3 },
  deleted_thread: { stroke: 'var(--serious)', dash: '6 4', label: 'Thread deleted', order: 4 },
  hostile: { stroke: 'var(--serious)', label: 'Hostile posts', order: 5 },
  social: { stroke: 'var(--ink-3)', dash: '1 3', label: 'Follows / likes', order: 6 },
}

/** Fixed layout: the victim in the centre, persons of interest around. */
const POS: Record<PersonId, [number, number]> = { ravi: [380, 245], paul: [110, 85], amy: [650, 85], ken: [650, 390], cara: [110, 390] }

export interface EdgeView extends GraphEdge {
  n: number
  ids: string[]
}

/** Count each edge's interactions inside [from, to] (ISO strings), using the timestamps of its evidence rows. */
export function edgesInWindow(graph: Graph, from: string, to: string): EdgeView[] {
  return graph.edges
    .map((e) => {
      const rows = e.evidence_ids.map((id) => ROWS.get(id)).filter((r): r is NonNullable<typeof r> => !!r && r.timestamp >= from && r.timestamp <= to)
      const distinct = e.channel === 'colocation' ? new Set(rows.map((r) => r.timestamp.slice(0, 10))) : new Set(rows.map((r) => `${r.timestamp}|${r.fields.body ?? r.fields.amount ?? r.fields.duration_s ?? r.id}`))
      return { ...e, n: distinct.size, ids: rows.map((r) => r.id) }
    })
    .filter((e) => e.n > 0)
}

export default function RelationshipGraph({
  graph,
  from,
  to,
  channels,
  selected,
  onSelect,
  height = 470,
}: {
  graph: Graph
  from: string
  to: string
  channels: Set<Channel>
  selected: EdgeView | null
  onSelect: (e: EdgeView | null) => void
  height?: number
}) {
  const [hover, setHover] = useState<string | null>(null)
  const edges = useMemo(() => edgesInWindow(graph, from, to).filter((e) => channels.has(e.channel)), [graph, from, to, channels])
  const byPair = new Map<string, EdgeView[]>()
  for (const e of edges) {
    const k = [e.source, e.target].sort().join('|')
    byPair.set(k, [...(byPair.get(k) ?? []), e].sort((a, b) => CHANNEL_STYLE[a.channel].order - CHANNEL_STYLE[b.channel].order))
  }
  const W = 760
  const ekey = (e: GraphEdge) => `${e.source}|${e.target}|${e.channel}`
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" onClick={() => onSelect(null)}>
      <defs>
        {PEOPLE.map((p) => (
          <clipPath key={p.person_id} id={`clip-${p.person_id}`}>
            <circle cx={POS[p.person_id][0]} cy={POS[p.person_id][1]} r={p.is_victim ? 40 : 34} />
          </clipPath>
        ))}
      </defs>
      {[...byPair.values()].flatMap((list) =>
        list.map((e, i) => {
          const [x1, y1] = POS[e.source]
          const [x2, y2] = POS[e.target]
          const off = (i - (list.length - 1) / 2) * 26
          const dx = x2 - x1
          const dy = y2 - y1
          const len = Math.hypot(dx, dy) || 1
          const cx = (x1 + x2) / 2 + (-dy / len) * off
          const cy = (y1 + y2) / 2 + (dx / len) * off
          const s = CHANNEL_STYLE[e.channel]
          const k = ekey(e)
          const on = selected ? ekey(selected) === k : hover ? hover === k : true
          const w = Math.min(7, 1.4 + Math.log2(e.n + 1) * 1.3)
          return (
            <g key={k}>
              <path
                d={`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`}
                fill="none"
                stroke={s.stroke}
                strokeWidth={w}
                strokeDasharray={s.dash}
                strokeLinecap="round"
                opacity={e.weak ? 0.35 : on ? 0.95 : 0.18}
              />
              <path
                d={`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                className="cursor-pointer"
                onMouseEnter={() => setHover(k)}
                onMouseLeave={() => setHover(null)}
                onClick={(ev) => {
                  ev.stopPropagation()
                  onSelect(e)
                }}
              >
                <title>{`${personName(e.source)} – ${personName(e.target)}: ${e.channel === 'colocation' ? e.label : `${e.n} ${s.label.toLowerCase()}`}`}</title>
              </path>
              {(selected && ekey(selected) === k) || hover === k ? (
                <text x={(x1 + 2 * cx + x2) / 4} y={(y1 + 2 * cy + y2) / 4 - 5} textAnchor="middle" fontSize={11} fill="var(--ink-2)" stroke="var(--surface)" strokeWidth={4} paintOrder="stroke" opacity={on ? 1 : 0.3} className="pointer-events-none">
                  {e.channel === 'transfer' ? `$ ×${e.n}` : e.channel === 'colocation' ? `together ×${e.n}` : e.channel === 'deleted_thread' ? 'deleted' : e.channel === 'hostile' ? `hostile ×${e.n}` : `${e.n}`}
                </text>
              ) : null}
            </g>
          )
        }),
      )}
      {PEOPLE.map((p) => {
        const [x, y] = POS[p.person_id]
        const r = p.is_victim ? 40 : 34
        const degree = edges.filter((e) => e.source === p.person_id || e.target === p.person_id).length
        return (
          <g key={p.person_id}>
            <circle cx={x} cy={y} r={r + 4} fill="var(--surface)" stroke={personColor(p.person_id)} strokeWidth={3} />
            <image href={p.portrait} x={x - r} y={y - r} width={r * 2} height={r * 2} clipPath={`url(#clip-${p.person_id})`} preserveAspectRatio="xMidYMid slice" style={{ filter: p.is_victim ? 'grayscale(0.85)' : undefined }} />
            <text x={x} y={y + r + 20} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--ink)" stroke="var(--surface)" strokeWidth={5} paintOrder="stroke" strokeLinejoin="round">
              {p.name}
            </text>
            <text x={x} y={y + r + 35} textAnchor="middle" fontSize={11} fill="var(--ink-3)" stroke="var(--surface)" strokeWidth={5} paintOrder="stroke" strokeLinejoin="round">
              {p.is_victim ? 'victim' : `${degree} link types`}
            </text>
          </g>
        )
      })}
      <text x={W / 2} y={14} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)">
        {fmtDate(from)} – {fmtDate(to)} · line width = number of interactions · portraits are generated faces
      </text>
    </svg>
  )
}
