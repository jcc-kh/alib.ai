// Builds a report and a scripted agent timeline from a brief, standing in for the deepagents run.
// Routing is keyword-based here; in the real system the orchestrator LLM routes. Statements,
// numbers and derivations come from mock/findings.ts, mirroring check output in the real system.

import type { AgentEvent, Brief, Finding, Report, Section, SubagentName, Todo } from '../api/types'
import { ASSUMPTIONS, NEXT_STEPS } from './data'
import { SCENARIOS, SWEEP_ORDER, cannotTellFinding, route, scenarioFinding } from './findings'

export interface Plan {
  events: { delay: number; event: AgentEvent }[]
  report: Report
}

export function planRun(brief: Brief): Plan {
  const items: { box: keyof Brief; text: string }[] = [
    ...brief.believe.map((text) => ({ box: 'believe' as const, text })),
    ...brief.confused.map((text) => ({ box: 'confused' as const, text })),
    ...brief.unknown.map((text) => ({ box: 'unknown' as const, text })),
  ].filter((i) => i.text.trim())

  const findings: Finding[] = []
  const covered = new Set<string>()
  const todos: Todo[] = items.map((it, i) => ({ id: `t${i + 1}`, label: it.text, status: 'pending' }))
  todos.push({ id: 'sweep', label: 'Unprompted sweep across every pair of phones', status: 'pending' })
  todos.push({ id: 'write', label: 'Write and validate the report', status: 'pending' })

  const events: Plan['events'] = []
  const push = (delay: number, event: AgentEvent) => events.push({ delay, event })
  const setStatus = (id: string, status: Todo['status']) => {
    todos.find((x) => x.id === id)!.status = status
    push(0, { type: 'todos', todos: todos.map((x) => ({ ...x })) })
  }
  const nextId = () => `f${findings.length + 1}`

  push(500, { type: 'subagent', agent: 'orchestrator', status: 'start', note: 'Splitting the brief into checkable items' })
  push(900, { type: 'subagent', agent: 'orchestrator', status: 'tool', tool: `write_todos(${todos.length} items)` })
  push(0, { type: 'todos', todos: todos.map((x) => ({ ...x })) })

  items.forEach((it, i) => {
    const todoId = `t${i + 1}`
    const sid = route(it.text)
    setStatus(todoId, 'in_progress')
    if (sid) {
      const sc = SCENARIOS[sid]
      covered.add(sc.family)
      const agents: SubagentName[] = sid === 'S5' ? ['relationship-mapper', 'location-analyst'] : [sc.agent]
      sc.tools.forEach((tool, k) => {
        const agent = agents[Math.min(k, agents.length - 1)]
        push(250, { type: 'subagent', agent, status: 'start', todo_id: todoId, note: it.text })
        push(700, { type: 'subagent', agent, status: 'tool', todo_id: todoId, tool })
        push(500, { type: 'subagent', agent, status: 'done', todo_id: todoId, note: `${sc.evidence.length} evidence rows` })
      })
      const section: Section = it.box === 'unknown' ? 'answers' : sc.verdictAsBelief === 'inconsistent' ? 'inconsistent' : 'confirmed'
      findings.push(scenarioFinding(sid, { id: nextId(), section, brief_item: it.text }))
    } else {
      push(250, { type: 'subagent', agent: 'device-forensics', status: 'start', todo_id: todoId, note: it.text })
      push(600, { type: 'subagent', agent: 'device-forensics', status: 'tool', todo_id: todoId, tool: 'get_coverage()' })
      push(500, { type: 'subagent', agent: 'device-forensics', status: 'done', todo_id: todoId, note: 'Outside coverage → cannot tell' })
      findings.push(cannotTellFinding(nextId(), it.text))
    }
    setStatus(todoId, 'done')
  })

  setStatus('sweep', 'in_progress')
  push(300, { type: 'subagent', agent: 'orchestrator', status: 'tool', todo_id: 'sweep', tool: 'run_sweep(pairs=6, checks=5)' })
  const sweepers: SubagentName[] = ['comms-analyst', 'location-analyst', 'financial-analyst', 'device-forensics']
  for (const a of sweepers) push(200, { type: 'subagent', agent: a, status: 'start', todo_id: 'sweep', note: 'Sweep' })
  push(1200, { type: 'subagent', agent: 'orchestrator', status: 'tool', todo_id: 'sweep', tool: 'dedupe_against_brief()' })
  for (const a of sweepers) push(100, { type: 'subagent', agent: a, status: 'done', todo_id: 'sweep', note: 'Sweep done' })
  for (const sid of SWEEP_ORDER) {
    const sc = SCENARIOS[sid]
    if (covered.has(sc.family)) continue
    covered.add(sc.family)
    findings.push(scenarioFinding(sid, { id: nextId(), section: 'unprompted', brief_item: null }))
  }
  setStatus('sweep', 'done')

  setStatus('write', 'in_progress')
  push(300, { type: 'subagent', agent: 'report-writer', status: 'start', todo_id: 'write', note: `${findings.length} findings` })
  push(1100, { type: 'subagent', agent: 'report-writer', status: 'tool', todo_id: 'write', tool: `validate_report(${findings.length} statements)` })
  push(500, { type: 'subagent', agent: 'report-writer', status: 'done', todo_id: 'write', note: `${findings.length} passed, 0 dropped` })
  setStatus('write', 'done')
  push(200, { type: 'subagent', agent: 'orchestrator', status: 'done', note: 'Report ready' })

  return { events, report: { assumptions: ASSUMPTIONS, findings, next_steps: NEXT_STEPS } }
}
