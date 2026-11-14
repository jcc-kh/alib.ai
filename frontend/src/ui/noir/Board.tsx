import type { Channel, PersonId } from '../../api'
import { useCase } from '../../state/caseStore'
import { GRAPH, PEOPLE } from '../../mock/data'
import WeekTimeline from '../../components/WeekTimeline'
import { DeskButton, RoomTitle } from './NoirApp'

const W = 1180
const H = 700
const PHOTO: Record<PersonId, [number, number]> = { amy: [150, 150], paul: [400, 360], ken: [960, 150], cara: [940, 540] }
const CARD: Record<string, [number, number, number]> = {
  'INC-1': [600, 250, -2],
  'INC-2': [560, 40, 2],
  'INC-3': [40, 420, -3],
  'INC-4': [470, 520, 1.5],
}
const STRING: Record<Channel, { stroke: string; dash?: string; w: number; label: string }> = {
  transfer: { stroke: '#b3221f', w: 3, label: 'money' },
  deleted_thread: { stroke: '#b3221f', dash: '7 5', w: 2, label: 'deleted thread' },
  call: { stroke: '#f1e4c6', w: 1.6, label: 'calls' },
  message: { stroke: '#f1e4c6', dash: '2 4', w: 1.6, label: 'messages' },
  colocation: { stroke: '#f2c14e', dash: '9 5', w: 2.2, label: 'together, no contact' },
  social: { stroke: '#9b7fd1', dash: '4 4', w: 1.6, label: 'social' },
}

