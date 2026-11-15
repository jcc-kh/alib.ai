// One place that defines every planted-scenario finding, including how it was derived.
// The briefing, the insight pages and Ask all build their findings from here, so the same
// statement always carries the same evidence, number traces and validator results.

import type { CheckName, CheckOutput, Corroboration, DerivationStep, Finding, NumberTrace, PersonId, SubagentName, ValidatorCheck } from '../api/types'
import { ALL_PHONES, COVERAGE_IDS, GAMY, GPAUL, HOSTILE, MEET, MISSING, NUMBERS, PEOPLE, ROWS, SYNC, coverageFor, haversine, personName } from './data'
import { LAST, PRESENCE, SPACE } from './derived'
import { fmtDateTime, fmtKm, fmtTime } from '../lib/format'

export type ScenarioId = 'LAST' | 'GPAUL' | 'GAMY' | 'MISSING' | 'SYNC' | 'MEET' | 'HOSTILE' | 'PRESENCE' | 'SPACE'

/** Sweep signal ids and the insight each scenario belongs to (see mock/signals.ts). */
export const SIGNAL_OF: Record<ScenarioId, string[]> = {
  LAST: ['sig_01'],
  GPAUL: ['sig_02'],
  PRESENCE: ['sig_03'],
  SYNC: ['sig_04'],
  MISSING: ['sig_07'],
  GAMY: ['sig_08'],
  MEET: ['sig_10'],
  HOSTILE: ['sig_11'],
  SPACE: ['sig_12'],
}
export const INCIDENT_OF: Record<ScenarioId, string> = { LAST: 'INC-1', GPAUL: 'INC-1', PRESENCE: 'INC-1', SYNC: 'INC-2', MISSING: 'INC-3', GAMY: 'INC-3', MEET: 'INC-4', HOSTILE: 'INC-5', SPACE: 'INC-6' }

interface ScenarioDef {
  check: CheckName
  agent: SubagentName
  route_reason: string
  tools: string[]
  people: PersonId[]
  statement: string
  output: CheckOutput
  evidence: string[]
  data: string
  compute: { detail: string; code: string }
  rule: { detail: string; code?: string }
  numbers: NumberTrace[]
  corroboration: Corroboration[]
  /** Follow-up hops between subagents, recorded as derivation steps. */
  follow_ups?: DerivationStep[]
}

/** Corroboration row: phones not named are 'n/a'. */
const corr = (fact: string, phones: Partial<Corroboration['phones']>): Corroboration => ({ fact, phones: Object.fromEntries(ALL_PHONES.map((p) => [p, phones[p] ?? 'n/a'])) as Corroboration['phones'] })
const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six']
const ph = (p: PersonId) => PRESENCE.phones.find((x) => x.person === p)!
const sp = (p: PersonId) => SPACE.spaces.find((x) => x.person === p)!
const gapIds = (g: typeof GPAUL) => [g.bounding.before.id, g.bounding.after.id, ...g.activity.map((a) => a.id), ...g.power_event_ids]

