// Stage ① sweep output (signals) and stage ② triage output (incidents, anchors, dismissals).
// In the real system: run_sweep() writes `signals`; propose_incidents(), anchor_moments() and
// rank_incidents() are code helpers; agents accept groupings, dismiss with reasons and word headlines.

import type { Anchor, Dismissal, GapOutput, Incident, Signal } from '../api/types'
import { AMY_GAP, G1, KEN_NIGHT, S1, S2, S4, S5, S7, S7_GAPS } from './data'
import { SCENARIOS, scenarioFinding, type ScenarioId } from './findings'
import { fmtTime } from '../lib/format'

const gapIds = (g: GapOutput) => [g.bounding.before.id, g.bounding.after.id, ...g.activity.map((a) => a.id), ...g.power_event_ids]
const ev = (sid: ScenarioId) => SCENARIOS[sid].evidence

export const SIGNALS: Signal[] = [
  { signal_id: 'sig_01', check: 'synchronised_behaviour', people: ['paul', 'ken', 'cara'], start: S7.window.start, end: S7.window.end, evidence_ids: ev('S7'), strength: 0.95, summary: '3 phones deleted a thread and powered off within 50 min' },
  ...S7_GAPS.map((g, i) => ({
    signal_id: `sig_0${i + 2}`,
    check: 'location_gaps' as const,
    people: [g.person],
    start: g.start,
    end: g.end,
    evidence_ids: gapIds(g),
    strength: 0.4,
    summary: `${g.person}: no location data ${fmtTime(g.start)}–${fmtTime(g.end)} (powered_off, overlaps sig_01)`,
  })),
  { signal_id: 'sig_05', check: 'money_chains', people: ['paul', 'ken', 'cara'], start: S4.links[0].t, end: S4.links[1].t, evidence_ids: ev('S4b'), strength: 0.95, summary: '$5,000 Paul → Ken, then $4,500 Ken → Cara 4 h 35 min later' },
  { signal_id: 'sig_06', check: 'location_gaps', people: ['ken'], start: G1.start, end: G1.end, evidence_ids: gapIds(G1), strength: 0.9, summary: 'ken: no location data 14:00–16:30 while the phone was in use (location_off)' },
  { signal_id: 'sig_07', check: 'silent_meetings', people: ['paul', 'cara'], start: S5.occasions[0].start, end: S5.occasions[S5.occasions.length - 1].end, evidence_ids: ev('S5'), strength: 1.0, summary: 'Phones within 100 m at Dock Cafe on 4 days, 0 contact rows' },
  { signal_id: 'sig_08', check: 'missing_messages', people: ['paul', 'amy'], start: S1.items[0].t, end: S1.deletion_events[0].t, evidence_ids: ev('S1'), strength: 0.9, summary: "3 texts on Paul's phone missing from Amy's; thread deleted 17 Apr" },
  { signal_id: 'sig_10', check: 'distance_between', people: ['paul', 'amy'], start: S2.start, end: S2.end, evidence_ids: ev('S2'), strength: 0.8, summary: 'Phones 23 km apart all evening on 14 Apr' },
  { signal_id: 'sig_11', check: 'location_gaps', people: ['amy'], start: AMY_GAP.start, end: AMY_GAP.end, evidence_ids: gapIds(AMY_GAP), strength: 0.2, summary: 'amy: no location data 09:10–10:00 (unexplained)' },
  { signal_id: 'sig_12', check: 'location_gaps', people: ['ken'], start: KEN_NIGHT.start, end: KEN_NIGHT.end, evidence_ids: gapIds(KEN_NIGHT), strength: 0.4, summary: 'ken: no location data overnight (powered_off)' },
]

export const ANCHORS: Anchor[] = [
  {
    anchor_id: 'A1',
    start: S7.window.start,
    end: S7.window.end,
    phones: ['paul', 'ken', 'cara'],
    signal_ids: ['sig_01', 'sig_02', 'sig_03', 'sig_04'],
    label: '17 April, around 10:00',
    finding_id: 'INC-1:f1',
  },
]

interface IncidentDef {
  id: string
  sids: ScenarioId[]
  signal_ids: string[]
  headline: string
  why: string
  follow_ups: string[]
  anchor_id?: string
}

