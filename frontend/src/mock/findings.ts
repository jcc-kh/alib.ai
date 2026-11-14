// One place that defines every planted-scenario finding, including how it was derived.
// The report, the proactive briefing and Ask all build their findings from here, so the same
// statement always carries the same evidence, number traces and validator results.

import type { CheckName, CheckOutput, Corroboration, DerivationStep, Finding, NumberTrace, PersonId, Section, SubagentName, ValidatorCheck, Verdict } from '../api/types'
import { COVERAGE_IDS, NUMBERS, PEOPLE, S1, S2, S4, S4_FIRST, S5, S7, coverageFor } from './data'
import { fmtDateTime, fmtKm, fmtTime } from '../lib/format'

export type ScenarioId = 'S1' | 'S2' | 'S4a' | 'S4b' | 'S5' | 'S7'

interface ScenarioDef {
  family: string
  check: CheckName
  agent: SubagentName
  route_reason: string
  tools: string[]
  people: PersonId[]
  verdictAsBelief: Verdict
  statement: string
  output: CheckOutput
  evidence: string[]
  data: string
  compute: { detail: string; code: string }
  rule: (asBelief: boolean) => { detail: string; code?: string }
  numbers: NumberTrace[]
  corroboration: Corroboration[]
}

const TOTAL_MSGS = PEOPLE.reduce((n, p) => n + p.counts.messages, 0)
const TOTAL_CALLS = PEOPLE.reduce((n, p) => n + p.counts.calls, 0)
const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five']

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  S2: {
    family: 'S2',
    check: 'distance_between',
    agent: 'location-analyst',
    route_reason: 'The item claims two people were together at a stated time, which is a question about where two phones were.',
    tools: ["distance_between(person_a='paul', person_b='amy', start='2026-04-14T18:00-04:00', end='2026-04-14T21:00-04:00')"],
    people: ['paul', 'amy'],
    verdictAsBelief: 'inconsistent',
    statement: `Paul's and Amy's phones were between ${fmtKm(S2.min_m)} and ${fmtKm(S2.max_m)} apart from 18:00 to 21:00 on 14 April, with Paul's phone at Sunset Park and Amy's at Northgate Mall.`,
    output: S2,
    evidence: S2.slots.flatMap((s) => [s.a.id, s.b.id]),
    data: `Read ${S2.slots.length} location rows from each phone (one per 10-minute slot, 18:00–21:00) and paired them by timestamp.`,
    compute: {
      detail: 'Great-circle (haversine) distance for every slot pair, then min, median and max.',
      code: 'd = 2R·asin(√(sin²(Δφ/2) + cos φ₁·cos φ₂·sin²(Δλ/2)))   R = 6,371 km',
    },
    rule: () => ({
      detail: `Label rule: "together" if ≤ ${S2.thresholds.together_m} m in ≥ ${S2.thresholds.together_share * 100}% of slots; "apart" if never closer than ${S2.thresholds.apart_m / 1000} km. Closest slot was ${fmtKm(S2.min_m)} → apart. The belief says together → inconsistent.`,
      code: `min_m = ${S2.min_m} ≥ apart_m = ${S2.thresholds.apart_m}  ⇒  label = "apart"`,
    }),
    numbers: [
      { text: fmtKm(S2.min_m), field: 'distance_between.min_m', value: `${S2.min_m} m` },
      { text: fmtKm(S2.max_m), field: 'distance_between.max_m', value: `${S2.max_m} m` },
      { text: '18:00 to 21:00', field: 'distance_between.start / end', value: `${fmtTime(S2.start)}–${fmtTime(S2.end)}` },
    ],
    corroboration: [
      { fact: "Paul's phone at Sunset Park, 18:00–21:00", phones: { paul: 'present', amy: 'n/a', ken: 'n/a', cara: 'n/a' } },
      { fact: "Amy's phone at Northgate Mall, 18:00–21:00", phones: { paul: 'n/a', amy: 'present', ken: 'n/a', cara: 'n/a' } },
    ],
  },

  S5: {
    family: 'S5',
    check: 'silent_meetings',
    agent: 'relationship-mapper',
    route_reason: 'The item is about whether two people know each other, so the relationship mapper checks every contact channel and the location analyst checks for meetings.',
    tools: ["contact_graph(people=['paul', 'cara'])", "silent_meetings(start='2026-04-13', end='2026-04-19')"],
    people: ['paul', 'cara'],
    verdictAsBelief: 'inconsistent',
    statement: `Paul's and Cara's phones were within ${S5.thresholds.within_m} m of each other at Dock Cafe on ${S5.occasions.length} separate days, and no message or call between them exists on any phone.`,
    output: S5,
    evidence: S5.occasions.flatMap((o) => o.row_ids),
    data: `Paired every 10-minute location slot across all 6 phone pairs. Searched ${TOTAL_MSGS.toLocaleString()} message rows and ${TOTAL_CALLS} call rows on all 4 phones for any row between ${NUMBERS.paul} and ${NUMBERS.cara}.`,
    compute: {
      detail: 'Group consecutive slots where the two phones are within range into episodes; an episode lasts (last − first) + 10 min.',
      code: `episode if haversine(paul, cara) ≤ ${S5.thresholds.within_m} m for consecutive slots; contacts = COUNT(messages ∪ calls WHERE {from,to} = {paul, cara})`,
    },
    rule: () => ({
      detail: `Rule: ≥ ${S5.thresholds.min_occasions} episodes of ≥ ${S5.thresholds.min_minutes} min with 0 contact rows. Found ${S5.occasions.length} episodes and ${S5.contact_rows_found} contact rows. The belief says they don't know each other → inconsistent.`,
      code: `episodes = ${S5.occasions.length} ≥ ${S5.thresholds.min_occasions}  ∧  contacts = ${S5.contact_rows_found}`,
    }),
    numbers: [
      { text: `${S5.thresholds.within_m} m`, field: 'silent_meetings.thresholds.within_m', value: `${S5.thresholds.within_m}` },
      { text: `${S5.occasions.length} separate days`, field: 'silent_meetings.occasions.length', value: String(S5.occasions.length) },
    ],
    corroboration: [
      ...S5.occasions.map((o) => ({ fact: `Both phones at Dock Cafe, ${o.date} ${fmtTime(o.start)}`, phones: { paul: 'present', amy: 'n/a', ken: 'n/a', cara: 'present' } as Corroboration['phones'] })),
      { fact: 'Any message or call between them', phones: { paul: 'absent', amy: 'absent', ken: 'absent', cara: 'absent' } },
    ],
  },

  S4a: {
    family: 'S4',
    check: 'money_chains',
    agent: 'financial-analyst',
    route_reason: 'The item names a money transfer between two people, so it goes to the financial analyst.',
    tools: ["get_events(person='paul', table='transactions', start='2026-04-15', end='2026-04-15')", "money_chains(start='2026-04-13', end='2026-04-19')"],
    people: ['paul', 'ken'],
    verdictAsBelief: 'confirmed',
    statement: `Paul's and Ken's phones both show a $${S4.links[0].amount.toLocaleString()} Swiftpay transfer from Paul to Ken on 15 April at 11:05, with no memo.`,
    output: S4_FIRST,
    evidence: S4.links[0].row_ids,
    data: "Read Paul's transactions for 15 April and matched the outgoing $5,000 against Ken's incoming transactions.",
    compute: { detail: 'Match a transfer across the two phones on amount, currency, counterpart number and timestamp (±2 s).', code: 'paul.out(5000 USD → +1 555 010 0303, 11:05:00) ≡ ken.in(5000 USD ← +1 555 010 0101, 11:05:00)' },
    rule: () => ({ detail: 'Confirmed: the same transfer is on both phones, and it matches the brief item.' }),
    numbers: [
      { text: '$5,000', field: 'money_chains.links[0].amount', value: '5000' },
      { text: '11:05', field: 'money_chains.links[0].t', value: fmtDateTime(S4.links[0].t) },
    ],
    corroboration: [{ fact: '$5,000 Paul → Ken, 15 Apr 11:05', phones: { paul: 'present', amy: 'n/a', ken: 'present', cara: 'n/a' } }],
  },

  S4b: {
    family: 'S4',
    check: 'money_chains',
    agent: 'financial-analyst',
    route_reason: 'The item asks where money went, so it goes to the financial analyst to follow onward transfers.',
    tools: ["money_chains(start='2026-04-13', end='2026-04-19')"],
    people: ['paul', 'ken', 'cara'],
    verdictAsBelief: 'confirmed',
    statement: `Ken's phone shows a $${S4.links[1].amount.toLocaleString()} transfer to Cara at 15:40 on 15 April, ${S4.gap_label} after it received $${S4.links[0].amount.toLocaleString()} from Paul, and Cara's phone shows it arriving.`,
    output: S4,
    evidence: S4.links.flatMap((l) => l.row_ids),
    data: 'Read every transaction row on all 4 phones and de-duplicated the copies of each transfer that appear on both phones.',
    compute: { detail: 'For every A→B transfer ≥ $500, look for a B→C transfer within the window and the amount band.', code: `gap = t(ken→cara) − t(paul→ken) = ${S4.gap_minutes} min;  ratio = 4500 / 5000 = ${S4.ratio}` },
    rule: () => ({
      detail: `Rule: second transfer within ${S4.thresholds.window_h} h and ${S4.thresholds.ratio_min * 100}–${S4.thresholds.ratio_max * 100}% of the first. ${S4.gap_minutes} min and ${S4.ratio * 100}% → chain.`,
      code: `${S4.gap_minutes} ≤ ${S4.thresholds.window_h * 60}  ∧  ${S4.thresholds.ratio_min} ≤ ${S4.ratio} ≤ ${S4.thresholds.ratio_max}`,
    }),
    numbers: [
      { text: '$4,500', field: 'money_chains.links[1].amount', value: '4500' },
      { text: '$5,000', field: 'money_chains.links[0].amount', value: '5000' },
      { text: S4.gap_label, field: 'money_chains.gap_label', value: `${S4.gap_minutes} min` },
      { text: '15:40', field: 'money_chains.links[1].t', value: fmtDateTime(S4.links[1].t) },
    ],
    corroboration: [
      { fact: '$5,000 Paul → Ken, 15 Apr 11:05', phones: { paul: 'present', amy: 'n/a', ken: 'present', cara: 'n/a' } },
      { fact: '$4,500 Ken → Cara, 15 Apr 15:40', phones: { paul: 'n/a', amy: 'n/a', ken: 'present', cara: 'present' } },
    ],
  },

  S7: {
    family: 'S7',
    check: 'synchronised_behaviour',
    agent: 'device-forensics',
    route_reason: 'The item asks about reactions to an event, so device forensics looks for coordinated deletions and power-offs and then searches for a trigger.',
    tools: ["synchronised_behaviour(start='2026-04-13', end='2026-04-19')", "search_messages(query='audit')"],
    people: ['paul', 'ken', 'cara'],
    verdictAsBelief: 'confirmed',
    statement: `Paul's, Ken's and Cara's phones each deleted a thread and powered off within one ${S7.window.minutes}-minute window that began ${S7.trigger!.minutes_before_window} minutes after Paul's phone received the audit announcement.`,
    output: S7,
    evidence: [S7.trigger!.id, ...S7.events.map((e) => e.id)],
    data: 'Read every thread_deleted, power_off and power_on event on all 4 phones, plus messages received in the 2 hours before any cluster.',
    compute: { detail: 'Slide a 60-minute window over the events and keep windows where at least 3 distinct phones each have a deletion or power-off.', code: `window = [${fmtTime(S7.window.start)}, ${fmtTime(S7.window.end)}] → ${S7.window.minutes} min, phones = {paul, ken, cara}` },
    rule: () => ({
      detail: `Rule: ≥ ${S7.thresholds.min_phones} phones within ${S7.thresholds.window_min} min. The trigger candidate is the latest inbound message before the window that matches "audit": ${fmtTime(S7.trigger!.t)} on Paul's phone, ${S7.trigger!.minutes_before_window} min before.`,
      code: `3 ≥ ${S7.thresholds.min_phones}  ∧  ${S7.window.minutes} ≤ ${S7.thresholds.window_min}`,
    }),
    numbers: [
      { text: `${S7.window.minutes}-minute`, field: 'synchronised_behaviour.window.minutes', value: String(S7.window.minutes) },
      { text: `${S7.trigger!.minutes_before_window} minutes`, field: 'synchronised_behaviour.trigger.minutes_before_window', value: String(S7.trigger!.minutes_before_window) },
    ],
    corroboration: [
      { fact: 'Audit notice received 10:00', phones: { paul: 'present', amy: 'n/a', ken: 'n/a', cara: 'n/a' } },
      { fact: 'Thread deleted in window', phones: { paul: 'present', amy: 'absent', ken: 'present', cara: 'present' } },
      { fact: 'Powered off in window', phones: { paul: 'present', amy: 'absent', ken: 'present', cara: 'present' } },
    ],
  },

  S1: {
    family: 'S1',
    check: 'missing_messages',
    agent: 'comms-analyst',
    route_reason: 'Found by the unprompted sweep, which compares every pair of phones message by message.',
    tools: ["missing_messages(person_a='paul', person_b='amy', start='2026-04-13', end='2026-04-19')"],
    people: ['paul', 'amy'],
    verdictAsBelief: 'confirmed',
    statement: `${words[S1.missing_count]} messages from Paul to Amy sent at 18:32 on 14 April are on Paul's phone but missing from Amy's phone, which deleted that thread on 17 April at 20:15.`,
    output: S1,
    evidence: [...S1.items.flatMap((i) => [i.on_a, i.on_b]).filter((x): x is string => !!x), ...S1.deletion_events.map((e) => e.id)],
    data: "Read every message and call between Paul's and Amy's numbers on both phones.",
    compute: { detail: `Match each message on one phone to the other phone on sender, recipient, body and timestamp (±${S1.tolerance_s} s). Calls are matched the same way as anchors.`, code: `unmatched = paul.messages(to=amy) − amy.messages(from=paul)  →  ${S1.missing_count}` },
    rule: () => ({ detail: `Messages on one phone with no counterpart on the other are reported, together with any thread_deleted event on the phone that lacks them (Amy's phone, ${fmtDateTime(S1.deletion_events[0].t)}). The 2 calls match on both phones, so the gap is in messages only.` }),
    numbers: [
      { text: words[S1.missing_count], field: 'missing_messages.missing_count', value: String(S1.missing_count) },
      { text: '18:32', field: 'missing_messages.items[0].t', value: fmtDateTime(S1.items[0].t) },
      { text: '20:15', field: 'missing_messages.deletion_events[0].t', value: fmtDateTime(S1.deletion_events[0].t) },
    ],
    corroboration: [
      { fact: '3 texts Paul → Amy, 14 Apr 18:32–18:34', phones: { paul: 'present', amy: 'deleted', ken: 'n/a', cara: 'n/a' } },
      { fact: 'Calls Paul ↔ Amy, 14–15 Apr', phones: { paul: 'present', amy: 'present', ken: 'n/a', cara: 'n/a' } },
    ],
  },
}

