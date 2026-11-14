// The case-load run: stage ① sweep and stage ② triage, as a timed stream of agent events.
// Every `rows` figure is counted from the case store; every signal and finding comes from
// mock/signals.ts. In the real system this is GET /api/run/stream (SSE) from the deepagents run.

import type { AgentEnvelope, Dismissal, EvidenceRow, FollowUp, PersonId, RunEvent, SubagentName, ToolCall } from '../api/types'
import { G1, ROWS } from './data'
import { ANCHORS, DISMISSALS, INCIDENTS, SIGNALS, findingById } from './signals'
import { pairDistanceSeries } from '../lib/aggregates'

const CASE: PersonId[] = ['paul', 'amy', 'ken', 'cara']
const PAIRS: [PersonId, PersonId][] = [['paul', 'amy'], ['paul', 'ken'], ['paul', 'cara'], ['amy', 'ken'], ['amy', 'cara'], ['ken', 'cara']]
const count = (pred: (r: EvidenceRow) => boolean) => {
  let n = 0
  for (const r of ROWS.values()) if (pred(r)) n++
  return n
}
const locs = (p: PersonId) => count((r) => r.table === 'locations' && r.device_owner === p)
const of = (t: string) => count((r) => r.table === t)
const FILE: Record<SubagentName, string> = {
  orchestrator: 'findings/triage.json',
  'relationship-mapper': 'findings/relationships.json',
  'location-analyst': 'findings/location.json',
  'comms-analyst': 'findings/comms.json',
  'financial-analyst': 'findings/financial.json',
  'device-forensics': 'findings/device.json',
  'report-writer': 'findings/report.json',
}

export interface RunScript {
  events: RunEvent[]
  envelopes: AgentEnvelope[]
  total_ms: number
}

