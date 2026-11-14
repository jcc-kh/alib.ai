// Stage ③ brief refines, standing in for the deepagents run.
// Each brief item is matched to existing incidents first (match_brief_item); targeted checks run
// only for items the sweep did not cover. Routing is keyword-based here; the real orchestrator routes.

import type { AgentEvent, Brief, Finding, Report, Section, SubagentName, Todo } from '../api/types'
import { ASSUMPTIONS, NEXT_STEPS } from './data'
import { INCIDENT_OF, SCENARIOS, SIGNAL_OF, cannotTellFinding, route, scenarioFinding, type ScenarioId } from './findings'
import { INCIDENTS } from './signals'

export interface Plan {
  events: { delay: number; event: AgentEvent }[]
  report: Report
}

/** Findings a matched item pulls in. The money question also pulls in the chained gap finding. */
const ITEM_FINDINGS: Partial<Record<ScenarioId, ScenarioId[]>> = { S4b: ['S4b', 'G1'] }

export function planRun(brief: Brief): Plan {
  const items: { box: keyof Brief; text: string }[] = [
    ...brief.believe.map((text) => ({ box: 'believe' as const, text })),
    ...brief.confused.map((text) => ({ box: 'confused' as const, text })),
    ...brief.unknown.map((text) => ({ box: 'unknown' as const, text })),
  ].filter((i) => i.text.trim())

  const findings: Finding[] = []
  const coveredIncidents = new Set<string>()
  const coveredScenarios = new Set<ScenarioId>()
  const todos: Todo[] = items.map((it, i) => ({ id: `t${i + 1}`, label: it.text, status: 'pending' }))
  todos.push({ id: 'rank', label: 'Re-rank incidents by relevance to the brief', status: 'pending' })
  todos.push({ id: 'write', label: 'Assemble and validate the report', status: 'pending' })

  const events: Plan['events'] = []
  const push = (delay: number, event: AgentEvent) => events.push({ delay, event })
  const setStatus = (id: string, status: Todo['status']) => {
    todos.find((x) => x.id === id)!.status = status
    push(0, { type: 'todos', todos: todos.map((x) => ({ ...x })) })
  }
  const nextId = () => `f${findings.length + 1}`

  push(400, { type: 'subagent', agent: 'orchestrator', status: 'start', note: 'Sweep and triage already done on case load; refining with the brief' })
  push(700, { type: 'subagent', agent: 'orchestrator', status: 'tool', tool: `write_todos(${todos.length} items)` })
  push(0, { type: 'todos', todos: todos.map((x) => ({ ...x })) })

  items.forEach((it, i) => {
    const todoId = `t${i + 1}`
    const sid = route(it.text)
    setStatus(todoId, 'in_progress')
    if (sid) {
      const inc = INCIDENT_OF[sid]
      const sc = SCENARIOS[sid]
      push(250, { type: 'subagent', agent: 'orchestrator', status: 'tool', todo_id: todoId, tool: `match_brief_item(…) → ${inc} [${SIGNAL_OF[sid].join(', ')}]` })
      push(500, { type: 'subagent', agent: sc.agent, status: 'start', todo_id: todoId, note: `Confirming ${inc} answers: ${it.text}` })
      push(600, { type: 'subagent', agent: sc.agent, status: 'tool', todo_id: todoId, tool: `read findings/${fileOf(sc.agent)} → reuse ${SIGNAL_OF[sid][0]}` })

      if (sid === 'S4b') {
        // Live follow-up chain across subagents (acceptance: at least one chained finding).
        push(500, { type: 'subagent', agent: 'location-analyst', status: 'tool', todo_id: todoId, tool: "location_gaps(person='ken', start='15 Apr', end='15 Apr')" })
        push(500, { type: 'subagent', agent: 'location-analyst', status: 'follow_up', to: 'financial-analyst', todo_id: todoId, note: 'Gap 14:00–16:30 is location_off: did money move during it?' })
        push(600, { type: 'subagent', agent: 'financial-analyst', status: 'tool', todo_id: todoId, tool: "get_events('ken', 'transactions', 14:00–16:30) → $4,500 at 15:40" })
        push(500, { type: 'subagent', agent: 'orchestrator', status: 'follow_up', to: 'comms-analyst', todo_id: todoId, note: 'Anything else sent during the gap?' })
        push(600, { type: 'subagent', agent: 'comms-analyst', status: 'tool', todo_id: todoId, tool: "search_messages('ken', 14:00–16:30) → 1 SMS at 15:10" })
        push(300, { type: 'subagent', agent: 'comms-analyst', status: 'done', todo_id: todoId, note: 'Chain merged into one finding' })
        push(100, { type: 'subagent', agent: 'location-analyst', status: 'done', todo_id: todoId })
      }
      push(400, { type: 'subagent', agent: sc.agent, status: 'done', todo_id: todoId, note: `${inc} matched, no new check needed` })

      coveredIncidents.add(inc)
      const section: Section = it.box === 'unknown' ? 'answers' : sc.verdictAsBelief === 'inconsistent' ? 'inconsistent' : 'confirmed'
      for (const s of ITEM_FINDINGS[sid] ?? [sid]) {
        if (coveredScenarios.has(s)) continue
        coveredScenarios.add(s)
        findings.push(scenarioFinding(s, { id: nextId(), section, brief_item: it.text, matched: true }))
      }
    } else {
      push(300, { type: 'subagent', agent: 'orchestrator', status: 'tool', todo_id: todoId, tool: 'match_brief_item(…) → no signal' })
      push(300, { type: 'subagent', agent: 'device-forensics', status: 'start', todo_id: todoId, note: `Targeted check: ${it.text}` })
      push(600, { type: 'subagent', agent: 'device-forensics', status: 'tool', todo_id: todoId, tool: 'get_coverage()' })
      push(400, { type: 'subagent', agent: 'device-forensics', status: 'done', todo_id: todoId, note: 'Outside coverage → cannot tell' })
      findings.push(cannotTellFinding(nextId(), it.text))
    }
    setStatus(todoId, 'done')
  })

  // Re-rank: incidents the brief touched come first; the rest go to "What you didn't ask about".
  setStatus('rank', 'in_progress')
  push(400, { type: 'subagent', agent: 'orchestrator', status: 'tool', todo_id: 'rank', tool: `rank_incidents(relevance={${[...coveredIncidents].map((i) => `${i}: high`).join(', ')}})` })
  // Findings the brief did not ask about directly go to "What you didn't ask about", even when a
  // sibling finding in the same incident answered a brief item (e.g. S1 sits in INC-3 with S2).
  for (const inc of INCIDENTS) {
    const sids = (Object.keys(INCIDENT_OF) as ScenarioId[]).filter((s) => INCIDENT_OF[s] === inc.incident_id && s !== 'S4a')
    for (const s of sids) {
      if (coveredScenarios.has(s)) continue
      coveredScenarios.add(s)
      findings.push(scenarioFinding(s, { id: nextId(), section: 'unprompted', brief_item: null }))
    }
  }
  setStatus('rank', 'done')

  setStatus('write', 'in_progress')
  // The report is assembled in code (no report-writer agent); the orchestrator writes only next steps.
  push(300, { type: 'subagent', agent: 'orchestrator', status: 'tool', todo_id: 'write', tool: `assemble_report(${findings.length} findings)` })
  push(900, { type: 'subagent', agent: 'orchestrator', status: 'tool', todo_id: 'write', tool: `validate_report(${findings.length} statements + next steps) → ${findings.length} passed, 0 dropped` })
  setStatus('write', 'done')
  push(200, { type: 'subagent', agent: 'orchestrator', status: 'done', note: 'Report ready' })

  // The mock takes no statements yet, so there are no per-person claims, and no planted suspect windows.
  return { events, report: { assumptions: ASSUMPTIONS, findings, next_steps: NEXT_STEPS, by_person: [], reliability_notes: [], leads: [] } }
}

function fileOf(agent: SubagentName) {
  return (
    { 'location-analyst': 'location.json', 'comms-analyst': 'comms.json', 'relationship-mapper': 'relationships.json', 'financial-analyst': 'financial.json', 'device-forensics': 'device.json' } as Record<string, string>
  )[agent] ?? 'orchestrator.json'
}