function validatorFor(statement: string, evidence: string[], numbers: NumberTrace[]): ValidatorCheck[] {
  return [
    { rule: 'Cites evidence', passed: evidence.length > 0, detail: `${evidence.length} evidence ids, all resolve through /api/evidence` },
    { rule: 'Phones, not people', passed: !/\b(Paul|Amy|Ken|Cara) (was|were) (at|in|near)\b/.test(statement), detail: 'No sentence places a person somewhere; locations are attributed to phones' },
    { rule: 'Neutral wording', passed: !/lied|guilty|lying/i.test(statement), detail: 'No "lied", "lying" or "guilty"' },
    { rule: 'Numbers traced to check output', passed: numbers.every((n) => statement.includes(n.text)), detail: `${numbers.length} numbers, each matched to a check-output field` },
    { rule: 'One sentence', passed: (statement.match(/[.!?](\s|$)/g) ?? []).length === 1, detail: 'Single sentence, plain language' },
  ]
}

export function scenarioFinding(sid: ScenarioId, opts: { id: string; section: Section; brief_item: string | null; verdict?: Verdict }): Finding {
  const sc = SCENARIOS[sid]
  const asBelief = opts.section === 'confirmed' || opts.section === 'inconsistent'
  const verdict = opts.verdict ?? (asBelief ? sc.verdictAsBelief : 'confirmed')
  const rule = sc.rule(asBelief)
  const steps: DerivationStep[] = [
    opts.brief_item
      ? { kind: 'question', actor: 'model', title: 'Brief item', detail: `“${opts.brief_item}” People resolved: ${sc.people.join(', ')}.` }
      : { kind: 'question', actor: 'code', title: 'Unprompted sweep', detail: 'run_sweep() ran all 5 checks over all 6 phone pairs for 13–19 April. This result did not overlap any brief item, so it was kept.' },
    { kind: 'route', actor: 'model', title: `Routed to ${sc.agent}`, detail: sc.route_reason },
    ...sc.tools.map((t) => ({ kind: 'tool' as const, actor: 'code' as const, title: 'Check called', detail: 'Deterministic Python over the case store. No model involved.', code: t })),
    { kind: 'data', actor: 'code', title: 'Data read', detail: `${sc.data} ${sc.evidence.length} rows kept as evidence.` },
    { kind: 'compute', actor: 'code', title: 'Computation', detail: sc.compute.detail, code: sc.compute.code },
    { kind: 'rule', actor: 'code', title: `Verdict: ${verdict.replace('_', ' ')}`, detail: rule.detail, code: rule.code },
    { kind: 'statement', actor: 'model', title: 'Statement written and validated', detail: 'The subagent phrased one sentence from the check output, then validate_report() checked it (below).' },
  ]
  return {
    id: opts.id,
    section: opts.section,
    brief_item: opts.brief_item,
    verdict,
    statement: sc.statement,
    people: sc.people,
    check: sc.check,
    agent: sc.agent,
    evidence_ids: sc.evidence,
    check_output: sc.output,
    derivation: { steps, numbers: sc.numbers, validator: validatorFor(sc.statement, sc.evidence, sc.numbers), corroboration: sc.corroboration },
  }
}

