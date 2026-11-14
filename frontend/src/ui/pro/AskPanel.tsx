import { useEffect, useRef, useState } from 'react'
import { useCase } from '../../state/caseStore'
import { SUGGESTED_QUESTIONS } from '../../mock/ask'
import { Mono, VerdictPill } from './kit'

/** Ask: questions answered with cited findings. Used docked (drawer) and as the step-5 page. */
export function AskThread({ compact = false }: { compact?: boolean }) {
  const c = useCase()
  const [input, setInput] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [c.askTurns])
  const submit = (q: string) => {
    if (!q.trim() || c.askBusy) return
    setInput('')
    c.ask(q)
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`flex-1 space-y-5 overflow-y-auto ${compact ? 'p-4' : 'p-5'}`}>
        {c.askTurns.length === 0 && (
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">Suggested</div>
            <div className="space-y-1.5">
              {SUGGESTED_QUESTIONS.map((s) => (
                <button key={s} onClick={() => submit(s)} className="block w-full rounded-md border border-line px-3 py-2 text-left text-[12.5px] text-ink hover:bg-sunken">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {c.askTurns.map((t, i) => (
          <div key={i} className="rise space-y-2">
            <div className="ml-auto w-fit max-w-[85%] rounded-lg bg-sunken px-3 py-2 text-[13px] text-ink">{t.q}</div>
            <div className="space-y-0.5 border-l-2 border-line pl-2.5">
              {t.steps.map((s, k) => (
                <Mono key={k} className="block text-ink-3">
                  {s}
                </Mono>
              ))}
              {!t.answer && <Mono className="pulse-dot block text-ink-3">working…</Mono>}
            </div>
            {t.answer && (
              <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
                {t.answer.verdict && <VerdictPill v={t.answer.verdict} />}
                <p className="text-[13.5px] leading-relaxed text-ink">{t.answer.text}</p>
                {t.answer.findings.map((f) => (
                  <button key={f.id} onClick={() => c.openFinding(f)} className="flex w-full items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-left text-[12px] hover:bg-sunken">
                    <Mono className="text-ink-2">{f.check}</Mono>
                    <span className="text-ink-2">· {f.evidence_ids.length} rows cited</span>
                    <span className="ml-auto text-ink">Evidence →</span>
                  </button>
                ))}
                {i === c.askTurns.length - 1 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {t.answer.suggestions.map((s) => (
                      <button key={s} onClick={() => submit(s)} className="rounded-full border border-line px-2.5 py-0.5 text-[11.5px] text-ink-2 hover:bg-sunken hover:text-ink">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(input)
        }}
        className="border-t border-line p-3"
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about these phones…"
            className="h-8 flex-1 rounded-md border border-line bg-page px-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:border-line-strong focus:outline-none"
          />
          <button disabled={c.askBusy || !input.trim()} className="h-8 rounded-md bg-ink px-3 text-[12px] font-medium text-surface disabled:opacity-40">
            Ask
          </button>
        </div>
        <div className="mt-1.5 text-[11px] text-ink-3">Answers cite rows, or say “cannot tell”.</div>
      </form>
    </div>
  )
}

export default function AskPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="slide-in relative flex h-full w-[min(480px,100vw)] flex-col border-l border-line bg-page">
        <header className="flex h-12 items-center border-b border-line bg-surface px-4">
          <span className="text-[13px] font-semibold">Ask</span>
          <button onClick={onClose} className="ml-auto text-[12px] text-ink-3 hover:text-ink">
            Close ✕
          </button>
        </header>
        <AskThread compact />
      </aside>
    </div>
  )
}