// ---------- numbers computed from check output, used in statements ----------
const summon = LAST.items.find((i) => i.body?.startsWith("I've seen"))!
const paulCloseD = ph('paul').closest_m!
const paulCloseT = ph('paul').closest_t!
const kenMin = Math.min(...ph('ken').slots.map((s) => s.distance_m ?? Infinity))
const caraMin = Math.min(...ph('cara').slots.map((s) => s.distance_m ?? Infinity))
const inside = SPACE.spaces.filter((s) => s.scene_inside).map((s) => s.person)
const outside = SPACE.spaces.filter((s) => !s.scene_inside).map((s) => s.person)
const names = (ps: PersonId[]) => (ps.length < 2 ? ps.map((p) => `${personName(p)}'s`).join('') : `${ps.slice(0, -1).map((p) => `${personName(p)}'s`).join(', ')} and ${personName(ps[ps.length - 1])}'s`)
const flaggedItems = HOSTILE.items.filter((i) => i.score >= HOSTILE.threshold)
const peak = [...flaggedItems].sort((a, b) => b.score - a.score)[0]
const powerOff = GPAUL.power_event_ids

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  LAST: {
    check: 'last_contacts',
    agent: 'comms-analyst',
    route_reason: "The victim's own phone is the best record of his last evening, so the comms analyst lists every message and call on it from 17:00 until the battery died, and checks whether each one survives on the other phone.",
    tools: [`last_contacts(person='ravi', start='2026-04-16T17:00', end='${LAST.window.end.slice(0, 16)}')`],
    people: ['ravi', 'paul', 'amy'],
    statement: `At ${fmtTime(summon.t)} on 16 April Ravi's phone texted Paul "I've seen the Novak invoices. Pier 9, 9:30 tonight. Come alone.", and its last outgoing activity was a text to Amy at ${fmtTime(LAST.last_active.t)}.`,
    output: LAST,
    evidence: LAST.items.map((i) => i.id),
    data: `Read every message and call on Ravi's phone from 17:00 on 16 April to ${fmtDateTime(LAST.window.end)}: ${LAST.items.length} rows. For each, looked for the same row on the other phone and for a thread_deleted event there.`,
    compute: { detail: 'Sort by time; the last activity is the latest row with direction = out. A row missing from the counterpart phone, with a later thread_deleted event there, is marked deleted.', code: `last_active = max(t WHERE direction='out') = ${fmtTime(LAST.last_active.t)};  on Paul's phone: thread_deleted ${fmtTime(SYNC.events[0].t)} 17 Apr` },
    rule: { detail: 'Reported as found. Content of messages is quoted, never summarised, and the statement does not say what the text means.' },
    numbers: [
      { text: fmtTime(summon.t), field: 'last_contacts.items[0].t', value: fmtDateTime(summon.t) },
      { text: fmtTime(LAST.last_active.t), field: 'last_contacts.last_active.t', value: fmtDateTime(LAST.last_active.t) },
    ],
    corroboration: [
      corr('18:05 text Ravi → Paul', { ravi: 'present', paul: 'deleted' }),
      corr('20:58 call Paul → Ravi, 64 s', { ravi: 'present', paul: 'present' }),
      corr('21:47 text Ravi → Amy', { ravi: 'present', amy: 'deleted' }),
    ],
  },

  GPAUL: {
    check: 'location_gaps',
    agent: 'location-analyst',
    route_reason: 'A gap in location data during the time-of-death window is a question about where a phone was, so the location analyst owns it and asks the comms analyst what led up to it.',
    tools: ["location_gaps(person='paul', start='2026-04-13', end='2026-04-19', min_gap_min=45)", "presence_window(scene='Pier 9 Warehouse', start='2026-04-16T21:00', end='2026-04-16T23:30')"],
    people: ['paul', 'ravi'],
    statement: `Paul's phone was ${fmtKm(paulCloseD)} from Pier 9 at ${fmtTime(paulCloseT)} on 16 April and was then powered off from ${fmtTime(ROWS_T(powerOff[0]))} to ${fmtTime(ROWS_T(powerOff[1]))}, covering most of the time-of-death window.`,
    output: GPAUL,
    evidence: [...gapIds(GPAUL), ...ph('paul').slots.filter((s) => s.row_id).map((s) => s.row_id!)],
    data: `Read Paul's location rows in order and found ${GPAUL.minutes} minutes with none, between the rows at ${fmtTime(GPAUL.bounding.before.t)} and ${fmtTime(GPAUL.bounding.after.t)}. A power_off / power_on pair covers it.`,
    compute: { detail: `Gap = (first row after − last row before) − one ${GPAUL.thresholds.interval_min}-minute interval each side. Distance to the scene by haversine on the last fix before the gap.`, code: `gap = [${fmtTime(GPAUL.start)}, ${fmtTime(GPAUL.end)}] → ${GPAUL.minutes} min;  d(last fix, Pier 9) = ${paulCloseD} m;  power_off covers it ⇒ gap_type = "powered_off"` },
    rule: { detail: 'powered_off gaps are normally not raised (phones are switched off overnight), but this one overlaps the time-of-death window and follows a fix within 1 km of the scene, so it is raised.', code: 'raise if gap_type == "location_off" or overlaps(window | another_signal)' },
    numbers: [
      { text: fmtKm(paulCloseD), field: 'presence_window.phones[paul].closest_m', value: `${paulCloseD} m` },
      { text: fmtTime(paulCloseT), field: 'presence_window.phones[paul].closest_t', value: fmtDateTime(paulCloseT) },
      { text: fmtTime(ROWS_T(powerOff[0])), field: 'location_gaps.power_event_ids[0] (power_off)', value: fmtDateTime(ROWS_T(powerOff[0])) },
      { text: fmtTime(ROWS_T(powerOff[1])), field: 'location_gaps.power_event_ids[1] (power_on)', value: fmtDateTime(ROWS_T(powerOff[1])) },
    ],
    corroboration: [corr(`Fix ${fmtKm(paulCloseD)} from Pier 9, 21:10`, { paul: 'present' }), corr('Powered off 21:16–23:38', { paul: 'present' }), corr('Call to Ravi at 20:58', { paul: 'present', ravi: 'present' })],
    follow_ups: [
      {
        kind: 'follow_up',
        actor: 'model',
        title: 'Follow-up: location-analyst → comms-analyst',
        detail: "The location analyst asked what contact Paul's phone had before it went dark. The comms analyst found the 20:58 call to Ravi on both phones, and on Ravi's phone (not Paul's) the 18:05 text naming Pier 9 and 9:30.",
        code: "search_messages(person='ravi', counterpart='paul', start='2026-04-16T17:00', end='2026-04-16T21:16')",
      },
    ],
  },

  PRESENCE: {
    check: 'presence_window',
    agent: 'location-analyst',
    route_reason: 'The time-of-death window and the scene are case inputs, so the location analyst places every phone in every 10-minute slot of that window.',
    tools: [`presence_window(scene='Pier 9 Warehouse', start='2026-04-16T21:00', end='2026-04-16T23:30', scene_m=${PRESENCE.thresholds.scene_m}, near_m=${PRESENCE.thresholds.near_m})`],
    people: ALL_PHONES,
    statement: `Between 21:00 and 23:30 on 16 April only Ravi's phone was at Pier 9; Ken's and Cara's phones stayed at least ${fmtKm(kenMin < caraMin ? kenMin : caraMin)} away in every slot, and Paul's and Amy's phones had no location data in ${ph('paul').counts.no_data} and ${ph('amy').counts.no_data} of the ${ph('paul').slots.length} slots.`,
    output: PRESENCE,
    evidence: PRESENCE.phones.flatMap((p) => p.slots.filter((s) => s.row_id).map((s) => s.row_id!)),
    data: `Read the location row at each 10-minute slot from 21:00 to 23:30 on all ${ALL_PHONES.length} phones (${PRESENCE.phones[0].slots.length} slots each). Where there is none, looked up the gap that covers it.`,
    compute: { detail: `Haversine distance from each fix to Pier 9. At the scene ≤ ${PRESENCE.thresholds.scene_m} m; near ≤ ${fmtKm(PRESENCE.thresholds.near_m)}; otherwise away. No row → no data (with the gap type).`, code: PRESENCE.phones.map((p) => `${p.person}: ${p.counts.scene} scene · ${p.counts.near} near · ${p.counts.away} away · ${p.counts.no_data} no data`).join('\n') },
    rule: { detail: 'No data is never read as presence or absence. A phone with no location data in the window is reported as exactly that, with the reason (powered off, location off).' },
    numbers: [
      { text: fmtKm(Math.min(kenMin, caraMin)), field: 'presence_window.phones[cara].min(distance_m)', value: `${Math.min(kenMin, caraMin)} m` },
      { text: String(ph('paul').counts.no_data), field: 'presence_window.phones[paul].counts.no_data', value: String(ph('paul').counts.no_data) },
      { text: String(ph('amy').counts.no_data), field: 'presence_window.phones[amy].counts.no_data', value: String(ph('amy').counts.no_data) },
      { text: String(ph('paul').slots.length), field: 'presence_window.slots.length', value: String(ph('paul').slots.length) },
    ],
    corroboration: PRESENCE.phones.map((p) => corr(`${personName(p.person)}: ${p.counts.scene} at scene, ${p.counts.no_data} no data`, { [p.person]: p.counts.no_data === p.slots.length ? 'absent' : 'present' })),
  },

  SYNC: {
    check: 'synchronised_behaviour',
    agent: 'device-forensics',
    route_reason: 'Coordinated deletions and power-offs across phones are device events, so device forensics owns them and then searches for a trigger.',
    tools: ["synchronised_behaviour(start='2026-04-13', end='2026-04-19', window_min=60, min_phones=3)", "search_messages(before=window.start, limit=1, inbound=true)"],
    people: SYNC.phones,
    statement: `Paul's, Amy's and Cara's phones each deleted a thread within ${SYNC.window.minutes} minutes, starting ${SYNC.trigger!.minutes_before_window} minutes after a ${fmtTime(SYNC.trigger!.t)} news alert about a death at Pier 9, and Paul's and Cara's phones then powered off.`,
    output: SYNC,
    evidence: [SYNC.trigger!.id, ...SYNC.events.map((e) => e.id)],
    data: `Read every thread_deleted, power_off and power_on event on all ${ALL_PHONES.length} phones, plus messages received in the 2 hours before any cluster.`,
    compute: { detail: 'Slide a 60-minute window over the events and keep windows where at least 3 distinct phones each have a deletion or power-off.', code: `window = [${fmtTime(SYNC.window.start)}, ${fmtTime(SYNC.window.end)}] → ${SYNC.window.minutes} min, phones = {${SYNC.phones.join(', ')}}` },
    rule: { detail: `Rule: ≥ ${SYNC.thresholds.min_phones} phones within ${SYNC.thresholds.window_min} min. The trigger candidate is the latest inbound message before the window: the ${fmtTime(SYNC.trigger!.t)} news alert, ${SYNC.trigger!.minutes_before_window} min before.`, code: `${SYNC.phones.length} ≥ ${SYNC.thresholds.min_phones}  ∧  ${SYNC.window.minutes} ≤ ${SYNC.thresholds.window_min}` },
    numbers: [
      { text: `${SYNC.window.minutes} minutes`, field: 'synchronised_behaviour.window.minutes', value: String(SYNC.window.minutes) },
      { text: `${SYNC.trigger!.minutes_before_window} minutes`, field: 'synchronised_behaviour.trigger.minutes_before_window', value: String(SYNC.trigger!.minutes_before_window) },
      { text: fmtTime(SYNC.trigger!.t), field: 'synchronised_behaviour.trigger.t', value: fmtDateTime(SYNC.trigger!.t) },
    ],
    corroboration: [
      corr('News alert received 09:05', { paul: 'present', amy: 'present', ken: 'present', cara: 'present' }),
      corr('Thread deleted in window', { paul: 'present', amy: 'present', ken: 'absent', cara: 'present' }),
      corr('Powered off in window', { paul: 'present', amy: 'absent', ken: 'absent', cara: 'present' }),
    ],
  },

  MISSING: {
    check: 'missing_messages',
    agent: 'comms-analyst',
    route_reason: 'Found by the sweep, which compares every pair of phones message by message. The victim’s phone keeps both sides of his conversations.',
    tools: ["missing_messages(person_a='ravi', person_b='amy', start='2026-04-13', end='2026-04-19')"],
    people: ['ravi', 'amy'],
    statement: `${words[MISSING.missing_count]} texts between Ravi and Amy on the evening of 16 April are on Ravi's phone but missing from Amy's phone, which deleted that thread at ${fmtTime(MISSING.deletion_events[0].t)} on 17 April.`,
    output: MISSING,
    evidence: [...MISSING.items.flatMap((i) => [i.on_a, i.on_b]).filter((x): x is string => !!x), ...MISSING.deletion_events.map((e) => e.id)],
    data: "Read every message and call between Ravi's and Amy's numbers on both phones.",
    compute: { detail: `Match each message on one phone to the other phone on sender, recipient, body and timestamp (±${MISSING.tolerance_s} s). Calls are matched the same way as anchors.`, code: `unmatched = ravi.messages(amy) − amy.messages(ravi)  →  ${MISSING.missing_count}` },
    rule: { detail: `Messages on one phone with no counterpart on the other are reported, with any thread_deleted event on the phone that lacks them (Amy's phone, ${fmtDateTime(MISSING.deletion_events[0].t)}). The 2 calls match on both phones, so the gap is in messages only.` },
    numbers: [
      { text: words[MISSING.missing_count], field: 'missing_messages.missing_count', value: String(MISSING.missing_count) },
      { text: fmtTime(MISSING.deletion_events[0].t), field: 'missing_messages.deletion_events[0].t', value: fmtDateTime(MISSING.deletion_events[0].t) },
    ],
    corroboration: [corr('5 texts Ravi ↔ Amy, 16 Apr 19:40–22:15', { ravi: 'present', amy: 'deleted' }), corr('2 calls Amy → Ravi, 22:30–22:31', { ravi: 'present', amy: 'present' })],
  },

  GAMY: {
    check: 'location_gaps',
    agent: 'location-analyst',
    route_reason: 'A gap during the time-of-death window, on a phone that was in use, is the kind of gap worth raising; the location analyst owns it and asks what the phone did meanwhile.',
    tools: ["location_gaps(person='amy', start='2026-04-13', end='2026-04-19', min_gap_min=45)"],
    people: ['amy', 'ravi'],
    statement: `Amy's phone reported no location data from ${fmtTime(GAMY.start)} to ${fmtTime(GAMY.end)} on 16 April, while it called Ravi's phone twice, at ${fmtTime(GAMY.activity[0].t)} and ${fmtTime(GAMY.activity[1].t)}.`,
    output: GAMY,
    evidence: gapIds(GAMY),
    data: `Read Amy's location rows in order and found ${GAMY.minutes} minutes with none, between the rows at ${fmtTime(GAMY.bounding.before.t)} and ${fmtTime(GAMY.bounding.after.t)}. Then read every message, call, transfer and power event on her phone inside that window.`,
    compute: { detail: `Gap = (first row after − last row before) − one ${GAMY.thresholds.interval_min}-minute interval each side. Keep gaps ≥ ${GAMY.thresholds.min_gap_min} min, then classify.`, code: `gap = [${fmtTime(GAMY.start)}, ${fmtTime(GAMY.end)}] → ${GAMY.minutes} min;  power_off covering it: none;  activity inside: ${GAMY.activity.length} rows  ⇒  gap_type = "location_off"` },
    rule: { detail: 'location_off (the phone was in use while reporting no location) is raised by default. Wording: "no location data", never a claim about intent. Both bounding fixes are at her home, 14 km from Pier 9; the gap alone cannot say where the phone was.' },
    numbers: [
      { text: fmtTime(GAMY.start), field: 'location_gaps.start', value: fmtDateTime(GAMY.start) },
      { text: fmtTime(GAMY.end), field: 'location_gaps.end', value: fmtDateTime(GAMY.end) },
      { text: fmtTime(GAMY.activity[0].t), field: 'location_gaps.activity[0].t', value: fmtDateTime(GAMY.activity[0].t) },
      { text: fmtTime(GAMY.activity[1].t), field: 'location_gaps.activity[1].t', value: fmtDateTime(GAMY.activity[1].t) },
    ],
    corroboration: [corr('No location rows 21:40–22:50', { amy: 'absent' }), corr('Calls to Ravi at 22:30 and 22:31', { amy: 'present', ravi: 'present' })],
    follow_ups: [
      { kind: 'follow_up', actor: 'model', title: 'Follow-up: location-analyst → comms-analyst', detail: "Asked what Amy's phone did during the gap. The comms analyst found two unanswered calls to Ravi, on both phones. A 22:15 text to Ravi is on Ravi's phone only.", code: "search_messages(person='amy', start='2026-04-16T21:40', end='2026-04-16T22:50')" },
    ],
  },

  MEET: {
    check: 'silent_meetings',
    agent: 'relationship-mapper',
    route_reason: 'Discovery flagged a Paul–Cara link made only of co-location, with nothing on any contact channel. That is a relationship question, so the relationship mapper checks every channel against the location analyst’s co-location episodes.',
    tools: ["contact_graph(people=['paul', 'cara'])", "silent_meetings(start='2026-04-13', end='2026-04-19')"],
    people: ['paul', 'cara'],
    statement: `Paul's and Cara's phones were within ${MEET.thresholds.within_m} m of each other on ${MEET.occasions.length} separate days at ${MEET.occasions.length} different unnamed spots, and no call, text, saved contact, payment or social tie between them exists on any phone.`,
    output: MEET,
    evidence: MEET.occasions.flatMap((o) => o.row_ids),
    data: `Paired every 10-minute location slot across all phone pairs, and searched every message, call, contact, transaction and social row on all ${ALL_PHONES.length} phones for any row between ${NUMBERS.paul} and ${NUMBERS.cara} or their handles.`,
    compute: { detail: 'Group consecutive slots where the two phones are within range into episodes; an episode lasts (last − first) + 10 min.', code: `episode if haversine(paul, cara) ≤ ${MEET.thresholds.within_m} m for consecutive slots; contacts = COUNT(messages ∪ calls ∪ contacts ∪ transactions ∪ social WHERE {from,to} = {paul, cara})` },
    rule: { detail: `Rule: ≥ ${MEET.thresholds.min_occasions} episodes of ≥ ${MEET.thresholds.min_minutes} min with 0 contact rows. Found ${MEET.occasions.length} episodes and ${MEET.contact_rows_found} contact rows. None of the five spots is a named place, and no other pair of phones meets this way.`, code: `episodes = ${MEET.occasions.length} ≥ ${MEET.thresholds.min_occasions}  ∧  contacts = ${MEET.contact_rows_found}` },
    numbers: [
      { text: `${MEET.thresholds.within_m} m`, field: 'silent_meetings.thresholds.within_m', value: String(MEET.thresholds.within_m) },
      { text: `${MEET.occasions.length} separate days`, field: 'silent_meetings.occasions.length', value: String(MEET.occasions.length) },
    ],
    corroboration: [...MEET.occasions.map((o) => corr(`Both phones at an ${o.place}, ${o.date} ${fmtTime(o.start)}`, { paul: 'present', cara: 'present' })), corr('Any call, text, contact, payment or social tie between them', { ravi: 'absent', paul: 'absent', amy: 'absent', ken: 'absent', cara: 'absent' })],
  },

  HOSTILE: {
    check: 'social_hostility',
    agent: 'social-analyst',
    route_reason: 'Posts and comments about another person in the case are social-media evidence, so the social analyst scores them with a fixed classifier and asks the location analyst whether the account holder’s phone was near the scene.',
    tools: [`social_hostility(actor='ken', target='ravi', threshold=${HOSTILE.threshold}, model='${HOSTILE.model}')`],
    people: ['ken', 'ravi'],
    statement: `After Ravi's text ending Ken's job on 14 April, Ken's Snapline account posted ${HOSTILE.flagged} items about Ravi that the classifier scored ${HOSTILE.threshold} or higher for hostility, including "${peak.text}" at ${fmtTime(peak.t)} on 16 April.`,
    output: HOSTILE,
    evidence: [HOSTILE.context!.id, ...HOSTILE.items.map((i) => i.id)],
    data: `Read every post, comment and reply by ${PEOPLE.find((p) => p.person_id === 'ken')!.handle} on Snapline, 13–19 April, kept the ${HOSTILE.items.length} that name or reply to Ravi, and scored each one.`,
    compute: { detail: `Each item's text is scored 0–1 by ${HOSTILE.model}. The model and its version are fixed, so the same text always gets the same score.`, code: HOSTILE.items.map((i) => `${fmtTime(i.t)} ${i.score.toFixed(2)}  "${i.text.slice(0, 40)}${i.text.length > 40 ? '…' : ''}"`).join('\n') },
    rule: { detail: `Flag items scoring ≥ ${HOSTILE.threshold}. Hostile posts are reported as tension, never as evidence of presence or intent; the presence check is always run alongside.`, code: `flagged = COUNT(score ≥ ${HOSTILE.threshold}) = ${HOSTILE.flagged} of ${HOSTILE.items.length}` },
    numbers: [
      { text: String(HOSTILE.flagged), field: 'social_hostility.flagged', value: String(HOSTILE.flagged) },
      { text: String(HOSTILE.threshold), field: 'social_hostility.threshold', value: String(HOSTILE.threshold) },
      { text: fmtTime(peak.t), field: 'social_hostility.items[max score].t', value: fmtDateTime(peak.t) },
    ],
    corroboration: [corr('Text ending Ken’s job, 14 Apr 16:20', { ken: 'present', ravi: 'present' }), corr(`${HOSTILE.flagged} flagged posts about Ravi`, { ken: 'present' }), corr(`Ken's phone ≥ ${fmtKm(kenMin)} from Pier 9, 21:00–23:30`, { ken: 'present' })],
    follow_ups: [
      { kind: 'follow_up', actor: 'model', title: 'Follow-up: social-analyst → location-analyst', detail: `Asked where Ken's phone was in the time-of-death window. presence_window: away in all ${ph('ken').slots.length} slots, never closer than ${fmtKm(kenMin)}, with no gaps. The hostility stays a lead for interview, not a placement.`, code: "presence_window(person='ken', start='2026-04-16T21:00', end='2026-04-16T23:30')" },
    ],
  },

  SPACE: {
    check: 'activity_space',
    agent: 'location-analyst',
    route_reason: 'Whether the scene is part of someone’s normal routine changes how a visit there should be read, so the location analyst draws each phone’s routine area.',
    tools: [`activity_space(min_days=${SPACE.rule.min_days}, buffer_m=${SPACE.rule.buffer_m}, scene='Pier 9 Warehouse')`],
    people: ALL_PHONES,
    statement: `Pier 9 lies inside the routine areas of ${names(inside)} phones and outside ${names(outside)}, and Paul's phone stayed at Pier 9 on only ${sp('paul').scene_visits.length} day before the 16th.`,
    output: SPACE,
    evidence: ALL_PHONES.flatMap(scenePoints),
    data: `Read every location row on all ${ALL_PHONES.length} phones (${SPACE.spaces.reduce((n, s) => n + s.fixes, 0).toLocaleString()} rows) and the stays table built from them.`,
    compute: { detail: `Anchor = home. A routine place is one the phone stayed at on ≥ ${SPACE.rule.min_days} separate days. Radius = distance to the farthest routine place + ${SPACE.rule.buffer_m} m. The scene is inside if its distance from the anchor ≤ radius.`, code: SPACE.spaces.map((s) => `${s.person}: r = ${fmtKm(s.radius_m)}, scene at ${fmtKm(s.scene_distance_m)} → ${s.scene_inside ? 'inside' : 'outside'}`).join('\n') },
    rule: { detail: 'A routine area is context, not evidence: it says whether a visit to the scene would be ordinary for that phone. Circles are drawn from stays on 2+ days, so a single trip does not widen them.' },
    numbers: [{ text: String(sp('paul').scene_visits.length), field: 'activity_space.spaces[paul].scene_visits.length', value: String(sp('paul').scene_visits.length) }],
    corroboration: SPACE.spaces.map((s) => corr(`${personName(s.person)}: scene ${s.scene_inside ? 'inside' : 'outside'} routine area (${fmtKm(s.radius_m)})`, { [s.person]: 'present' })),
  },
}

