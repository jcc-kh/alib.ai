// Builds a report and a scripted agent timeline from a brief, standing in for the deepagents run.
// Routing is keyword-based here. In the real system the orchestrator LLM does the routing, while
// the statements and numbers come from check output exactly as they do below.

import type { AgentEvent, Brief, CheckName, CheckOutput, Finding, Report, Section, SubagentName, Todo, Verdict } from '../api/types'
import { ASSUMPTIONS, COVERAGE_IDS, NEXT_STEPS, S1, S2, S4, S4_FIRST, S5, S7, coverageFor } from './data'
import { fmtKm } from '../lib/format'

type ScenarioId = 'S1' | 'S2' | 'S4a' | 'S4b' | 'S5' | 'S7'

interface ScenarioFinding {
  scenario: ScenarioId
  family: string // S4a and S4b share the "S4" family for sweep de-duplication
  check: CheckName
  agents: { agent: SubagentName; tool: string }[]
  people: string[]
  verdictAsBelief: Verdict
  statement: string
  output: CheckOutput
  evidence: string[]
}

const SCENARIOS: Record<ScenarioId, ScenarioFinding> = {
  S2: {
    scenario: 'S2', family: 'S2', check: 'distance_between', people: ['paul', 'amy'], verdictAsBelief: 'inconsistent',
    agents: [{ agent: 'location-analyst', tool: "distance_between('paul', 'amy', '14 Apr 18:00', '14 Apr 21:00')" }],
    statement: `Paul's and Amy's phones were between ${fmtKm(S2.min_m)} and ${fmtKm(S2.max_m)} apart from 18:00 to 21:00 on 14 April, with Paul's phone at Sunset Park and Amy's at Northgate Mall.`,
    output: S2,
    evidence: S2.slots.flatMap((s) => [s.a.id, s.b.id]),
  },
  S5: {
    scenario: 'S5', family: 'S5', check: 'silent_meetings', people: ['paul', 'cara'], verdictAsBelief: 'inconsistent',
    agents: [
      { agent: 'relationship-mapper', tool: "contact_graph(['paul', 'cara'])" },
      { agent: 'location-analyst', tool: "silent_meetings('13 Apr', '19 Apr')" },
    ],
    statement: `Paul's and Cara's phones were within ${S5.thresholds.within_m} m of each other at Dock Cafe on ${S5.occasions.length} separate days, and no message or call between them exists on any phone.`,
    output: S5,
    evidence: S5.occasions.flatMap((o) => o.row_ids),
  },
  S4a: {
    scenario: 'S4a', family: 'S4', check: 'money_chains', people: ['paul', 'ken'], verdictAsBelief: 'confirmed',
    agents: [{ agent: 'financial-analyst', tool: "get_events('paul', 'transactions', '15 Apr')" }],
    statement: `Paul's and Ken's phones both show a $${S4.links[0].amount.toLocaleString()} Swiftpay transfer from Paul to Ken on 15 April at 11:05, with no memo.`,
    output: S4_FIRST,
    evidence: S4.links[0].row_ids,
  },
  S4b: {
    scenario: 'S4b', family: 'S4', check: 'money_chains', people: ['paul', 'ken', 'cara'], verdictAsBelief: 'confirmed',
    agents: [{ agent: 'financial-analyst', tool: "money_chains('13 Apr', '19 Apr')" }],
    statement: `Ken's phone shows a $${S4.links[1].amount.toLocaleString()} transfer to Cara at 15:40 on 15 April, ${S4.gap_label} after it received $${S4.links[0].amount.toLocaleString()} from Paul, and Cara's phone shows it arriving.`,
    output: S4,
    evidence: S4.links.flatMap((l) => l.row_ids),
  },
  S7: {
    scenario: 'S7', family: 'S7', check: 'synchronised_behaviour', people: ['paul', 'ken', 'cara'], verdictAsBelief: 'confirmed',
    agents: [
      { agent: 'device-forensics', tool: "synchronised_behaviour('13 Apr', '19 Apr')" },
      { agent: 'device-forensics', tool: "search_messages('audit')" },
    ],
    statement: `Paul's, Ken's and Cara's phones each deleted a thread and powered off within one ${S7.window.minutes}-minute window that began ${S7.trigger!.minutes_before_window} minutes after Paul's phone received the audit announcement.`,
    output: S7,
    evidence: [S7.trigger!.id, ...S7.events.map((e) => e.id)],
  },
  S1: {
    scenario: 'S1', family: 'S1', check: 'missing_messages', people: ['paul', 'amy'], verdictAsBelief: 'confirmed',
    agents: [{ agent: 'comms-analyst', tool: "missing_messages('paul', 'amy', '13 Apr', '19 Apr')" }],
    statement: `${['Zero', 'One', 'Two', 'Three', 'Four'][S1.missing_count] ?? S1.missing_count} messages from Paul to Amy sent at 18:32 on 14 April are on Paul's phone but missing from Amy's phone, which deleted that thread on 17 April at 20:15.`,
    output: S1,
    evidence: [...S1.items.flatMap((i) => [i.on_a, i.on_b]).filter((x): x is string => !!x), ...S1.deletion_events.map((e) => e.id)],
  },
}

/** Which scenario a brief item is about. null means the phones can't settle it. */
function route(text: string): ScenarioId | null {
  const t = text.toLowerCase()
  if (/\b(march|january|february|2025)\b/.test(t)) return null // outside data coverage
  if (/together|with each other|same place/.test(t) && t.includes('amy') && t.includes('paul')) return 'S2'
  if (/know each other|never met|don.t know|strangers/.test(t) && t.includes('cara')) return 'S5'
  if (/5,?000/.test(t) || (t.includes('sent ken') && /\$/.test(t))) return 'S4a'
  if (/money|funds|end up|where did/.test(t)) return 'S4b'
  if (/audit|react|announcement/.test(t)) return 'S7'
  if (/deleted|missing message|texts?/.test(t) && t.includes('amy')) return 'S1'
  return null
}

