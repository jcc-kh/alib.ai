import { useEffect, useRef, useState } from 'react'
import { ask, type Answer } from '../api'
import { useApp } from '../state'
import { SUGGESTED_QUESTIONS } from '../mock/ask'
import { Eyebrow, VerdictBadge } from './ui'

type Turn = { q: string; steps: string[]; answer: Answer | null }

export default function AskDrawer({ open, seed, nonce, onClose }: { open: boolean; seed?: string; nonce: number; onClose: () => void }) {
  const { openFinding } = useApp()
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  async function submit(q: string) {
    const question = q.trim()
    if (!question || busy) return
    setInput('')
    setBusy(true)
    setTurns((t) => [...t, { q: question, steps: [], answer: null }])
    const update = (fn: (t: Turn) => Turn) => setTurns((all) => all.map((t, i) => (i === all.length - 1 ? fn(t) : t)))
    await ask(question, (e) => {
      if (e.type === 'step') update((t) => ({ ...t, steps: [...t.steps, e.text] }))
      if (e.type === 'answer') update((t) => ({ ...t, answer: e.answer }))
    })
    setBusy(false)
  }

  // A seeded question (from a briefing chip) is asked as soon as the drawer opens.
  useEffect(() => {
    if (open && seed) submit(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce])
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="slide-in relative flex h-full w-[min(560px,100vw)] flex-col border-l border-line bg-canvas">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <div className="font-serif text-2xl">Ask Alib.ai</div>
            <div className="text-xs text-faint">Every answer cites the rows it relies on, or says it can't tell.</div>
          </div>
          <button onClick={onClose} className="text-sm text-faint hover:text-fg">
            Close ✕
          </button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          {turns.length === 0 && (
            <div className="space-y-3">
              <Eyebrow>Try asking</Eyebrow>
              {SUGGESTED_QUESTIONS.map((s) => (
                <button key={s} onClick={() => submit(s)} className="block w-full rounded-lg border border-line px-4 py-3 text-left text-sm text-muted transition hover:border-line-strong hover:text-fg">
                  {s}
                </button>
              ))}
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className="rise space-y-3">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-raised px-4 py-2.5 text-sm text-fg">{t.q}</div>
              <ul className="space-y-1">
                {t.steps.map((s, k) => (
                  <li key={k} className="flex gap-2 font-mono text-[11px] text-faint">
                    <span className="text-azure-soft">›</span>
                    {s}
                  </li>
                ))}
                {!t.answer && <li className="pulse-dot font-mono text-[11px] text-faint">working…</li>}
              </ul>
              {t.answer && (
                <div className="space-y-3">
                  {t.answer.verdict && <VerdictBadge v={t.answer.verdict} />}
                  <p className="font-serif text-xl leading-snug text-fg">{t.answer.text}</p>
                  {t.answer.findings.map((f) => (
                    <button key={f.id} onClick={() => openFinding(f)} className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2 text-left text-xs transition hover:border-line-strong">
                      <span className="text-azure-soft">↗</span>
                      <span className="text-muted">
                        Evidence: <span className="font-mono">{f.check}</span> · {f.evidence_ids.length} rows · how we know · verify
                      </span>
                    </button>
                  ))}
                  {i === turns.length - 1 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {t.answer.suggestions.map((s) => (
                        <button key={s} onClick={() => submit(s)} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-line-strong hover:text-fg">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit(input)
          }}
          className="border-t border-line p-4"
        >
          <div className="flex gap-2 rounded-xl border border-line-strong bg-panel p-1.5 focus-within:border-muted">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about these phones…"
              className="flex-1 bg-transparent px-3 text-sm text-fg placeholder:text-faint focus:outline-none"
            />
            <button disabled={busy || !input.trim()} className="btn-primary px-4 py-1.5 text-sm font-medium">
              Ask
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}
