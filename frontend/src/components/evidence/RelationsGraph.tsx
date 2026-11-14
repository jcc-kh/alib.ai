import { useEffect, useState } from 'react'
import { getEvidence, getGraph, type Channel, type EvidenceByPhone, type Graph, type GraphEdge } from '../../api'
import SourcesView from '../SourcesView'

// Fixed layout for the four-person demo case; a force layout replaces this for larger cases.
const POS: Record<string, [number, number]> = { paul: [170, 170], amy: [70, 50], ken: [400, 70], cara: [370, 290] }

export const CHANNEL_STYLE: Record<Channel, { color: string; dash?: string; label: string }> = {
  call: { color: 'var(--accent)', label: 'Calls' },
  message: { color: 'var(--accent)', label: 'Messages' },
  transfer: { color: 'var(--good)', label: 'Money' },
  deleted_thread: { color: 'var(--serious)', dash: '2 4', label: 'Deleted thread' },
  social: { color: 'var(--violet)', dash: '6 4', label: 'Social' },
  colocation: { color: 'var(--amber)', dash: '9 5', label: 'Co-location only' },
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

  if (!g) return <div className="pulse-dot text-sm text-faint">Building contact graph…</div>

  const byPair = new Map<string, GraphEdge[]>()
  for (const e of g.edges) {
    const k = [e.source, e.target].sort().join('|')
    byPair.set(k, [...(byPair.get(k) ?? []), e])
  }

  return (
    <div className="space-y-4">
      <svg viewBox="0 0 480 340" className="w-full">
        {[...byPair.values()].flatMap((edges) =>
          edges.map((e, i) => {
            const [a, b] = [e.source, e.target].sort()
            const [x1, y1] = POS[a]
            const [x2, y2] = POS[b]
            const off = (i - (edges.length - 1) / 2) * 52
            const len = Math.hypot(x2 - x1, y2 - y1)
            const cx = (x1 + x2) / 2 + (-(y2 - y1) / len) * off
            const cy = (y1 + y2) / 2 + ((x2 - x1) / len) * off
            const st = CHANNEL_STYLE[e.channel]
            const active = sel === e
            const d = `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`
            return (
              <g key={`${e.source}-${e.target}-${e.channel}`} onClick={() => setSel(e)} className="cursor-pointer">
                <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
                <path d={d} fill="none" stroke={st.color} strokeWidth={active ? 3.5 : e.weak ? 1 : 1.8} strokeDasharray={st.dash} opacity={e.weak ? 0.45 : active || !sel ? 1 : 0.35}>
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
              <circle cx={x} cy={y} r={26} fill="var(--surface)" stroke={n.color} strokeWidth={1.5} />
              <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fill={n.color} style={{ fontFamily: 'Instrument Serif, serif' }}>
                {n.label.split(' ')[0]}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-faint">
        {Object.entries(CHANNEL_STYLE).map(([k, s]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <svg width="18" height="6">
              <line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
      <div className="divide-y divide-line border-y border-line text-[13px]">
        {g.edges.map((e) => (
          <button
            key={`${e.source}-${e.target}-${e.channel}`}
            onClick={() => setSel(sel === e ? null : e)}
            className={`flex w-full items-center gap-3 px-1 py-2 text-left transition hover:bg-panel ${sel === e ? 'bg-panel' : ''}`}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CHANNEL_STYLE[e.channel].color }} />
            <span className="w-28 shrink-0 capitalize text-muted">
              {e.source} – {e.target}
            </span>
            <span className={e.weak ? 'text-faint' : 'text-fg/90'}>{e.label}</span>
            <span className="ml-auto text-[11px] text-faint">{e.evidence_ids.length} rows</span>
          </button>
        ))}
      </div>
      {sel && rows && <SourcesView rows={rows} />}
    </div>
  )
}