const SWEEP_ORDER: ScenarioId[] = ['S1', 'S2', 'S5', 'S4b', 'S7']

export interface Plan {
  todos: Todo[]
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
  todos.push({ id: 'sweep', label: 'Unprompted sweep: all checks, every pair of phones, 13–19 April', status: 'pending' })
  todos.push({ id: 'write', label: 'Write and validate report', status: 'pending' })

  const events: Plan['events'] = []
  const push = (delay: number, event: AgentEvent) => events.push({ delay, event })
  const setStatus = (id: string, status: Todo['status']) => {
    const t = todos.find((x) => x.id === id)!
    t.status = status
    push(0, { type: 'todos', todos: todos.map((x) => ({ ...x })) })
  }

  // Snapshot the initial todo list (write_todos).
  push(500, { type: 'subagent', agent: 'orchestrator', status: 'start', note: 'Splitting brief into checkable items' })
  push(900, { type: 'subagent', agent: 'orchestrator', status: 'tool', tool: `write_todos(${todos.length} items)` })
  push(0, { type: 'todos', todos: todos.map((x) => ({ ...x })) })

  items.forEach((it, i) => {
    const todoId = `t${i + 1}`
    const sid = route(it.text)
    setStatus(todoId, 'in_progress')
    if (sid) {
      const sc = SCENARIOS[sid]
      covered.add(sc.family)
      for (const a of sc.agents) {
        push(250, { type: 'subagent', agent: a.agent, status: 'start', todo_id: todoId, note: it.text })
        push(700, { type: 'subagent', agent: a.agent, status: 'tool', todo_id: todoId, tool: a.tool })
        push(600, { type: 'subagent', agent: a.agent, status: 'done', todo_id: todoId, note: `${sc.evidence.length} evidence rows` })
      }
      const section: Section = it.box === 'unknown' ? 'answers' : sc.verdictAsBelief === 'inconsistent' ? 'inconsistent' : 'confirmed'
      findings.push({
        id: `f${findings.length + 1}`,
        section,
        brief_item: it.text,
        verdict: it.box === 'unknown' ? 'confirmed' : sc.verdictAsBelief,
        statement: sc.statement,
        people: sc.people,
        check: sc.check,
        agent: sc.agents[sc.agents.length - 1].agent,
        evidence_ids: sc.evidence,
        check_output: sc.output,
      })
    } else {
      push(250, { type: 'subagent', agent: 'device-forensics', status: 'start', todo_id: todoId, note: it.text })
      push(600, { type: 'subagent', agent: 'device-forensics', status: 'tool', todo_id: todoId, tool: 'get_coverage()' })
      push(500, { type: 'subagent', agent: 'device-forensics', status: 'done', todo_id: todoId, note: 'Outside data coverage → cannot_tell' })
      findings.push({
        id: `f${findings.length + 1}`,
        section: 'answers',
        brief_item: it.text,
        verdict: 'cannot_tell',
        statement: 'The four phones only hold data from 13 to 19 April 2026, so they cannot settle this item.',
        people: ['paul', 'amy', 'ken', 'cara'],
        check: 'get_coverage',
        agent: 'device-forensics',
        evidence_ids: COVERAGE_IDS,
        check_output: coverageFor(it.text),
      })
    }
    setStatus(todoId, 'done')
  })

  // Sweep: every check, every pair. Results not covered by a brief item become "unprompted".
  setStatus('sweep', 'in_progress')
  push(300, { type: 'subagent', agent: 'orchestrator', status: 'tool', todo_id: 'sweep', tool: 'run_sweep(pairs=6, checks=5)' })
  for (const a of ['comms-analyst', 'location-analyst', 'financial-analyst', 'device-forensics'] as SubagentName[]) {
    push(200, { type: 'subagent', agent: a, status: 'start', todo_id: 'sweep', note: 'Sweep' })
  }
  push(1200, { type: 'subagent', agent: 'orchestrator', status: 'tool', todo_id: 'sweep', tool: 'dedupe_against_brief()' })
  for (const a of ['comms-analyst', 'location-analyst', 'financial-analyst', 'device-forensics'] as SubagentName[]) {
    push(100, { type: 'subagent', agent: a, status: 'done', todo_id: 'sweep', note: 'Sweep done' })
  }
  for (const sid of SWEEP_ORDER) {
    const sc = SCENARIOS[sid]
    if (covered.has(sc.family)) continue
    covered.add(sc.family)
    findings.push({
      id: `f${findings.length + 1}`,
      section: 'unprompted',
      brief_item: null,
      verdict: 'confirmed',
      statement: sc.statement,
      people: sc.people,
      check: sc.check,
      agent: sc.agents[sc.agents.length - 1].agent,
      evidence_ids: sc.evidence,
      check_output: sc.output,
    })
  }
  setStatus('sweep', 'done')

  setStatus('write', 'in_progress')
  push(300, { type: 'subagent', agent: 'report-writer', status: 'start', todo_id: 'write', note: `${findings.length} findings` })
  push(1100, { type: 'subagent', agent: 'report-writer', status: 'tool', todo_id: 'write', tool: `validate_report(${findings.length} statements)` })
  push(500, { type: 'subagent', agent: 'report-writer', status: 'done', todo_id: 'write', note: `${findings.length} passed, 0 dropped` })
  setStatus('write', 'done')
  push(200, { type: 'subagent', agent: 'orchestrator', status: 'done', note: 'Report ready' })

  return { todos, events, report: { assumptions: ASSUMPTIONS, findings, next_steps: NEXT_STEPS } }
}
