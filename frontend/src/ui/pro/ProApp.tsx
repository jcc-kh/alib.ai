import { useEffect, useMemo, useRef, useState } from 'react'
import { atLeast, useCase, type Stage } from '../../state/caseStore'
import { ROWS } from '../../mock/data'
import FindingDrawer from '../../components/FindingDrawer'
import IngestStep from './steps/IngestStep'
import AnalyseStep from './steps/AnalyseStep'
import ReviewStep from './steps/ReviewStep'
import AskStep from './steps/AskStep'
import EnvelopeDrawer from './EnvelopeDrawer'
import AskPanel from './AskPanel'
import CasesView from './CasesView'
import ConnectionsView from './inquiries/ConnectionsView'
import RadiusView from './inquiries/RadiusView'
import WindowView from './inquiries/WindowView'
import ChangesView from './inquiries/ChangesView'
import MotiveView from './inquiries/MotiveView'
import { INQUIRIES } from './inquiries/meta'
import type { InquiryId } from '../../api'

export type View = 'cases' | 'ingest' | 'analyse' | 'review' | 'ask' | InquiryId

const STEPS: { id: View; label: string; needs: Stage }[] = [
  { id: 'ingest', label: 'Ingest', needs: 'empty' },
  { id: 'analyse', label: 'Analyse', needs: 'ingested' },
  { id: 'review', label: 'Briefing', needs: 'analysed' },
  { id: 'ask', label: 'Ask', needs: 'analysed' },
]
const MORE: { id: View; label: string }[] = INQUIRIES.map((q) => ({ id: q.id, label: q.question }))

function stepDone(id: View, stage: Stage) {
  if (id === 'ingest') return atLeast(stage, 'ingested')
  if (id === 'analyse') return atLeast(stage, 'analysed')
  if (id === 'review') return atLeast(stage, 'analysed')
  return false
}

