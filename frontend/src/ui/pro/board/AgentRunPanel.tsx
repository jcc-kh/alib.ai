import { useState } from 'react'
import { useCase } from '../../../state/caseStore'
import { exhibitOf } from '../../../mock/sources'
import { personName } from '../../../mock/data'
import { AgentNetwork, PhaseBar, RunLog, Trace, useRunClock } from '../agents/AgentRun'

/** Height of the open sheet; the dashboard pads its bottom by this much so nothing hides behind it. */
export const SHEET_OPEN = '52vh'
export const SHEET_MIN = '48px'

/**
 * Bottom sheet shown when a phone is added: the subagents run again over every loaded phone.
 * The agent network and run log play live while the dashboard above updates; once done it stays
 * until closed, and can be minimised to its header bar.
 */
export default function AgentRunPanel({ min, onToggle }: { min: boolean; onToggle: () => void }) {
  const c = useCase()
  const clock = useRunClock()
  const [timeline, setTimeline] = useState(false)
  if (!c.runFor || c.runStage === 'idle') return null
  const r = c.run
  const running = c.runStage === 'running'
  const who = c.loaded.includes(c.runFor) ? `${personName(c.runFor)}'s phone` : exhibitOf(c.runFor)
  const agentsDone = Object.keys(r.envelopes).length
  return (
    <section
      role="dialog"
      aria-label="Subagents"
      className={`sheet-up fixed inset-x-0 bottom-0 z-30 flex flex-col border-t bg-surface shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-[height] duration-300 ${running ? 'border-accent/60' : 'border-line-strong'}`}
      style={{ height: min ? SHEET_MIN : SHEET_OPEN }}
    >
      <header className="flex h-12 shrink-0 cursor-pointer items-center gap-x-3 border-b border-line px-4" onClick={onToggle}>
        {running && <span className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-accent" />}
        <h3 className="shrink-0 text-[13px] font-semibold text-ink">{running ? `Subagents re-running with ${who}` : `Subagents re-ran with ${who}`}</h3>
        <span className="tnum hidden truncate text-[11.5px] text-ink-3 md:inline">
          {c.runPhones.length} phones · {r.calls.length} tool calls · {r.hops.length} follow-up{r.hops.length === 1 ? '' : 's'} · {agentsDone} / 7 agents done
        </span>
        <div className="ml-auto flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <div className="hidden lg:block">
            <PhaseBar phase={r.phase} />
          </div>
          <span className="tnum w-12 text-right text-[12px] text-ink-2">{(clock / 1000).toFixed(1)} s</span>
          <button onClick={onToggle} className="rounded-md px-1.5 text-[13px] text-ink-3 hover:bg-sunken hover:text-ink" title={min ? 'Expand' : 'Minimise'}>
            {min ? '▴' : '▾'}
          </button>
          {!running && (
            <button onClick={c.closeRun} className="rounded-md px-1.5 text-[12px] text-ink-3 hover:bg-sunken hover:text-ink" title="Close">
              ✕
            </button>
          )}
        </div>
      </header>
      {!min && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-12 gap-3 p-3">
            <div className="col-span-12 lg:col-span-8">
              <AgentNetwork clock={clock} />
              <div className="mt-1 text-[11.5px] text-ink-3">Click a finished agent to open what it found.</div>
            </div>
            <div className="col-span-12 flex flex-col rounded-md border border-line lg:col-span-4">
              <div className="border-b border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">Run log</div>
              <RunLog clock={clock} height={360} />
            </div>
          </div>
          <div className="border-t border-line px-4 py-2">
            <button onClick={() => setTimeline((v) => !v)} className="text-[12px] text-ink-2 hover:text-ink">
              {timeline ? '▾ Hide' : '▸ Show'} what each agent did, over time
            </button>
            {timeline && (
              <div className="mt-2">
                <Trace clock={clock} />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
