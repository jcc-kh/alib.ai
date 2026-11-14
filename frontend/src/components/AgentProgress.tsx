import type { SubagentName, Todo } from '../api'

export interface LaneState {
  status: 'idle' | 'working' | 'done'
  calls: number
  log: string[]
}

export const AGENTS: { name: SubagentName; role: string }[] = [
  { name: 'orchestrator', role: 'Splits the brief, plans to-dos, routes items, runs the sweep' },
  { name: 'location-analyst', role: 'Together or apart; co-location patterns' },
  { name: 'comms-analyst', role: 'Messages and calls; missing or deleted texts' },
  { name: 'relationship-mapper', role: 'Who contacted whom, contacts, social links' },
  { name: 'financial-analyst', role: 'Transfers and onward money chains' },
  { name: 'device-forensics', role: 'Deletions, power-offs, triggers, coverage' },
  { name: 'report-writer', role: 'Assembles and validates the report' },
]

export default function AgentProgress({ todos, lanes }: { todos: Todo[]; lanes: Partial<Record<SubagentName, LaneState>> }) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Checking the brief against all phones…</h2>
        <p className="text-sm text-slate-500">The orchestrator's to-do list (deepagents write_todos) ticks off as each item finishes.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">To-do</div>
        {todos.length === 0 && <div className="pulse-dot text-sm text-slate-500">Planning…</div>}
        <ul className="space-y-1.5">
          {todos.map((t) => (
            <li key={t.id} className="flex items-start gap-2 text-sm">
              <span
                className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded text-[10px] font-bold ${
                  t.status === 'done' ? 'bg-emerald-500 text-white' : t.status === 'in_progress' ? 'pulse-dot bg-blue-500 text-white' : 'border border-slate-300'
                }`}
              >
                {t.status === 'done' ? '✓' : ''}
              </span>
              <span className={t.status === 'done' ? 'text-slate-500' : t.status === 'in_progress' ? 'font-medium' : ''}>{t.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Subagents</div>
        <div className="grid grid-cols-2 gap-2">
          {AGENTS.map((a) => {
            const l = lanes[a.name] ?? { status: 'idle', calls: 0, log: [] }
            return (
              <div
                key={a.name}
                className={`rounded-lg border p-2.5 ${l.status === 'working' ? 'border-blue-400 bg-blue-50' : l.status === 'done' ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${l.status === 'working' ? 'pulse-dot bg-blue-500' : l.status === 'done' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className="font-mono text-xs font-semibold">{a.name}</span>
                  <span className="ml-auto text-[10px] text-slate-500">{l.calls} tool calls</span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">{a.role}</div>
                <div className="mt-1.5 min-h-[2.5rem] space-y-0.5 font-mono text-[10.5px] text-slate-700">
                  {l.log.map((line, i) => (
                    <div key={i} className="truncate" title={line}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
