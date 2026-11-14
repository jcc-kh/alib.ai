// The case-load run: stage ① sweep and stage ② triage, as a timed stream of agent events.
// Every `rows` figure is counted from the case store; every signal and finding comes from
// mock/signals.ts. In the real system this is GET /api/run/stream (SSE) from the deepagents run.

import type { AgentEnvelope, Dismissal, EvidenceRow, FollowUp, PersonId, RunEvent, SubagentName, ToolCall } from '../api/types'
import { ALL_PHONES, CHAIN, GAMY, GPAUL, HOSTILE, MEET, MISSING, ROWS, SYNC, VICTIM, personName } from './data'
import { LAST, PRESENCE, SPACE } from './derived'
import { ANCHORS, DISMISSALS, INCIDENTS, SIGNALS, findingById } from './signals'
import { fmtKm, fmtTime } from '../lib/format'

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
  'social-analyst': 'findings/social.json',
}

export interface RunScript {
  events: RunEvent[]
  envelopes: AgentEnvelope[]
  total_ms: number
}

export function buildRunScript(range: [number, number] = [13, 19]): RunScript {
  const span = range[0] === range[1] ? `${range[0]} Apr` : `${range[0]}–${range[1]} Apr`
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
  const ph = (p: PersonId) => PRESENCE.phones.find((x) => x.person === p)!

  // ---- ① sweep ----
  events.push({ type: 'phase', phase: 'sweep', at_ms: 0 })
  state('orchestrator', 'running', 0)
  log('orchestrator', 0, `run_sweep(): 6 domain agents × ${ALL_PHONES.length} phones × ${span}; scene = Pier 9 Warehouse; time-of-death window 16 Apr 21:00–23:30`)
  let t = call('orchestrator', 100, 300, 'run_sweep', `phones=${ALL_PHONES.length}, range=${span}, scene='Pier 9', window=21:00–23:30`, ROWS.size, 'dispatched 6 subagents')

  state('relationship-mapper', 'running', t)
  t = call('relationship-mapper', t, 700, 'identity_match', '()', of('contacts') + of('messages') + of('calls') + of('social_interactions'), `${ALL_PHONES.length} people · 31 identifiers · 5 social handles`)
  const rmEnd = call('relationship-mapper', t, 600, 'contact_graph', '()', of('messages') + of('calls') + of('transactions') + of('social_interactions') + of('device_events'), '22 edges across 7 channels; Paul–Cara: no call or text')
  log('relationship-mapper', rmEnd, 'People map written; other agents can now resolve numbers and handles to people')
  state('relationship-mapper', 'done', rmEnd)

  const start = rmEnd + 100
  // location-analyst
  state('location-analyst', 'running', start)
  let tl = call('location-analyst', start, 600, 'presence_window', "scene='Pier 9', 21:00–23:30, slot=10 min", ALL_PHONES.reduce((k, p) => k + ph(p).slots.length, 0), `scene: ravi only · no data: paul ${ph('paul').counts.no_data}, amy ${ph('amy').counts.no_data} of 16 slots`)
  for (const p of ALL_PHONES) tl = call('location-analyst', tl, 200, 'location_timeline', `person='${p}'`, locs(p), 'stays · travel · gaps → stays table')
  for (const p of ALL_PHONES) {
    const gaps = SIGNALS.filter((s) => s.check === 'location_gaps' && s.people[0] === p).length
    tl = call('location-analyst', tl, 180, 'location_gaps', `person='${p}', min_gap_min=45`, locs(p), gaps ? `${gaps} gap${gaps > 1 ? 's' : ''}${p === 'paul' ? ' · 1 overlaps the window' : p === 'amy' ? ' · 1 location_off' : ''}` : 'none')
  }
  hop('location-analyst', 'comms-analyst', tl, `Paul's phone went off at 21:16, ${fmtKm(ph('paul').closest_m!)} from Pier 9. What contact did it have before that?`)
  hop('location-analyst', 'comms-analyst', tl + 40, `Amy's phone: no location ${fmtTime(GAMY.start)}–${fmtTime(GAMY.end)}. What did it do during the gap?`)
  tl = call('location-analyst', tl + 60, 600, 'activity_space', `min_days=${SPACE.rule.min_days}, buffer_m=${SPACE.rule.buffer_m}`, of('locations'), `scene inside: ${SPACE.spaces.filter((s) => s.scene_inside).map((s) => s.person).join(', ')}`)
  tl = call('location-analyst', tl, 520, 'silent_meetings', 'within_m=100, min_minutes=20, min_occasions=2', of('locations'), `paul–cara: ${MEET.occasions.length} occasions, 0 contact rows`)
  log('location-analyst', tl, "Dismissed: Ken's overnight gap (powered off, not near the window); Cara's 19 Apr gap (unexplained, no overlap); Amy–Ken FreshMart (1 occasion)")

  // comms-analyst
  state('comms-analyst', 'running', start + 150)
  let tc = call('comms-analyst', start + 150, 500, 'last_contacts', `person='${VICTIM}', from='16 Apr 17:00'`, LAST.items.length, `${LAST.items.length} rows · last outgoing ${fmtTime(LAST.last_active.t)} · 18:05 text names Pier 9`)
  for (const p of ALL_PHONES.filter((x) => x !== VICTIM)) {
    const r = count((x) => (x.table === 'messages' || x.table === 'calls') && (x.device_owner === p || x.device_owner === VICTIM))
    tc = call('comms-analyst', tc, 220, 'missing_messages', `'ravi', '${p}'`, r, p === 'amy' ? `${MISSING.missing_count} texts on Ravi's phone only · thread_deleted on Amy's` : p === 'paul' ? "Ravi's SMS thread gone from Paul's phone · thread_deleted 17 Apr" : 'none missing')
  }

  // device-forensics
  state('device-forensics', 'running', start + 300)
  let td = start + 300
  td = call('device-forensics', td, 300, 'deletions', '()', of('device_events'), `${SYNC.events.filter((e) => e.event_type === 'thread_deleted').length} thread_deleted events on 3 phones`)
  td = call('device-forensics', td, 300, 'power_events', '()', of('device_events'), "6 power-off periods incl. Ravi's battery at 01:52")
  td = call('device-forensics', td, 600, 'synchronised_behaviour', 'window_min=60, min_phones=3', of('device_events') + of('messages'), `17 Apr ${fmtTime(SYNC.window.start)}–${fmtTime(SYNC.window.end)}: 3 phones · trigger: news alert ${fmtTime(SYNC.trigger!.t)}`)
  const devEnd = td

  // financial-analyst
  state('financial-analyst', 'running', start + 200)
  let tf = call('financial-analyst', start + 200, 650, 'money_chains', 'window_h=24, ratio=0.8–1.0, min_amount=500, round_trips=true', of('transactions'), `paul → cara $${CHAIN.links[0].amount.toLocaleString()}, back $${CHAIN.links[1].amount.toLocaleString()} after ${CHAIN.gap_label}`)
  log('financial-analyst', tf, 'Dismissed: Paul → Amy $50 "lunch" (below $500 minimum)')
  const finEnd = tf + 100

  // social-analyst
  state('social-analyst', 'running', start + 250)
  let ts2 = start + 250
  for (const p of ALL_PHONES) ts2 = call('social-analyst', ts2, 160, 'social_profile', `person='${p}'`, count((r) => r.table === 'social_interactions' && r.device_owner === p), `${count((r) => r.table === 'social_interactions' && r.device_owner === p && r.fields.kind === 'post')} posts`)
  ts2 = call('social-analyst', ts2, 600, 'social_hostility', `threshold=${HOSTILE.threshold}, targets=case people`, of('social_interactions'), `ken → ravi: ${HOSTILE.flagged} of ${HOSTILE.items.length} ≥ ${HOSTILE.threshold} · amy: 1 post 0.55 (below)`)
  hop('social-analyst', 'location-analyst', ts2, "Ken's account posted hostile items about Ravi. Where was Ken's phone in the time-of-death window?")
  const kenMin = Math.min(...ph('ken').slots.map((s) => s.distance_m ?? Infinity))
  const tk = call('location-analyst', Math.max(tl, ts2) + 60, 300, 'presence_window', "person='ken', 21:00–23:30", ph('ken').slots.length, `away in all ${ph('ken').slots.length} slots, min ${fmtKm(kenMin)}, no gaps`, 'social-analyst')
  log('social-analyst', tk, 'Hostility kept as context for interview: presence check places Ken’s phone far from the scene throughout')
  log('social-analyst', tk + 10, 'Dismissed: Amy’s "Done being lied to." (0.55, below threshold, names no one)')

  // follow-ups to comms
  const tq = call('comms-analyst', Math.max(tc, tl) + 50, 350, 'search_messages', "counterpart='paul', 16 Apr 17:00–21:16", count((r) => r.device_owner === VICTIM && r.table === 'messages'), "18:05 Ravi → Paul (on Ravi's phone only), 20:58 call 64 s", 'location-analyst')
  const tce = call('comms-analyst', tq, 300, 'search_messages', `person='amy', ${fmtTime(GAMY.start)}–${fmtTime(GAMY.end)}`, count((r) => r.device_owner === 'amy' && (r.table === 'messages' || r.table === 'calls')), '2 calls to Ravi, 22:30 and 22:31', 'location-analyst')
  log('orchestrator', tce, `Merged: Paul's phone ${fmtKm(ph('paul').closest_m!)} from Pier 9 at 21:10, then off 21:16–23:38, after the 18:05 text naming Pier 9`)

  const locEnd = tk + 100
  const comEnd = tce + 100
  const socEnd = tk + 120
  state('device-forensics', 'done', devEnd)
  state('financial-analyst', 'done', finEnd)
  state('location-analyst', 'done', locEnd)
  state('comms-analyst', 'done', comEnd)
  state('social-analyst', 'done', socEnd)

  // ---- ② triage, then the write-up (the orchestrator assembles and validates the report) ----
  const tri = Math.max(locEnd, devEnd, finEnd, comEnd, socEnd) + 200
  events.push({ type: 'phase', phase: 'triage', at_ms: tri })
  let tt = call('orchestrator', tri, 400, 'propose_incidents', `signals=${SIGNALS.length}`, SIGNALS.length, `${INCIDENTS.length + 2} candidate insights`)
  log('orchestrator', tt, `Accepted ${INCIDENTS.length} insights; ${DISMISSALS.filter((d) => d.signal_id).length} signals dismissed with reasons`)
  tt = call('orchestrator', tt, 300, 'anchor_moments', 'window_min=60, min_phones=3', SIGNALS.length, `1 anchor: 17 Apr ${fmtTime(ANCHORS[0].start)}–${fmtTime(ANCHORS[0].end)}`)
  tt = call('orchestrator', tt, 250, 'rank_incidents', '()', INCIDENTS.length, INCIDENTS.map((i) => i.incident_id).join(' > '))
  const statements = INCIDENTS.reduce((k, i) => k + i.findings.length, 0)
  let tw = call('orchestrator', tt + 50, 700, 'assemble_report', `insights=${INCIDENTS.length}`, statements, `${INCIDENTS.length} headlines, ${statements} statements`)
  tw = call('orchestrator', tw, 450, 'validate_report', `statements=${statements}`, statements, `${statements} passed · 0 dropped`)
  state('orchestrator', 'done', tw + 100)
  events.push({ type: 'phase', phase: 'done', at_ms: tw + 150 })

  // ---- envelopes ----
  const f = (...ids: string[]) => ids.map((id) => findingById(id)!).filter(Boolean)
  const dis = (...titles: string[]): Dismissal[] => DISMISSALS.filter((d) => titles.some((x) => d.title.includes(x)))
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
  const envelopes: AgentEnvelope[] = [
    env('relationship-mapper', 100, rmEnd, `People map: ${ALL_PHONES.length} people, 31 identifiers, 5 social handles. Paul and Cara: money and meetings, but no call or text.`, [], []),
    env('location-analyst', start, locEnd, `Only Ravi's phone at the scene in the window; Paul's ${fmtKm(ph('paul').closest_m!)} away then off; Amy's location off ${GAMY.minutes} min; Pier 9 routine for Ken and Cara.`, ['sig_02', 'sig_03', 'sig_05', 'sig_06', 'sig_08', 'sig_10', 'sig_12', 'sig_13', 'sig_14'], f('INC-1:f2', 'INC-1:f3', 'INC-3:f2', 'INC-4:f2', 'INC-6:f1'), dis('overnight', '19 April', 'FreshMart')),
    env('comms-analyst', start + 150, comEnd, `Ravi's last outgoing activity ${fmtTime(LAST.last_active.t)}; his 18:05 text names Pier 9; ${MISSING.missing_count} texts with Amy missing from her phone.`, ['sig_01', 'sig_07'], f('INC-1:f1', 'INC-3:f1')),
    env('financial-analyst', start + 200, finEnd, `$${CHAIN.links[0].amount.toLocaleString()} Paul → Cara as an invoice, 90% back within ${CHAIN.gap_label}.`, ['sig_09'], f('INC-4:f1'), dis('lunch')),
    env('device-forensics', start + 300, devEnd, `3 phones deleted threads within ${SYNC.window.minutes} min after the 09:05 news alert; 2 powered off.`, ['sig_04'], f('INC-2:f1')),
    env('social-analyst', start + 250, socEnd, `${HOSTILE.flagged} hostile posts by Ken about Ravi; Ken's phone far from the scene all window.`, ['sig_11'], f('INC-5:f1'), dis('Done being lied to')),
    env('orchestrator', 0, tw + 100, `${SIGNALS.length} signals → ${INCIDENTS.length} insights, 1 anchor moment, ${DISMISSALS.length} dismissed; ${statements} statements validated.`, SIGNALS.map((s) => s.signal_id), INCIDENTS.flatMap((i) => i.findings), DISMISSALS),
  ]
  for (const e of envelopes) events.push({ type: 'envelope', envelope: e })
  void personName
  void GPAUL

  // order events by time (envelopes at their agent's finish)
  events.sort((a, b) => eventTime(a) - eventTime(b))
  return { events, envelopes, total_ms: tw + 150 }
}

export const eventTime = (e: RunEvent) => (e.type === 'tool' ? e.call.start_ms : e.type === 'follow_up' ? e.hop.at_ms : e.type === 'envelope' ? e.envelope.finished_ms + 1 : e.at_ms)