export function buildRunScript(): RunScript {
  const events: RunEvent[] = []
  const calls: ToolCall[] = []
  const hops: FollowUp[] = []
  let n = 0
  const call = (agent: SubagentName, start: number, ms: number, check: string, args: string, rows: number, result: string, follow_up_from?: SubagentName) => {
    const c: ToolCall = { id: `call_${String(++n).padStart(3, '0')}`, agent, check, args, rows, start_ms: start, ms, result, follow_up_from }
    calls.push(c)
    events.push({ type: 'tool', call: c })
    return start + ms
  }
  const log = (agent: SubagentName, at: number, text: string) => events.push({ type: 'log', agent, text, at_ms: at })
  const hop = (from: SubagentName, to: SubagentName, at: number, note: string) => {
    const h = { from, to, note, at_ms: at }
    hops.push(h)
    events.push({ type: 'follow_up', hop: h })
  }
  const state = (agent: SubagentName, status: 'running' | 'done', at: number) => events.push({ type: 'agent', agent, status, at_ms: at })

  // ---- ① sweep ----
  events.push({ type: 'phase', phase: 'sweep', at_ms: 0 })
  state('orchestrator', 'running', 0)
  log('orchestrator', 0, `run_sweep(): 5 domain agents × 6 phone pairs × 13–19 Apr over ${ROWS.size.toLocaleString()} rows`)
  let t = call('orchestrator', 100, 300, 'run_sweep', 'pairs=6, range=13–19 Apr', ROWS.size, 'dispatched 5 subagents')

  state('relationship-mapper', 'running', t)
  t = call('relationship-mapper', t, 700, 'identity_match', '()', of('contacts') + of('messages') + of('calls'), '4 people · 27 identifiers · 1 organisation')
  const rmEnd = call('relationship-mapper', t, 600, 'contact_graph', '()', of('messages') + of('calls') + of('transactions') + of('device_events'), '11 edges across 6 channels')
  log('relationship-mapper', rmEnd, 'People map written; other agents can now resolve numbers to people')
  state('relationship-mapper', 'done', rmEnd)

  const start = rmEnd + 100
  // location-analyst
  state('location-analyst', 'running', start)
  let tl = start
  for (const p of CASE) tl = call('location-analyst', tl, 260, 'location_timeline', `person='${p}'`, locs(p), 'stays · travel · gaps → stays table')
  for (const p of CASE) {
    const gaps = ({ paul: 1, amy: 1, ken: 3, cara: 1 } as Record<string, number>)[p]
    tl = call('location-analyst', tl, 220, 'location_gaps', `person='${p}', min_gap_min=45`, locs(p), `${gaps} gap${gaps > 1 ? 's' : ''}${p === 'ken' ? ' · 1 location_off' : ''}`)
  }
  for (const [a, b] of PAIRS) tl = call('location-analyst', tl, 180, 'distance_between', `'${a}', '${b}'`, pairDistanceSeries(a, b).length * 2, a === 'paul' && b === 'amy' ? '14 Apr 18:00–21:00: apart (min 23.1 km)' : 'no flagged window')
  tl = call('location-analyst', tl, 520, 'silent_meetings', 'within_m=100, min_minutes=20, min_occasions=2', of('locations'), 'paul–cara: 4 occasions, 0 contact rows')
  hop('location-analyst', 'financial-analyst', tl, `Ken's phone: no location data 15 Apr 14:00–16:30 while in use. Did money move during it?`)
  log('location-analyst', tl, 'Dismissed: Amy 16 Apr gap (unexplained, no overlap); Ken overnight gap (powered off); Amy–Ken FreshMart (1 occasion)')

  // comms-analyst
  state('comms-analyst', 'running', start + 150)
  let tc = start + 150
  for (const [a, b] of PAIRS) {
    const r = count((x) => x.table === 'messages' && (x.device_owner === a || x.device_owner === b) && [String(x.fields.from), String(x.fields.to)].some((v) => v.includes('010 0')))
    tc = call('comms-analyst', tc, 240, 'missing_messages', `'${a}', '${b}'`, r, a === 'paul' && b === 'amy' ? "3 messages on Paul's phone only · thread_deleted on Amy's" : 'none missing')
  }
  tc = call('comms-analyst', tc, 200, 'search_messages', "query='audit'", of('messages'), "1 match: Harbor Supply Finance → Paul's phone, 17 Apr 10:00")

  // device-forensics
  state('device-forensics', 'running', start + 300)
  let td = start + 300
  td = call('device-forensics', td, 300, 'deletions', '()', of('device_events'), '5 thread_deleted events on 4 phones')
  td = call('device-forensics', td, 300, 'power_events', '()', of('device_events'), '4 power-off periods')
  td = call('device-forensics', td, 600, 'synchronised_behaviour', 'window_min=60, min_phones=3', of('device_events') + of('messages'), '17 Apr 10:20–11:10: 3 phones · trigger candidate 10:00')
  const devEnd = td

  // financial-analyst
  state('financial-analyst', 'running', start + 200)
  let tf = start + 200
  tf = call('financial-analyst', tf, 650, 'money_chains', 'window_h=24, ratio=0.8–1.0, min_amount=500', of('transactions'), 'paul → ken → cara: $5,000 then $4,500 after 4 h 35 min')
  log('financial-analyst', tf, 'Dismissed: Paul → Amy $50 "lunch" (below $500 minimum)')
  // follow-up chain
  const tfu = Math.max(tf, tl) + 150
  tf = call('financial-analyst', tfu, 400, 'get_events', `person='ken', table='transactions', 14:00–16:30`, count((r) => r.device_owner === 'ken' && r.table === 'transactions'), '$4,500 → Cara at 15:40 (link 2 of the money chain)', 'location-analyst')
  hop('orchestrator', 'comms-analyst', tf, "Anything else sent from Ken's phone during the gap?")
  const tce = call('comms-analyst', Math.max(tc, tf) + 50, 350, 'search_messages', `person='ken', 14:00–16:30`, count((r) => r.device_owner === 'ken' && r.table === 'messages'), '1 SMS at 15:10', 'orchestrator')
  log('orchestrator', tce, `Merged chain into one finding: Ken's phone had no location data 14:00–16:30 while sending a message and the $4,500 transfer`)

  const locEnd = tl + 100
  const finEnd = tf + 100
  const comEnd = tce + 100
  state('location-analyst', 'done', locEnd)
  state('device-forensics', 'done', devEnd)
  state('financial-analyst', 'done', finEnd)
  state('comms-analyst', 'done', comEnd)

  // ---- ② triage ----
  const tri = Math.max(locEnd, devEnd, finEnd, comEnd) + 200
  events.push({ type: 'phase', phase: 'triage', at_ms: tri })
  let tt = call('orchestrator', tri, 400, 'propose_incidents', `signals=${SIGNALS.length}`, SIGNALS.length, `${INCIDENTS.length + 2} candidate groups`)
  log('orchestrator', tt, `Accepted ${INCIDENTS.length} incidents; ${DISMISSALS.filter((d) => d.signal_id).length} signals dismissed with reasons`)
  tt = call('orchestrator', tt, 300, 'anchor_moments', 'window_min=60, min_phones=3', SIGNALS.length, `1 anchor: 17 Apr ${ANCHORS[0].start.slice(11, 16)}–${ANCHORS[0].end.slice(11, 16)}`)
  tt = call('orchestrator', tt, 250, 'rank_incidents', '()', INCIDENTS.length, INCIDENTS.map((i) => i.incident_id).join(' > '))
  state('report-writer', 'running', tt)
  const statements = INCIDENTS.reduce((k, i) => k + i.findings.length, 0)
  let tw = call('report-writer', tt + 50, 700, 'write_headlines', `incidents=${INCIDENTS.length}`, statements, `${INCIDENTS.length} headlines, ${statements} statements`)
  tw = call('report-writer', tw, 450, 'validate_report', `statements=${statements}`, statements, `${statements} passed · 0 dropped`)
  state('report-writer', 'done', tw)
  state('orchestrator', 'done', tw + 100)
  events.push({ type: 'phase', phase: 'done', at_ms: tw + 150 })

  // ---- envelopes ----
  const f = (...ids: string[]) => ids.map((id) => findingById(id)!).filter(Boolean)
  const dis = (...sig: (string | null)[]): Dismissal[] => DISMISSALS.filter((d) => sig.includes(d.signal_id) || (d.signal_id === null && sig.includes(d.title)))
  const byAgent = (a: SubagentName) => calls.filter((c) => c.agent === a)
  const sent = (a: SubagentName) => hops.filter((h) => h.from === a)
  const recv = (a: SubagentName) => hops.filter((h) => h.to === a)
  const env = (agent: SubagentName, started: number, finished: number, summary: string, signal_ids: string[], findings: ReturnType<typeof f>, dismissed: Dismissal[] = []): AgentEnvelope => ({
    agent,
    file: FILE[agent],
    started_ms: started,
    finished_ms: finished,
    summary,
    tool_calls: byAgent(agent),
    signal_ids,
    findings,
    follow_ups_sent: sent(agent),
    follow_ups_received: recv(agent),
    dismissed,
  })
  const freshmart = DISMISSALS.find((d) => d.title.includes('FreshMart'))!.title
  const lunch = DISMISSALS.find((d) => d.title.includes('lunch'))!.title
  const envelopes: AgentEnvelope[] = [
    env('relationship-mapper', 100, rmEnd, 'People map: 4 people, 27 identifiers, 1 organisation. 3 deleted-thread links between case phones.', [], []),
    env('location-analyst', start, locEnd, `${G1.minutes}-min location_off gap on Ken's phone; Paul–Cara met 4 times with no contact; Paul–Amy 23 km apart on 14 Apr.`, ['sig_02', 'sig_03', 'sig_04', 'sig_06', 'sig_07', 'sig_10', 'sig_11', 'sig_12'], f('INC-2:f2', 'INC-4:f1', 'INC-3:f1'), dis('sig_11', 'sig_12', freshmart)),
    env('comms-analyst', start + 150, comEnd, "3 messages from Paul's phone missing on Amy's; audit notice located; 1 SMS from Ken's phone inside the gap.", ['sig_08'], f('INC-3:f2')),
    env('financial-analyst', start + 200, finEnd, '$5,000 Paul → Ken followed by $4,500 Ken → Cara within 4 h 35 min; the onward transfer falls inside Ken’s location gap.', ['sig_05'], f('INC-2:f1'), dis(lunch)),
    env('device-forensics', start + 300, devEnd, '3 phones deleted a thread and powered off within 50 minutes on 17 Apr, starting 20 minutes after the audit notice.', ['sig_01'], f('INC-1:f1')),
    env('orchestrator', 0, tw + 100, `${SIGNALS.length} signals → ${INCIDENTS.length} incidents, 1 anchor moment, ${DISMISSALS.length} dismissed.`, SIGNALS.map((s) => s.signal_id), [], DISMISSALS),
    env('report-writer', tt, tw, `${INCIDENTS.length} incident headlines and ${statements} statements written; all passed validate_report().`, [], INCIDENTS.flatMap((i) => i.findings)),
  ]
  for (const e of envelopes) events.push({ type: 'envelope', envelope: e })

  // order events by time (envelopes at their agent's finish)
  const at = (e: RunEvent) => (e.type === 'tool' ? e.call.start_ms : e.type === 'follow_up' ? e.hop.at_ms : e.type === 'envelope' ? e.envelope.finished_ms + 1 : e.at_ms)
  events.sort((a, b) => at(a) - at(b))
  return { events, envelopes, total_ms: tw + 150 }
}

export const eventTime = (e: RunEvent) => (e.type === 'tool' ? e.call.start_ms : e.type === 'follow_up' ? e.hop.at_ms : e.type === 'envelope' ? e.envelope.finished_ms + 1 : e.at_ms)
