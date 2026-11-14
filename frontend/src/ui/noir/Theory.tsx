import type { Brief, Finding } from '../../api'
import { useCase } from '../../state/caseStore'
import { DeskButton, RoomTitle } from './NoirApp'

const BOXES: { key: keyof Brief; label: string }[] = [
  { key: 'believe', label: 'What we believe' },
  { key: 'confused', label: "What doesn't add up" },
  { key: 'unknown', label: "What we don't know" },
]

const STAMP: Record<string, { text: string; color: string }> = {
  confirmed: { text: 'Holds', color: '#3b6b2c' },
  inconsistent: { text: "Doesn't hold", color: '#a3201e' },
  cannot_tell: { text: "Can't tell", color: '#85745b' },
  answers: { text: 'Answered', color: '#284a7a' },
  unprompted: { text: 'Not asked', color: '#594834' },
}

export default function Theory({ next }: { next: () => void }) {
  const c = useCase()
  const r = c.refine
  const running = c.stage === 'refining'
  const stampOf = (f: Finding) => (f.verdict === 'cannot_tell' ? STAMP.cannot_tell : f.section === 'answers' ? STAMP.answers : f.section === 'unprompted' ? STAMP.unprompted : STAMP[f.verdict])
  return (
    <div className="px-10 py-8">
      <div className="flex items-start justify-between">
        <RoomTitle kicker="Room IV · Your theory">Write it down. The phones will answer.</RoomTitle>
        {r.report && <DeskButton onClick={next}>Interrogate the evidence →</DeskButton>}
      </div>
      <div className="grid grid-cols-[420px_1fr] gap-8">
        {/* notepad */}
        <div
          className="paper rounded-sm px-6 pb-5 pt-8"
          style={{ fontFamily: 'var(--type-font)', backgroundImage: 'linear-gradient(90deg, transparent 38px, rgba(163,32,30,0.35) 38px 39px, transparent 39px), repeating-linear-gradient(180deg, transparent 0 25px, rgba(43,92,158,0.2) 25px 26px)' }}
        >
          {BOXES.map((b) => (
            <label key={b.key} className="block pl-6">
              <div className="text-[13px] uppercase tracking-[0.15em] text-[#a3201e]">{b.label}</div>
              <textarea
                value={r.brief[b.key].join('\n')}
                onChange={(e) => c.setBrief({ ...r.brief, [b.key]: e.target.value.split('\n') })}
                rows={3}
                className="w-full resize-none bg-transparent text-[15px] leading-[26px] text-[#221a10] focus:outline-none"
              />
            </label>
          ))}
          <div className="mt-3 pl-6">
            <button disabled={running} onClick={() => c.runRefine()} className="border-b-2 border-[#a3201e] text-[16px] text-[#a3201e] disabled:opacity-50">
              {running ? 'checking each line…' : r.report ? 'check it again' : 'pin it to the board'}
            </button>
            <div className="mt-2 text-[12px] text-[#85745b]">try adding: “Paul met Cara in March.”</div>
          </div>
        </div>

        {/* results as pinned notes */}
        <div>
          {running && (
            <div className="space-y-1 text-[13px] text-[#efe3c8]" style={{ fontFamily: 'var(--type-font)' }}>
              {r.todos.map((t) => (
                <div key={t.id} className={t.status === 'done' ? 'text-[#c9b38a]' : t.status === 'in_progress' ? 'pulse-dot' : 'text-[#8d785c]'}>
                  {t.status === 'done' ? '✓' : '›'} {t.label}
                </div>
              ))}
              {r.hops.map((h, i) => (
                <div key={i} className="drop-in mt-2 w-fit rotate-[-1deg] bg-[#fff6a8] px-2 py-1 text-[12px] text-[#221a10]">
                  {h.from} → {h.to}: {h.note}
                </div>
              ))}
            </div>
          )}
          {r.report && (
            <div className="grid grid-cols-2 gap-5">
              {r.report.findings.map((f, i) => {
                const st = stampOf(f)
                return (
                  <button
                    key={f.id}
                    onClick={() => c.openFinding(f)}
                    className="paper drop-in relative rounded-sm px-4 pb-3 pt-4 text-left transition hover:scale-[1.02]"
                    style={{ transform: `rotate(${[-1.2, 1, -0.6, 1.4][i % 4]}deg)`, animationDelay: `${i * 80}ms`, fontFamily: 'var(--type-font)' }}
                  >
                    <div className="pin absolute -top-1.5 left-1/2 -translate-x-1/2" />
                    {f.brief_item && <div className="text-[12px] italic text-[#594834]">“{f.brief_item}”</div>}
                    <div className="mt-1 text-[13.5px] leading-snug text-[#221a10]">{f.statement}</div>
                    <span className="stamp absolute -right-2 bottom-2 bg-[#f6eedb]/80 text-[12px]" style={{ color: st.color }}>
                      {st.text}
                    </span>
                    <div className="mt-2 text-[11px] text-[#85745b]">{f.evidence_ids.length} rows cited</div>
                  </button>
                )
              })}
            </div>
          )}
          {!running && !r.report && <div className="pt-20 text-center text-[14px] text-[#c9b38a]">Each line you write is matched to what the investigators already found.</div>}
        </div>
      </div>
    </div>
  )
}
