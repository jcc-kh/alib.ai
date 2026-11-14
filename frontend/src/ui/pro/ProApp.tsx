import { useEffect, useMemo, useRef, useState } from 'react'
import { atLeast, useCase, type Stage } from '../../state/caseStore'
import { ROWS } from '../../mock/data'
import FindingDrawer from '../../components/FindingDrawer'
import IngestStep from './steps/IngestStep'
import AnalyseStep from './steps/AnalyseStep'
import ReviewStep from './steps/ReviewStep'
import RefineStep from './steps/RefineStep'
import AskStep from './steps/AskStep'
import TimelineView from './steps/TimelineView'
import SignalsView from './steps/SignalsView'
import { ActivityView, DistanceView, PlacesView } from './steps/ChartViews'
import EnvelopeDrawer from './EnvelopeDrawer'
import AskPanel from './AskPanel'

export type View = 'ingest' | 'analyse' | 'review' | 'refine' | 'ask' | 'timeline' | 'activity' | 'distance' | 'places' | 'signals'

const STEPS: { id: View; label: string; needs: Stage }[] = [
  { id: 'ingest', label: 'Ingest', needs: 'empty' },
  { id: 'analyse', label: 'Analyse', needs: 'ingested' },
  { id: 'review', label: 'Review', needs: 'analysed' },
  { id: 'refine', label: 'Refine with brief', needs: 'analysed' },
  { id: 'ask', label: 'Ask', needs: 'analysed' },
]
const MORE: { id: View; label: string }[] = [
  { id: 'activity', label: 'Activity' },
  { id: 'timeline', label: 'Location timeline' },
  { id: 'places', label: 'Places' },
  { id: 'distance', label: 'Distance between phones' },
  { id: 'signals', label: 'Signals' },
]

function stepDone(id: View, stage: Stage) {
  if (id === 'ingest') return atLeast(stage, 'ingested')
  if (id === 'analyse') return atLeast(stage, 'analysed')
  if (id === 'review') return atLeast(stage, 'analysed')
  if (id === 'refine') return stage === 'refined'
  return false
}

export default function ProApp({ view, go, theme, toggleTheme, switchSkin }: { view: string; go: (v: View) => void; theme: 'light' | 'dark'; toggleTheme: () => void; switchSkin: () => void }) {
  const c = useCase()
  const [askOpen, setAskOpen] = useState(false)
  const ff = useRef(false)
  const v: View = (STEPS.concat(MORE as never).find((s) => s.id === view)?.id as View) ?? 'ingest'
  const allowed = (id: View) => {
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

  return (
    <div className="flex h-full bg-page text-ink">
      {/* Rail */}
      <aside className="flex w-[232px] shrink-0 flex-col border-r border-line bg-surface">
        <div className="flex h-12 items-center gap-2 border-b border-line px-4">
          <span className="grid h-6 w-6 place-items-center rounded bg-ink text-[11px] font-bold text-surface">A</span>
          <span className="text-[14px] font-semibold">Alib.ai</span>
          <span className="ml-auto rounded border border-line px-1.5 text-[10px] text-ink-3">mock</span>
        </div>
        <div className="border-b border-line px-4 py-3">
          <div className="text-[11px] text-ink-3">Case</div>
          <div className="text-[13px] font-medium leading-snug">Harbor Supply Co. missing funds</div>
          <div className="mt-1 text-[11px] text-ink-3">13–19 Apr 2026 · 4 phones · synthetic</div>
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
                    {s.id === 'refine' && c.stage === 'refining' && <span className="pulse-dot ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="px-2 pb-1.5 pt-5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">Views</div>
          {MORE.map((m) => (
            <button
              key={m.id}
              disabled={!allowed(m.id)}
              onClick={() => go(m.id)}
              className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-[13px] transition disabled:cursor-not-allowed disabled:text-ink-3/60 ${v === m.id ? 'bg-sunken font-medium' : 'text-ink-2 hover:bg-sunken'}`}
            >
              {m.label}
            </button>
          ))}
        </nav>
        <div className="space-y-1 border-t border-line p-3 text-[12px]">
          {c.stage === 'empty' && (
            <button
              onClick={async () => {
                await c.fastForward()
                go('review')
              }}
              className="w-full rounded-md px-2 py-1.5 text-left text-ink-2 hover:bg-sunken"
            >
              Load completed demo case
            </button>
          )}
          <button
            onClick={() => {
              c.reset()
              go('ingest')
            }}
            className="w-full rounded-md px-2 py-1.5 text-left text-ink-3 hover:bg-sunken"
          >
            Reset case
          </button>
          <button onClick={switchSkin} className="w-full rounded-md px-2 py-1.5 text-left text-ink-3 hover:bg-sunken">
            Switch to case-file view
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
          <div className="text-[13px] text-ink-3">
            Harbor Supply Co. <span className="px-1">/</span>
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
          {v === 'review' && <ReviewStep next={() => go('refine')} open={go} />}
          {v === 'refine' && <RefineStep next={() => go('ask')} />}
          {v === 'ask' && <AskStep />}
          {v === 'timeline' && <TimelineView />}
          {v === 'activity' && <ActivityView />}
          {v === 'places' && <PlacesView />}
          {v === 'distance' && <DistanceView />}
          {v === 'signals' && <SignalsView />}
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
    const all = [...(c.briefing?.incidents.flatMap((i) => i.findings) ?? []), ...(c.refine.report?.findings ?? [])]
    const seen = new Set<string>()
    return all.filter((f) => (seen.has(f.statement) ? false : (seen.add(f.statement), true)))
  }, [c.briefing, c.refine.report])
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