const DEFS: IncidentDef[] = [
  {
    id: 'INC-1',
    sids: ['S7'],
    signal_ids: ['sig_01', 'sig_02', 'sig_03', 'sig_04'],
    headline: 'Three phones went dark together on the morning of 17 April',
    why: 'Coordinated deletion and power-off on 3 of the 4 phones within one hour. The sweep found this moment without being told about the audit; the audit notice turned up afterwards as the latest message before the window.',
    follow_ups: ['Did anyone react to the audit announcement?', 'Which threads were deleted on 17 April?'],
    anchor_id: 'A1',
  },
  {
    id: 'INC-2',
    sids: ['S4b', 'G1'],
    signal_ids: ['sig_05', 'sig_06'],
    headline: '$5,000 moved Paul → Ken → Cara, and Ken’s phone reported no location while sending it on',
    why: 'Money passed on within hours at a similar amount. The onward transfer happened inside a window when Ken’s phone was in use but reported no location, which is the one kind of gap worth raising.',
    follow_ups: ['Where did the missing money end up?', "Was Ken's location off while his phone was in use?"],
  },
  {
    id: 'INC-3',
    sids: ['S2', 'S1'],
    signal_ids: ['sig_10', 'sig_08'],
    headline: 'On the evening of 14 April, Paul’s texts asked Amy to come; her phone stayed 23 km away and later deleted them',
    why: 'Two checks agree on the same evening: the phones were far apart, and the texts that would explain it survive only on the sender’s phone.',
    follow_ups: ['Were Paul and Amy together on the evening of 14 April?', 'What did Paul text Amy on 14 April?'],
  },
  {
    id: 'INC-4',
    sids: ['S5'],
    signal_ids: ['sig_07'],
    headline: 'Paul’s and Cara’s phones met four times with no contact on record',
    why: 'Repeated meetings with no texts or calls may mean another channel. This contradicts “barely know each other”.',
    follow_ups: ['Do Paul and Cara know each other?'],
  },
]

const sigById = (id: string) => SIGNALS.find((s) => s.signal_id === id)!

/** rank_incidents(): code. Sort by distinct checks, then distinct phones, then max strength. */
function buildIncidents(): Incident[] {
  const raw = DEFS.map((d) => {
    const sigs = d.signal_ids.map(sigById)
    const checks = new Set(sigs.map((s) => s.check))
    const people = [...new Set(sigs.flatMap((s) => s.people).concat(d.sids.flatMap((sid) => SCENARIOS[sid].people)))]
    const starts = sigs.map((s) => s.start).sort()
    const ends = sigs.map((s) => s.end).sort()
    return {
      d,
      n_checks: checks.size,
      n_phones: people.length,
      strength: Math.max(...sigs.map((s) => s.strength)),
      people,
      start: starts[0],
      end: ends[ends.length - 1],
      checks: [...checks],
    }
  })
  raw.sort((a, b) => b.n_checks - a.n_checks || b.n_phones - a.n_phones || b.strength - a.strength)
  return raw.map((r, i) => ({
    incident_id: r.d.id,
    signal_ids: r.d.signal_ids,
    people: r.people,
    start: r.start,
    end: r.end,
    n_checks: r.n_checks,
    n_phones: r.n_phones,
    strength: r.strength,
    rank: i + 1,
    headline: r.d.headline,
    why_it_matters: r.d.why,
    rank_reason: `${r.n_checks} check${r.n_checks > 1 ? 's' : ''} agree (${r.checks.join(', ')}) across ${r.n_phones} phones; strongest signal ${r.strength.toFixed(2)}.`,
    anchor_id: r.d.anchor_id,
    findings: r.d.sids.map((sid, k) => scenarioFinding(sid, { id: `${r.d.id}:f${k + 1}`, section: 'unprompted', brief_item: null })),
    follow_ups: r.d.follow_ups,
  }))
}

export const INCIDENTS = buildIncidents()

export const DISMISSALS: Dismissal[] = [
  { signal_id: 'sig_11', title: "Amy's phone: no location data for 50 min on 16 April", reason: 'No message, call, transfer or power event during the gap, and no other signal overlaps it. Could be a flat battery or no signal.', rule: 'location_gaps: unexplained and not overlapping → not raised', by: 'code rule' },
  { signal_id: 'sig_12', title: "Ken's phone off overnight, 15→16 April", reason: 'A power_off/power_on pair covers the gap, and no other signal overlaps it. Phones are often switched off overnight.', rule: 'location_gaps: powered_off and not overlapping → not raised', by: 'code rule' },
  { signal_id: null, title: "Amy's and Ken's phones at FreshMart together once", reason: 'One occasion of 30 minutes, so it never became a signal.', rule: 'silent_meetings: needs ≥ 2 occasions', by: 'code rule' },
  { signal_id: null, title: 'Paul sent Amy $50 on 16 April, memo "lunch"', reason: 'Below the money-chain minimum, and nothing moved on from Amy afterwards. The memo gives an ordinary explanation.', rule: 'money_chains: first transfer ≥ $500', by: 'code rule' },
]

export const findingById = (id: string) => INCIDENTS.flatMap((i) => i.findings).find((f) => f.id === id)