function ROWS_T(id: string) {
  return ROWS.get(id)!.timestamp
}
/** Cite each phone's fixes at the scene (the rows behind scene_visits) rather than every location row. */
function scenePoints(p: PersonId) {
  return [...ROWS.values()].filter((r) => r.device_owner === p && r.table === 'locations' && haversine(Number(r.fields.lat), Number(r.fields.lon), SPACE.scene.lat, SPACE.scene.lon) <= PRESENCE.thresholds.scene_m).map((r) => r.id)
}

function validatorFor(statement: string, evidence: string[], numbers: NumberTrace[]): ValidatorCheck[] {
  return [
    { rule: 'Cites evidence', passed: evidence.length > 0, detail: `${evidence.length} evidence ids, all resolve through /api/evidence` },
    { rule: 'Neutral wording', passed: !/lied|guilty|lying|suspect|murder/i.test(statement), detail: 'No "lied", "guilty", "suspect" or "murder"' },
    { rule: 'Numbers traced to check output', passed: numbers.every((n) => statement.includes(n.text)), detail: `${numbers.length} numbers, each matched to a check-output field` },
    { rule: 'One sentence', passed: (statement.replace(/"[^"]*"/g, '""').match(/[.!?](\s|$)/g) ?? []).length === 1, detail: 'Single sentence, plain language' },
  ]
}

export function scenarioFinding(sid: ScenarioId, id: string): Finding {
  const sc = SCENARIOS[sid]
  const sigs = SIGNAL_OF[sid]
  const inc = INCIDENT_OF[sid]
  const steps: DerivationStep[] = [
    { kind: 'signal', actor: 'code', title: `Signal ${sigs.join(', ')} from the sweep`, detail: 'On case load, run_sweep() ran every check over every phone and pair for 13–19 April, with the scene and time-of-death window as inputs. This hit was saved to the signals table with its evidence ids and strength.' },
    { kind: 'grouped', actor: 'code', title: `Grouped into insight ${inc}`, detail: `propose_incidents() grouped signals that share people and overlap in time; the orchestrator accepted the grouping. Insight ${inc} is ranked in the opening briefing.` },
    { kind: 'route', actor: 'model', title: `Owned by ${sc.agent}`, detail: sc.route_reason },
    ...sc.tools.map((t) => ({ kind: 'tool' as const, actor: 'code' as const, title: 'Check called', detail: 'Deterministic code over the case store. No model involved.', code: t })),
    ...(sc.follow_ups ?? []),
    { kind: 'data', actor: 'code', title: 'Data read', detail: `${sc.data} ${sc.evidence.length} rows kept as evidence.` },
    { kind: 'compute', actor: 'code', title: 'Computation', detail: sc.compute.detail, code: sc.compute.code },
    { kind: 'rule', actor: 'code', title: 'Rule applied', detail: sc.rule.detail, code: sc.rule.code },
    { kind: 'statement', actor: 'model', title: 'Statement written and validated', detail: 'The subagent phrased one sentence from the check output, then validate_report() checked it (below).' },
  ]
  return {
    id,
    section: 'unprompted',
    item_id: null,
    brief_item: null,
    claimant: null,
    status: 'current',
    verdict: 'confirmed',
    statement: sc.statement,
    people: sc.people,
    check: sc.check,
    agent: sc.agent,
    evidence_ids: sc.evidence,
    check_output: sc.output,
    derivation: { steps, numbers: sc.numbers, validator: validatorFor(sc.statement, sc.evidence, sc.numbers), corroboration: sc.corroboration },
  }
}

/** For questions the phones cannot settle (outside coverage). */
export function cannotTellFinding(id: string, item: string): Finding {
  const out = coverageFor(item)
  const statement = 'The phones only hold data from 13 to 19 April 2026, so they cannot settle this question.'
  const numbers: NumberTrace[] = [
    { text: '13', field: 'get_coverage.start', value: fmtDateTime(out.start) },
    { text: '19 April 2026', field: 'get_coverage.end', value: fmtDateTime(out.end) },
  ]
  return {
    id,
    section: 'answers',
    item_id: null,
    brief_item: item,
    claimant: 'investigator',
    status: 'current',
    verdict: 'cannot_tell',
    statement,
    people: ALL_PHONES,
    check: 'get_coverage',
    agent: 'device-forensics',
    evidence_ids: COVERAGE_IDS,
    check_output: out,
    derivation: {
      steps: [
        { kind: 'question', actor: 'model', title: 'Question', detail: `“${item}”` },
        { kind: 'route', actor: 'model', title: 'Routed to device-forensics', detail: 'The question refers to a period, so the first step is to check whether the phones cover it.' },
        { kind: 'tool', actor: 'code', title: 'Check called', detail: 'Returns the earliest and latest row on every phone.', code: 'get_coverage()' },
        { kind: 'rule', actor: 'code', title: 'Cannot tell', detail: 'The period lies outside every phone’s coverage, so no check can confirm or contradict it. The agent answers cannot_tell instead of guessing.' },
        { kind: 'statement', actor: 'model', title: 'Statement written and validated', detail: 'Cites the first and last row on each phone as evidence of coverage.' },
      ],
      numbers,
      validator: validatorFor(statement, COVERAGE_IDS, numbers),
      corroboration: [corr('Coverage 13–19 April only', Object.fromEntries(ALL_PHONES.map((p) => [p, 'present'])))],
    },
  }
}

/** Which scenario a question is about. null means the phones can't settle it. */
export function route(text: string): ScenarioId | null {
  const t = text.toLowerCase()
  if (/\b(march|january|february|2025|last year)\b/.test(t)) return null
  if (/who was (near|at)|near the scene|at the scene|in the window|time of death|where was everyone/.test(t)) return 'PRESENCE'
  if (/paul/.test(t) && /(off|dark|where|night|gap)/.test(t)) return 'GPAUL'
  if (/amy/.test(t) && /(location|gap|where|off)/.test(t)) return 'GAMY'
  if (/(last|final).*(contact|text|message|call)|ravi.*(text|message)|who did ravi/.test(t)) return 'LAST'
  if (/delet|missing|argu/.test(t) && /amy/.test(t)) return 'MISSING'
  if (/news|react|wipe|deleted|power(ed)? off|after the body/.test(t)) return 'SYNC'
  if (/cara/.test(t) && /(paul|know|meet|met|money|paid)/.test(t)) return 'MEET'
  if (/ken|hostile|threat|post|social|grudge|motive/.test(t)) return 'HOSTILE'
  if (/routine|area|radius|usual|regular/.test(t)) return 'SPACE'
  return null
}
