import { useEffect, useRef, useState } from 'react'
import { analyse, type AgentEvent, type Brief, type CaseInfo, type Finding, type Report, type Section, type SubagentName, type Todo } from '../api'
import { Eyebrow, PersonChip, Title, VerdictBadge } from '../components/ui'
import FindingDetail from '../components/FindingDetail'
import RunProgress, { type LaneState } from '../components/RunProgress'

export const DEMO_BRIEF: Brief = {
  believe: ['Paul and Amy were together on the evening of 14 April.', "Paul and Cara don't know each other."],
  confused: ["Paul sent Ken $5,000 on 15 April and can't explain why."],
  unknown: ['Where did the missing money end up?', 'Did anyone react to the audit announcement?'],
}

const BOXES: { key: keyof Brief; label: string; hint: string }[] = [
  { key: 'believe', label: 'What we believe', hint: 'Statements to test, one per line' },
  { key: 'confused', label: 'What confuses us', hint: 'Things that don’t add up' },
  { key: 'unknown', label: "What we don't know", hint: 'Open questions' },
]

const SECTIONS: { key: Section; title: string }[] = [
  { key: 'confirmed', title: 'Confirmed' },
  { key: 'inconsistent', title: 'Inconsistent with what you believe' },
  { key: 'answers', title: 'Answers to your questions' },
  { key: 'unprompted', title: "What you didn't ask about" },
]

type RunState = 'edit' | 'running' | 'done' | 'error'

export default function InvestigatePage({ caseInfo, seed }: { caseInfo: CaseInfo; seed?: { brief: Brief; nonce: number } | null }) {
  const [brief, setBrief] = useState<Brief>(seed?.brief ?? DEMO_BRIEF)
  const [hops, setHops] = useState<{ from: SubagentName; to: SubagentName; note: string }[]>([])
  const [state, setState] = useState<RunState>('edit')
  const [todos, setTodos] = useState<Todo[]>([])
  const [lanes, setLanes] = useState<Partial<Record<SubagentName, LaneState>>>({})
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Finding | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function onEvent(e: AgentEvent) {
    if (e.type === 'todos') setTodos(e.todos)
    if (e.type === 'subagent' && e.status === 'follow_up' && e.to) {
      const hop = { from: e.agent, to: e.to, note: e.note ?? '' }
      setHops((h) => [...h, hop])
      return
    }
    if (e.type === 'subagent')
      setLanes((prev) => {
        const cur = prev[e.agent] ?? { status: 'idle', calls: 0, last: '' }
        return {
          ...prev,
          [e.agent]: { status: e.status === 'done' ? 'done' : 'working', calls: cur.calls + (e.status === 'tool' ? 1 : 0), last: e.tool ?? e.note ?? cur.last },
        }
      })
  }

  async function run(b: Brief = brief) {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState('running')
    setTodos([])
    setLanes({})
    setHops([])
    setReport(null)
    setSelected(null)
    setError(null)
    window.scrollTo({ top: 0 })
    try {
      const r = await analyse(b, onEvent, ctrl.signal)
      setReport(r)
      setSelected(r.findings[0] ?? null)
      setState('done')
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message)
      setState('error')
    }
  }

  // A brief handed over from the briefing page runs straight away.
  useEffect(() => {
    if (seed) {
      setBrief(seed.brief)
      run(seed.brief)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.nonce])

  return (
    <div className="mx-auto max-w-[1280px]">
      <section className="frame px-12 pb-10 pt-16">
        <Eyebrow>Investigate · {caseInfo.title}</Eyebrow>
        <Title size="xl" className="mt-3 max-w-3xl">
          Sharpen the briefing with your brief.
        </Title>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
          The phones were already swept and triaged when the case loaded. Write down what you believe, what confuses you and what you don't know: each line is
          matched to existing signals first, and new checks run only for what the sweep didn't cover.
        </p>
      </section>
      <div className="dot-rule" />

      {state === 'edit' && (
        <section className="frame rise px-12 py-12">
          <div className="grid grid-cols-3 gap-6">
            {BOXES.map((b) => (
              <label key={b.key} className="block">
                <div className="font-serif text-2xl text-fg">{b.label}</div>
                <div className="mb-3 text-xs text-faint">{b.hint}</div>
                <textarea
                  value={brief[b.key].join('\n')}
                  onChange={(e) => setBrief({ ...brief, [b.key]: e.target.value.split('\n') })}
                  rows={6}
                  className="w-full resize-y rounded-xl border border-line bg-panel p-4 text-[15px] leading-relaxed text-fg placeholder:text-faint focus:border-line-strong focus:outline-none"
                />
              </label>
            ))}
          </div>
          <div className="mt-8 flex items-center gap-6">
            <button onClick={() => run()} className="btn-primary px-6 py-2.5 text-sm font-medium">
              Analyse
            </button>
            <span className="text-xs text-faint">
              Try adding “Paul met Cara in March.” for a <i>cannot tell</i> answer, or delete a line to see the sweep catch it anyway.
            </span>
          </div>
        </section>
      )}

      {state === 'running' && (
        <section className="frame px-12 py-12">
          <RunProgress todos={todos} lanes={lanes} hops={hops} />
        </section>
      )}

      {state === 'error' && (
        <section className="frame px-12 py-16">
          <div className="max-w-lg rounded-xl border border-terra/50 p-6">
            <div className="font-serif text-2xl text-terra-soft">The analysis did not finish</div>
            <p className="mt-2 text-sm text-muted">{error}</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => run()} className="btn-primary px-4 py-2 text-sm font-medium">
                Retry
              </button>
              <button onClick={() => setState('edit')} className="btn-ghost px-4 py-2 text-sm">
                Edit brief
              </button>
            </div>
          </div>
        </section>
      )}

      {state === 'done' && report && (
        <section className="frame grid grid-cols-[360px_1fr]">
          <aside className="border-r border-line">
            <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto px-6 py-8">
              <div className="mb-6 flex items-center justify-between">
                <Eyebrow>Report · {report.findings.length} findings</Eyebrow>
                <button onClick={() => setState('edit')} className="text-xs text-muted underline-offset-4 hover:underline">
                  Edit brief
                </button>
              </div>
              {SECTIONS.map((s) => {
                const fs = report.findings.filter((f) => f.section === s.key)
                if (!fs.length) return null
                return (
                  <div key={s.key} className="mb-7">
                    <div className="mb-2 text-xs text-faint">{s.title}</div>
                    <div className="space-y-1">
                      {fs.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setSelected(f)}
                          className={`block w-full rounded-lg border px-3 py-3 text-left transition ${selected?.id === f.id ? 'border-line-strong bg-raised' : 'border-transparent hover:bg-panel'}`}
                        >
                          <VerdictBadge v={f.section === 'unprompted' ? 'sweep' : f.verdict} />
                          <div className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-fg/90">{f.statement}</div>
                          <div className="mt-2 flex gap-1">
                            {f.people.map((p) => (
                              <PersonChip key={p} id={p} small />
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div className="mb-2 text-xs text-faint">Suggested next steps</div>
              <ol className="list-decimal space-y-2 pl-4 text-[13px] leading-snug text-muted">
                {report.next_steps.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ol>
              <p className="mt-6 text-[11px] leading-relaxed text-faint">{report.assumptions.join(' ')}</p>
            </div>
          </aside>
          <div className="min-w-0 px-10 py-8">{selected && <FindingDetail finding={selected} />}</div>
        </section>
      )}
    </div>
  )
}