export default function ProApp({ view, go, theme, toggleTheme }: { view: string; go: (v: View) => void; theme: 'light' | 'dark'; toggleTheme: () => void }) {
  const c = useCase()
  const [askOpen, setAskOpen] = useState(false)
  const ff = useRef(false)
  const v: View = (STEPS.concat(MORE as never).find((s) => s.id === view)?.id as View) ?? 'cases'
  const allowed = (id: View) => {
    if (id === 'cases') return true
    const s = STEPS.find((x) => x.id === id)
    return s ? atLeast(c.stage, s.needs) : atLeast(c.stage, 'analysed')
  }
  // Deep links (e.g. #/pro/review on a fresh load) fast-forward the demo case instead of bouncing to ingest.
  useEffect(() => {
    if (!allowed(v) && c.stage === 'empty' && v !== 'ingest') {
      if (!ff.current) {
        ff.current = true
        c.fastForward()
      }
    }
    else if (!allowed(v) && c.stage !== 'ingesting' && c.stage !== 'analysing') go('ingest')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, c.stage])

  const title = [...STEPS, ...MORE].find((s) => s.id === v)?.label
  const name = c.caseName || 'Untitled case'

  if (v === 'cases') return <CasesView open={go} theme={theme} toggleTheme={toggleTheme} />

  return (
    <div className="flex h-full bg-page text-ink">
      {/* Rail */}
      <aside className="flex w-[232px] shrink-0 flex-col border-r border-line bg-surface">
        <button onClick={() => go('cases')} title="All cases" className="flex h-12 items-center gap-2 border-b border-line px-4 text-left hover:bg-sunken">
          <span className="grid h-6 w-6 place-items-center rounded bg-ink text-[11px] font-bold text-surface">A</span>
          <span className="text-[14px] font-semibold">Alib.ai</span>
          <span className="ml-auto text-[11px] text-ink-3">← Cases</span>
        </button>
        <div className="border-b border-line px-4 py-3">
          <div className="text-[11px] text-ink-3">Case</div>
          <div className="text-[13px] font-medium leading-snug">{name}</div>
          <div className="tnum mt-1 text-[11px] text-ink-3">
            {c.range[0] === c.range[1] ? `${c.range[0]} Apr 2026` : `${c.range[0]}–${c.range[1]} Apr 2026`}
            {c.ingestReport ? ` · ${c.ingestReport.devices.length} phones` : ' · no data yet'}
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <div className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">Workflow</div>
          <ol>
            {STEPS.map((s, i) => {
              const ok = allowed(s.id)
              const done = stepDone(s.id, c.stage)
              const active = v === s.id
              return (
                <li key={s.id}>
                  <button
                    disabled={!ok}
                    onClick={() => go(s.id)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition disabled:cursor-not-allowed ${active ? 'bg-sunken font-medium text-ink' : ok ? 'text-ink-2 hover:bg-sunken' : 'text-ink-3/60'}`}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${done ? 'border-good bg-good text-white' : active ? 'border-ink text-ink' : 'border-line-strong text-ink-3'}`}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    {s.label}
                    {!ok && <span className="ml-auto text-[10px] text-ink-3">locked</span>}
                    {s.id === 'analyse' && c.stage === 'analysing' && <span className="pulse-dot ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="px-2 pb-1.5 pt-5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">Lines of inquiry</div>
          {INQUIRIES.map((q) => {
            const n = c.briefing?.incidents.filter((i) => i.inquiry === q.id).length ?? 0
            return (
              <button
                key={q.id}
                disabled={!allowed(q.id)}
                onClick={() => go(q.id)}
                className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] leading-snug transition disabled:cursor-not-allowed disabled:text-ink-3/60 ${v === q.id ? 'bg-sunken font-medium text-ink' : 'text-ink-2 hover:bg-sunken'}`}
              >
                <span className="min-w-0 flex-1">{q.question}</span>
                {n > 0 && <span className="tnum mt-px rounded bg-sunken px-1 text-[10.5px] text-ink-3">{n}</span>}
              </button>
            )
          })}
        </nav>
        <div className="space-y-1 border-t border-line p-3 text-[12px]">
          <button
            onClick={() => {
              c.reset()
              go('ingest')
            }}
            className="w-full rounded-md px-2 py-1.5 text-left text-ink-3 hover:bg-sunken"
          >
            Reset case
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
          <div className="text-[13px] text-ink-3">
            {name} <span className="px-1">/</span>
            <span className="text-ink">{title}</span>
          </div>
          <Search onPick={(f) => c.openFinding(f)} />
          <button onClick={toggleTheme} title="Toggle theme" className="grid h-7 w-7 place-items-center rounded-md border border-line text-[13px] text-ink-2 hover:bg-sunken">
            {theme === 'light' ? '☾' : '☀'}
          </button>
          <button
            disabled={!atLeast(c.stage, 'analysed')}
            onClick={() => setAskOpen(true)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-ink px-3 text-[12px] font-medium text-surface disabled:opacity-40"
          >
            Ask
          </button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          {v === 'ingest' && <IngestStep next={() => go('analyse')} />}
          {v === 'analyse' && <AnalyseStep next={() => go('review')} />}
          {v === 'review' && <ReviewStep open={go} />}
          {v === 'ask' && <AskStep />}
          {v === 'connections' && <ConnectionsView />}
          {v === 'radius' && <RadiusView />}
          {v === 'window' && <WindowView />}
          {v === 'changes' && <ChangesView />}
          {v === 'motive' && <MotiveView />}
        </main>
      </div>

      <AskPanel open={askOpen} onClose={() => setAskOpen(false)} />
      <EnvelopeDrawer />
      <FindingDrawer finding={c.finding} onClose={() => c.openFinding(null)} />
    </div>
  )
}

function Search({ onPick }: { onPick: (f: import('../../api').Finding) => void }) {
  const c = useCase()
  const [q, setQ] = useState('')
  const findings = useMemo(() => {
    const all = c.briefing?.incidents.flatMap((i) => i.findings) ?? []
    const seen = new Set<string>()
    return all.filter((f) => (seen.has(f.statement) ? false : (seen.add(f.statement), true)))
  }, [c.briefing])
  const ql = q.toLowerCase().trim()
  const hits = ql
    ? findings.filter((f) => f.statement.toLowerCase().includes(ql) || f.evidence_ids.some((id) => id.includes(ql)) || f.people.some((p) => p.includes(ql))).slice(0, 6)
    : []
  const row = ql && ROWS.get(ql)
  return (
    <div className="relative ml-auto w-80">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search findings or row ids"
        className="h-7 w-full rounded-md border border-line bg-page px-2.5 text-[12px] text-ink placeholder:text-ink-3 focus:border-line-strong focus:outline-none"
      />
      {ql && (
        <div className="absolute right-0 top-8 z-40 w-[440px] rounded-lg border border-line bg-surface p-1 shadow-lg">
          {row && (
            <div className="border-b border-line px-2.5 py-2 text-[12px]">
              <div className="font-mono text-[11px] text-ink-3">{row.id} · {row.provenance.file}:{row.provenance.line}</div>
              <div className="text-ink">{row.summary}</div>
            </div>
          )}
          {hits.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                onPick(f)
                setQ('')
              }}
              className="block w-full rounded-md px-2.5 py-2 text-left text-[12px] text-ink hover:bg-sunken"
            >
              {f.statement}
            </button>
          ))}
          {!row && hits.length === 0 && <div className="px-2.5 py-2 text-[12px] text-ink-3">No matches{findings.length ? '' : ' (run the analysis first)'}</div>}
        </div>
      )}
    </div>
  )
}
