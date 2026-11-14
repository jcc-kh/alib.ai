import { useEffect, useRef, useState } from 'react'
import { useCase } from '../../state/caseStore'
import { SUGGESTED_QUESTIONS } from '../../mock/ask'
import { RoomTitle } from './NoirApp'

export default function Interrogate() {
  const c = useCase()
  const [q, setQ] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [c.askTurns])
  const ask = (text: string) => {
    if (!text.trim() || c.askBusy) return
    setQ('')
    c.ask(text)
  }
  return (
    <div className="px-10 py-8">
      <RoomTitle kicker="Room V · Interrogation">Put your questions to the evidence</RoomTitle>
      <div className="grid grid-cols-[1fr_300px] gap-8">
        <div className="paper min-h-[520px] rounded-sm px-10 py-8" style={{ fontFamily: 'var(--type-font)' }}>
          <div className="text-[12px] uppercase tracking-[0.25em] text-[#85745b]">Transcript · case 2026-0417</div>
          <div className="mt-4 space-y-6">
            {c.askTurns.length === 0 && <p className="text-[14px] text-[#85745b]">No questions yet. The evidence answers with exhibits, or says it can't tell.</p>}
            {c.askTurns.map((t, i) => (
              <div key={i} className="space-y-2">
                <p className="text-[15px] text-[#221a10]">
                  <span className="text-[#a3201e]">Q.</span> {t.q}
                </p>
                {!t.answer && <p className="pulse-dot text-[13px] text-[#85745b]">{t.steps[t.steps.length - 1] ?? 'consulting the files…'}</p>}
                {t.answer && (
                  <>
                    <p className="typed text-[15px] leading-relaxed text-[#221a10]">
                      <span className="text-[#284a7a]">A.</span> {t.answer.text}
                    </p>
                    <div className="flex flex-wrap gap-2 pl-5">
                      {t.answer.findings.map((f, k) => (
                        <button key={f.id} onClick={() => c.openFinding(f)} className="rotate-[-1deg] border border-[#a3201e] px-2 py-0.5 text-[12px] uppercase tracking-wider text-[#a3201e] hover:bg-[#a3201e] hover:text-[#f6eedb]">
                          Exhibit {i + 1}.{k + 1} · {f.check} · {f.evidence_ids.length} rows
                        </button>
                      ))}
                      {t.answer.verdict === 'cannot_tell' && <span className="stamp text-[12px] text-[#85745b]">Can't tell</span>}
                    </div>
                  </>
                )}
              </div>
            ))}
            <div ref={end} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              ask(q)
            }}
            className="mt-8 flex items-center gap-3 border-t border-dashed border-[#c9b38a] pt-4"
          >
            <span className="text-[#a3201e]">Q.</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="type your question and press return" className="flex-1 bg-transparent text-[15px] text-[#221a10] placeholder:text-[#b3a283] focus:outline-none" />
          </form>
        </div>
        <div className="space-y-3">
          <div className="text-[12px] uppercase tracking-[0.2em] text-[#c9b38a]">Questions on file</div>
          {SUGGESTED_QUESTIONS.map((s, i) => (
            <button key={s} onClick={() => ask(s)} className="paper block w-full rounded-sm px-3 py-2 text-left text-[13px] text-[#221a10] transition hover:scale-[1.02]" style={{ transform: `rotate(${[-1, 1, -0.5, 0.8, -1.2, 0.6][i % 6]}deg)`, fontFamily: 'var(--type-font)' }}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