export function cannotTellFinding(id: string, item: string): Finding {
  const out = coverageFor(item)
  const statement = 'The four phones only hold data from 13 to 19 April 2026, so they cannot settle this item.'
  const numbers: NumberTrace[] = [
    { text: '13', field: 'get_coverage.start', value: fmtDateTime(out.start) },
    { text: '19 April 2026', field: 'get_coverage.end', value: fmtDateTime(out.end) },
  ]
  return {
    id,
    section: 'answers',
    brief_item: item,
    verdict: 'cannot_tell',
    statement,
    people: ['paul', 'amy', 'ken', 'cara'],
    check: 'get_coverage',
    agent: 'device-forensics',
    evidence_ids: COVERAGE_IDS,
    check_output: out,
    derivation: {
      steps: [
        { kind: 'question', actor: 'model', title: 'Brief item', detail: `“${item}”` },
        { kind: 'route', actor: 'model', title: 'Routed to device-forensics', detail: 'The item refers to a period, so the first step is to check whether the phones cover it.' },
        { kind: 'tool', actor: 'code', title: 'Check called', detail: 'Returns the earliest and latest row on every phone.', code: 'get_coverage()' },
        { kind: 'rule', actor: 'code', title: 'Verdict: cannot tell', detail: 'The period named in the item lies outside every phone’s coverage, so no check can confirm or contradict it. The agent must answer cannot_tell instead of guessing.' },
        { kind: 'statement', actor: 'model', title: 'Statement written and validated', detail: 'Cites the first and last row on each phone as evidence of coverage.' },
      ],
      numbers,
      validator: validatorFor(statement, COVERAGE_IDS, numbers),
      corroboration: [{ fact: 'Coverage 13–19 April only', phones: { paul: 'present', amy: 'present', ken: 'present', cara: 'present' } }],
    },
  }
}

/** Which scenario a brief item or question is about. null means the phones can't settle it. */
export function route(text: string): ScenarioId | null {
  const t = text.toLowerCase()
  if (/\b(march|january|february|2025)\b/.test(t)) return null
  if (/together|with each other|same place|where was|alibi/.test(t) && t.includes('amy') && t.includes('paul')) return 'S2'
  if (/know each other|never met|don.t know|strangers|relationship|connected/.test(t) && t.includes('cara')) return 'S5'
  if (/5,?000/.test(t) || (t.includes('sent ken') && /\$/.test(t))) return 'S4a'
  if (/money|funds|end up|where did|transfer|4,?500/.test(t)) return 'S4b'
  if (/audit|react|announcement|power|17 april|turn(ed)? off/.test(t)) return 'S7'
  if (/delet|missing message|texts?|messages?/.test(t) && t.includes('amy')) return 'S1'
  return null
}

export const SWEEP_ORDER: ScenarioId[] = ['S1', 'S2', 'S5', 'S4b', 'S7']
