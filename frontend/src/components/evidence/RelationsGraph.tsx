import { useEffect, useState } from 'react'
import { getEvidence, getGraph, type Channel, type EvidenceByPhone, type Graph, type GraphEdge } from '../../api'
import EvidenceRows from './EvidenceRows'

// Fixed layout for the four-person demo case; a force layout replaces this for larger cases.
const POS: Record<string, [number, number]> = { paul: [140, 160], amy: [60, 40], ken: [360, 60], cara: [330, 270] }

export const CHANNEL_STYLE: Record<Channel, { color: string; dash?: string; label: string }> = {
  call: { color: '#0ea5e9', label: 'Calls' },
  message: { color: '#6366f1', label: 'Messages' },
  transfer: { color: '#16a34a', label: 'Money' },
  deleted_thread: { color: '#dc2626', dash: '2 3', label: 'Deleted thread' },
  social: { color: '#a855f7', dash: '6 3', label: 'Social' },
  colocation: { color: '#f59e0b', dash: '8 4', label: 'Co-location only' },
}

export default function RelationsGraph() {
  const [g, setG] = useState<Graph | null>(null)
  const [sel, setSel] = useState<GraphEdge | null>(null)
  const [rows, setRows] = useState<EvidenceByPhone | null>(null)

  useEffect(() => {
    getGraph().then(setG)
  }, [])
  useEffect(() => {
    setRows(null)
    if (sel) getEvidence(sel.evidence_ids).then(setRows)
  }, [sel])

  if (!g) return <div className="pulse-dot text-sm text-slate-500">Building contact graph…</div>

  // Group parallel edges per pair so they fan out instead of overlapping.
  const byPair = new Map<string, GraphEdge[]>()
  for (const e of g.edges) {
    const k = [e.source, e.target].sort().join('|')
    byPair.set(k, [...(byPair.get(k) ?? []), e])
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">
        Built by <span className="font-mono">relationship-mapper</span> from messages, calls, transfers, deletion events, social interactions and
        co-location across all four phones. Click an edge to see its rows.
      </div>
      <svg viewBox="0 0 440 320" className="w-full rounded-lg bg-slate-50">
        {[...byPair.values()].flatMap((edges) =>
          edges.map((e, i) => {
            const [a, b] = [e.source, e.target].sort()
            const [x1, y1] = POS[a]
            const [x2, y2] = POS[b]
            const n = edges.length
            const off = (i - (n - 1) / 2) * 26
            const mx = (x1 + x2) / 2
            const my = (y1 + y2) / 2
            const len = Math.hypot(x2 - x1, y2 - y1)
            const nx = -(y2 - y1) / len
            const ny = (x2 - x1) / len
            const cx = mx + nx * off * 2
            const cy = my + ny * off * 2
            const st = CHANNEL_STYLE[e.channel]
            const active = sel === e
            return (
              <g key={`${e.source}-${e.target}-${e.channel}`} onClick={() => setSel(e)} className="cursor-pointer">
                <path d={`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`} fill="none" stroke="transparent" strokeWidth={12} />
                <path
                  d={`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`}
                  fill="none"
                  stroke={st.color}
                  strokeWidth={active ? 4 : e.weak ? 1.2 : 2.2}
                  strokeDasharray={st.dash}
                  opacity={e.weak ? 0.5 : 1}
                >
                  <title>{e.label}</title>
                </path>
              </g>
            )
          }),
        )}
        {g.nodes.map((n) => {
          const [x, y] = POS[n.id]
          return (
            <g key={n.id}>
              <circle cx={x} cy={y} r={22} fill={n.color} stroke="#fff" strokeWidth={3} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
                {n.label.split(' ')[0]}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {Object.entries(CHANNEL_STYLE).map(([k, s]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <svg width="18" height="6">
              <line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-xs">
        {g.edges.map((e) => (
          <li
            key={`${e.source}-${e.target}-${e.channel}`}
            onClick={() => setSel(e)}
            className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 ${sel === e ? 'bg-blue-50' : ''}`}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CHANNEL_STYLE[e.channel].color }} />
            <span className="w-24 shrink-0 font-medium capitalize">
              {e.source} – {e.target}
            </span>
            <span className={e.weak ? 'text-slate-400' : ''}>{e.label}</span>
          </li>
        ))}
      </ul>
      {sel && rows && <EvidenceRows rows={rows} />}
    </div>
  )
}
