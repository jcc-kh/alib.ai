import { useMemo, useState } from 'react'
import { useCase } from '../../state/caseStore'
import { ROWS } from '../../mock/data'
import FindingDrawer from '../../components/FindingDrawer'
import AskPanel from './AskPanel'
import CasesView from './CasesView'
import BoardView from './board/BoardView'
import WindowView from './inquiries/WindowView'
import MotiveView from './inquiries/MotiveView'
import InterviewsView from './interviews/InterviewsView'
import { INQUIRIES } from './inquiries/meta'
import type { InquiryId } from '../../api'

export type View = 'cases' | 'board' | 'interviews' | InquiryId

const VIEWS: { id: View; label: string }[] = [{ id: 'board', label: 'Board' }, ...INQUIRIES.filter((q) => q.id === 'window' || q.id === 'motive').map((q) => ({ id: q.id as View, label: q.label })), { id: 'interviews', label: 'Interviews' }]

export default function ProApp({ view, go, theme, toggleTheme }: { view: string; go: (v: View) => void; theme: 'light' | 'dark'; toggleTheme: () => void }) {
  const c = useCase()
  const [askOpen, setAskOpen] = useState(false)
  const v: View = view === 'cases' ? 'cases' : (VIEWS.find((s) => s.id === view)?.id ?? 'board')

  if (v === 'cases') return <CasesView open={go} theme={theme} toggleTheme={toggleTheme} />

  return (
    <div className="flex h-full flex-col bg-page text-ink">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <button onClick={() => go('cases')} title="All cases" className="flex items-center gap-2 rounded-md pr-2 hover:bg-sunken">
          <span className="grid h-6 w-6 place-items-center rounded bg-ink text-[11px] font-bold text-surface">A</span>
          <span className="text-[14px] font-semibold">Alib.ai</span>
        </button>
        <span className="text-line-strong">/</span>
        <span className="text-[13px] font-medium text-ink">{c.caseName}</span>
        <nav className="ml-3 flex items-center gap-0.5 rounded-lg bg-sunken p-0.5">
          {VIEWS.map((s) => (
            <button
              key={s.id}
              onClick={() => go(s.id)}
              className={`rounded-md px-2.5 py-1 text-[12px] transition ${v === s.id ? 'bg-surface font-medium text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}
            >
              {s.label}
              {s.id === 'interviews' ? <InterviewCount /> : s.id !== 'board' && <InquiryCount id={s.id as InquiryId} />}
            </button>
          ))}
        </nav>
        <Search onPick={(f) => c.openFinding(f)} />
        <button onClick={toggleTheme} title="Toggle theme" className="grid h-7 w-7 place-items-center rounded-md border border-line text-[13px] text-ink-2 hover:bg-sunken">
          {theme === 'light' ? '☾' : '☀'}
        </button>
        <button
          onClick={() => {
            c.reset()
            go('board')
          }}
          disabled={c.loaded.length <= 2 && !c.askTurns.length && !c.ingesting && !c.transcripts.length && !c.reading}
          title="Remove the added phones, verified transcripts and Ask history: back to the two-phone start"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2 text-[12px] text-ink-2 hover:bg-sunken hover:text-ink disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
        >
          ↺ Reset demo
        </button>
        <button onClick={() => setAskOpen(true)} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-ink px-3 text-[12px] font-medium text-surface">
          Ask
        </button>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        {v === 'board' && <BoardView open={go} />}
        {v !== 'board' && (
          <div className="px-4 pt-3">
            <button onClick={() => go('board')} className="rounded-md px-1.5 py-0.5 text-[12px] text-ink-2 hover:bg-sunken hover:text-ink">
              ← Board
            </button>
          </div>
        )}
        {v === 'window' && <WindowView />}
        {v === 'motive' && <MotiveView />}
        {v === 'interviews' && <InterviewsView />}
      </main>

      <AskPanel open={askOpen} onClose={() => setAskOpen(false)} />
      <FindingDrawer
        finding={c.finding}
        item={c.evidence}
        onClose={() => {
          c.openFinding(null)
          c.openEvidence(null)
        }}
      />
    </div>
  )
}

function InterviewCount() {
  const c = useCase()
  if (c.reading) return <span className="pulse-dot ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent" />
  return c.transcripts.length ? <span className="tnum ml-1 text-[10.5px] text-ink-3">{c.transcripts.length}</span> : null
}

function InquiryCount({ id }: { id: InquiryId }) {
  const c = useCase()
  const n = c.board.incidents.filter((i) => i.inquiry === id).length
  return n ? <span className="tnum ml-1 text-[10.5px] text-ink-3">{n}</span> : null
}

function Search({ onPick }: { onPick: (f: import('../../api').Finding) => void }) {
  const c = useCase()
  const [q, setQ] = useState('')
  const findings = useMemo(() => {
    const all = c.board.incidents.flatMap((i) => i.findings)
    const seen = new Set<string>()
    return all.filter((f) => (seen.has(f.statement) ? false : (seen.add(f.statement), true)))
  }, [c.board.incidents])
  const ql = q.toLowerCase().trim()
  const hits = ql
    ? findings.filter((f) => f.statement.toLowerCase().includes(ql) || f.evidence_ids.some((id) => id.includes(ql)) || f.people.some((p) => p.includes(ql))).slice(0, 6)
    : []
  const found = ql ? ROWS.get(ql) : undefined
  const row = found && c.loaded.includes(found.device_owner) ? found : undefined
  return (
    <div className="relative ml-auto w-72">
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
              <div className="font-mono text-[11px] text-ink-3">
                {row.id} · {row.provenance.file}:{row.provenance.line}
              </div>
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
          {!row && hits.length === 0 && <div className="px-2.5 py-2 text-[12px] text-ink-3">No matches</div>}
        </div>
      )}
    </div>
  )
}
