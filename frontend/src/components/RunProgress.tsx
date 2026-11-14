import type { SubagentName, Todo } from '../api'
import { Eyebrow, Title } from './ui'

export interface LaneState {
  status: 'idle' | 'working' | 'done'
  calls: number
  last: string
}

export const AGENTS: { name: SubagentName; role: string }[] = [
  { name: 'orchestrator', role: 'Plans, routes, sweeps' },
  { name: 'location-analyst', role: 'Together or apart' },
  { name: 'comms-analyst', role: 'Messages and calls' },
  { name: 'relationship-mapper', role: 'Who knows whom' },
  { name: 'financial-analyst', role: 'Money chains' },
  { name: 'device-forensics', role: 'Deletions, power-offs' },
  { name: 'report-writer', role: 'Writes and validates' },
]

export default function RunProgress({ todos, lanes }: { todos: Todo[]; lanes: Partial<Record<SubagentName, LaneState>> }) {
  const done = todos.filter((t) => t.status === 'done').length
  return (
    <div className="grid grid-cols-[1fr_1fr] gap-12">
      <div>
        <Eyebrow>Checking</Eyebrow>
        <Title size="lg" className="mt-2 mb-6">
          {todos.length ? `${done} of ${todos.length} done` : 'Planning…'}
        </Title>
        <div className="mb-6 h-px w-full bg-line">
          <div className="h-px bg-fg transition-all duration-500" style={{ width: todos.length ? `${(done / todos.length) * 100}%` : '0%' }} />
        </div>
        <ul className="space-y-3">
          {todos.map((t) => (
            <li key={t.id} className="flex items-start gap-3 text-[15px]">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.status === 'done' ? 'bg-sage' : t.status === 'in_progress' ? 'pulse-dot bg-azure-soft' : 'border border-line-strong'}`}
              />
              <span className={t.status === 'done' ? 'text-faint' : t.status === 'in_progress' ? 'text-fg' : 'text-muted'}>{t.label}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <Eyebrow>Agents</Eyebrow>
        <div className="mt-4 divide-y divide-line border-y border-line">
          {AGENTS.map((a) => {
            const l = lanes[a.name] ?? { status: 'idle', calls: 0, last: '' }
            return (
              <div key={a.name} className="grid grid-cols-[10rem_1fr_auto] items-center gap-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${l.status === 'working' ? 'pulse-dot bg-azure-soft' : l.status === 'done' ? 'bg-sage' : 'bg-line-strong'}`} />
                  <div>
                    <div className="font-mono text-xs text-fg">{a.name}</div>
                    <div className="text-[11px] text-faint">{a.role}</div>
                  </div>
                </div>
                <div className="truncate font-mono text-[11px] text-muted" title={l.last}>
                  {l.last}
                </div>
                <div className="text-[11px] text-faint">{l.calls} calls</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