export default function Board({ next }: { next: () => void }) {
  const c = useCase()
  const b = c.briefing
  if (!b) return null
  const byPair = new Map<string, number>()
  const findById = (id: string) => b.incidents.flatMap((i) => i.findings).find((f) => f.id === id)

  return (
    <div className="px-10 py-8">
      <div className="flex items-start justify-between">
        <RoomTitle kicker="Room III · Evidence board">Who is connected, and how</RoomTitle>
        <div className="flex flex-col items-end gap-2 pt-2">
          <DeskButton onClick={next}>Test your theory →</DeskButton>
          <span className="text-[12px] text-[#c9b38a]">{b.signals_total} signals · {b.incidents.length} incidents · {b.dismissed.length} set aside</span>
        </div>
      </div>

      <div className="cork overflow-hidden rounded-sm border-[10px] border-[#5a3b22]">
       <div className="relative mx-auto" style={{ width: W, height: H }}>
        <svg width={W} height={H} className="absolute inset-0">
          {GRAPH.edges.map((e) => {
            const k = [e.source, e.target].sort().join('|')
            const n = byPair.get(k) ?? 0
            byPair.set(k, n + 1)
            const [x1, y1] = PHOTO[e.source]
            const [x2, y2] = PHOTO[e.target]
            const off = (n - 1) * 26
            const mx = (x1 + x2) / 2 + off
            const my = (y1 + y2) / 2 + 40 + Math.abs(off)
            const s = STRING[e.channel]
            return (
              <path key={`${k}-${e.channel}`} d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none" stroke={s.stroke} strokeWidth={s.w} strokeDasharray={s.dash} opacity={e.weak ? 0.45 : 0.95} style={{ filter: 'drop-shadow(0 2px 1px rgba(0,0,0,0.45))' }}>
                <title>{`${e.source} – ${e.target}: ${e.label}`}</title>
              </path>
            )
          })}
        </svg>

        {/* photos */}
        {PEOPLE.map((p, i) => {
          const [x, y] = PHOTO[p.person_id]
          return (
            <div key={p.person_id} className="absolute w-[120px] bg-[#f7f2e6] p-2 pb-6 shadow-[0_8px_16px_rgba(0,0,0,0.5)]" style={{ left: x - 60, top: y - 70, transform: `rotate(${[-4, 3, -2, 4][i]}deg)` }}>
              <div className="pin absolute -top-1.5 left-1/2 -translate-x-1/2" />
              <div className="grid h-[96px] place-items-center" style={{ background: `linear-gradient(160deg, ${p.color}, #1a120b)` }}>
                <span className="text-[34px] text-[#f7f2e6]/90" style={{ fontFamily: 'var(--display-font)' }}>
                  {p.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')}
                </span>
              </div>
              <div className="absolute bottom-1 left-0 right-0 text-center text-[12px] text-[#221a10]" style={{ fontFamily: 'var(--type-font)' }}>
                {p.name}
              </div>
            </div>
          )
        })}

        {/* incident index cards */}
        {b.incidents.map((inc) => {
          const [x, y, rot] = CARD[inc.incident_id] ?? [40, 40, 0]
          return (
            <button
              key={inc.incident_id}
              onClick={() => c.openFinding(inc.findings[0])}
              className="paper absolute w-[250px] rounded-[2px] px-3 pb-2.5 pt-3 text-left transition hover:z-10 hover:scale-[1.03]"
              style={{ left: x, top: y, transform: `rotate(${rot}deg)`, fontFamily: 'var(--type-font)', backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 21px, rgba(43,92,158,0.18) 21px 22px)' }}
            >
              <div className="pin absolute -top-1.5 left-6" />
              <div className="flex items-baseline justify-between text-[11px] text-[#a3201e]">
                <span>No. {inc.rank} · {inc.incident_id}</span>
                <span className="text-[#594834]">{inc.n_checks} checks · {inc.n_phones} phones</span>
              </div>
              <div className="mt-1 text-[14px] leading-snug text-[#221a10]">{inc.headline}</div>
              <div className="mt-1.5 text-[11px] text-[#594834]">
                {inc.findings.length} exhibit{inc.findings.length > 1 ? 's' : ''} · click to open the dossier
              </div>
              {inc.anchor_id && (
                <>
                  <svg className="pointer-events-none absolute -inset-5" viewBox="0 0 300 200" preserveAspectRatio="none" style={{ width: 'calc(100% + 40px)', height: 'calc(100% + 40px)' }}>
                    <ellipse cx="150" cy="100" rx="142" ry="92" fill="none" stroke="#c4221c" strokeWidth="3" strokeDasharray="420 40" opacity="0.85" />
                  </svg>
                  <span className="absolute -bottom-11 right-2 rotate-[-4deg] whitespace-nowrap text-[15px] text-[#c4221c]" style={{ fontFamily: 'var(--type-font)' }}>
                    17 Apr, ~10:00 — 3 phones at once
                  </span>
                </>
              )}
            </button>
          )
        })}

        {/* legend (inside the fixed canvas) */}
        <div className="paper absolute bottom-4 right-4 rotate-[1deg] px-3 py-2 text-[11px] text-[#221a10]" style={{ fontFamily: 'var(--type-font)' }}>
          {(Object.keys(STRING) as Channel[]).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <svg width="26" height="6">
                <line x1="0" x2="26" y1="3" y2="3" stroke={STRING[k].stroke === '#f1e4c6' ? '#85745b' : STRING[k].stroke} strokeWidth="2.5" strokeDasharray={STRING[k].dash} />
              </svg>
              {STRING[k].label}
            </div>
          ))}
        </div>
       </div>
      </div>

      <div className="mt-8 grid grid-cols-[2fr_1fr] gap-6">
        <div className="paper rounded-sm px-5 py-4">
          <div className="mb-2 text-[12px] uppercase tracking-[0.2em] text-[#85745b]" style={{ fontFamily: 'var(--type-font)' }}>
            Ledger · 13–19 April, phone by phone
          </div>
          <WeekTimeline events={b.timeline} onPick={(id) => findById(id) && c.openFinding(findById(id)!)} />
        </div>
        <div className="space-y-3">
          <div className="text-[12px] uppercase tracking-[0.2em] text-[#c9b38a]">Set aside, with reasons</div>
          {b.dismissed.map((d, i) => (
            <div key={d.title} className="paper rounded-sm px-3 py-2 text-[12.5px] text-[#221a10]" style={{ transform: `rotate(${[-1.5, 1, -0.5, 1.5][i % 4]}deg)`, fontFamily: 'var(--type-font)' }}>
              <div className="line-through decoration-[#a3201e]/50">{d.title}</div>
              <div className="mt-0.5 text-[11.5px] text-[#594834]">{d.reason}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
