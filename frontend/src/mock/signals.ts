// Stage ① sweep output (signals) and stage ② triage output (insights, anchors, dismissals).
// In the real system: run_sweep() writes `signals`; propose_incidents(), anchor_moments() and
// rank_incidents() are code helpers; agents accept groupings, dismiss with reasons and word headlines.

import type { Anchor, Dismissal, GapOutput, Incident, InquiryId, PersonId, Signal } from '../api/types'
import { personName, AMY_POST, CARA_GAP, GAMY, GPAUL, HOSTILE, KEN_NIGHT, LUNCH_IDS, FRESHMART_IDS, MEET, MISSING, SYNC, SYNC_GAPS, TOD } from './data'
import { LAST, PRESENCE, SPACE } from './derived'
import { SCENARIOS, SIGNAL_OF, scenarioFinding, type ScenarioId } from './findings'
import { fmtKm, fmtTime } from '../lib/format'

const gapIds = (g: GapOutput) => [g.bounding.before.id, g.bounding.after.id, ...g.activity.map((a) => a.id), ...g.power_event_ids]
const ev = (sid: ScenarioId) => SCENARIOS[sid].evidence
const ph = (p: PersonId) => PRESENCE.phones.find((x) => x.person === p)!
const kenMin = Math.min(...ph('ken').slots.map((s) => s.distance_m ?? Infinity))

export const SIGNALS: Signal[] = [
  { signal_id: 'sig_01', check: 'last_contacts', people: ['ravi', 'paul', 'amy'], start: LAST.window.start, end: LAST.window.end, evidence_ids: ev('LAST'), strength: 0.9, summary: `Victim's last evening: text to Paul naming Pier 9 at 9:30; last outgoing activity ${fmtTime(LAST.last_active.t)}` },
  { signal_id: 'sig_02', check: 'location_gaps', people: ['paul'], start: GPAUL.start, end: GPAUL.end, evidence_ids: gapIds(GPAUL), strength: 0.9, summary: `paul: no location data ${fmtTime(GPAUL.start)}–${fmtTime(GPAUL.end)} (powered_off, overlaps the time-of-death window)` },
  { signal_id: 'sig_03', check: 'presence_window', people: ['ravi', 'paul', 'amy', 'ken', 'cara'], start: TOD.start, end: TOD.end, evidence_ids: ev('PRESENCE'), strength: 0.85, summary: 'Only the victim’s phone at the scene; 2 phones with no location data in the window' },
  { signal_id: 'sig_04', check: 'synchronised_behaviour', people: SYNC.phones, start: SYNC.window.start, end: SYNC.window.end, evidence_ids: ev('SYNC'), strength: 0.95, summary: `3 phones deleted a thread within ${SYNC.window.minutes} min of each other, ${SYNC.trigger!.minutes_before_window} min after the news alert` },
  ...SYNC_GAPS.map((g, i) => ({
    signal_id: `sig_0${i + 5}`,
    check: 'location_gaps' as const,
    people: [g.person],
    start: g.start,
    end: g.end,
    evidence_ids: gapIds(g),
    strength: 0.4,
    summary: `${g.person}: no location data ${fmtTime(g.start)}–${fmtTime(g.end)} (powered_off, overlaps sig_04)`,
  })),
  { signal_id: 'sig_07', check: 'missing_messages', people: ['ravi', 'amy'], start: MISSING.items[0].t, end: MISSING.deletion_events[0].t, evidence_ids: ev('MISSING'), strength: 0.9, summary: `${MISSING.missing_count} texts on Ravi's phone missing from Amy's; thread deleted 17 Apr` },
  { signal_id: 'sig_08', check: 'location_gaps', people: ['amy'], start: GAMY.start, end: GAMY.end, evidence_ids: gapIds(GAMY), strength: 0.9, summary: `amy: no location data ${fmtTime(GAMY.start)}–${fmtTime(GAMY.end)} while the phone was in use (location_off)` },
  { signal_id: 'sig_10', check: 'silent_meetings', people: ['paul', 'cara'], start: MEET.occasions[0].start, end: MEET.occasions[MEET.occasions.length - 1].end, evidence_ids: ev('MEET'), strength: 1.0, summary: `Phones within 100 m on ${MEET.occasions.length} days at ${MEET.occasions.length} unnamed spots; 0 contact, payment or social rows` },
  { signal_id: 'sig_11', check: 'social_hostility', people: ['ken', 'ravi'], start: HOSTILE.items[0].t, end: HOSTILE.items[HOSTILE.items.length - 1].t, evidence_ids: ev('HOSTILE'), strength: 0.8, summary: `${HOSTILE.flagged} posts by Ken about Ravi scored ≥ ${HOSTILE.threshold}` },
  { signal_id: 'sig_12', check: 'activity_space', people: SPACE.spaces.filter((s) => s.scene_inside).map((s) => s.person), start: '2026-04-13T00:00:00-04:00', end: '2026-04-19T23:59:00-04:00', evidence_ids: ev('SPACE'), strength: 0.6, summary: 'Scene inside the routine area of 3 phones' },
  { signal_id: 'sig_13', check: 'location_gaps', people: ['ken'], start: KEN_NIGHT.start, end: KEN_NIGHT.end, evidence_ids: gapIds(KEN_NIGHT), strength: 0.2, summary: 'ken: no location data overnight 14→15 Apr (powered_off)' },
  { signal_id: 'sig_14', check: 'location_gaps', people: ['cara'], start: CARA_GAP.start, end: CARA_GAP.end, evidence_ids: gapIds(CARA_GAP), strength: 0.2, summary: 'cara: no location data 19 Apr 09:10–10:00 (unexplained)' },
]

export const ANCHORS: Anchor[] = [
  {
    anchor_id: 'A1',
    start: SYNC.window.start,
    end: SYNC.window.end,
    phones: SYNC.phones,
    signal_ids: ['sig_04', 'sig_05', 'sig_06'],
    label: '17 April, after the 09:05 news alert',
    finding_id: 'INC-2:f1',
  },
]

interface IncidentDef {
  id: string
  inquiry: InquiryId
  sids: ScenarioId[]
  signal_ids: string[]
  headline: string
  title: string
  /** Each fact names the scenario (finding) it comes from, so it is shown only once that finding is unlocked. */
  facts: [ScenarioId, string][]
  why: string
  follow_ups: string[]
  anchor_id?: string
}

const paulPh = ph('paul')
const DEFS: IncidentDef[] = [
  {
    id: 'INC-1',
    inquiry: 'window',
    sids: ['LAST', 'GPAUL', 'PRESENCE'],
    signal_ids: ['sig_01', 'sig_02', 'sig_03'],
    headline: "Ravi's phone asked Paul to Pier 9 that night; Paul's phone came within a kilometre and then went off",
    title: "Paul's phone went dark near Pier 9",
    facts: [['LAST', '18:05 text: "Pier 9, 9:30"'], ['GPAUL', `${fmtKm(paulPh.closest_m!)} away at ${fmtTime(paulPh.closest_t!)}`], ['GPAUL', 'off 21:16–23:38']],
    why: "The victim's own phone holds the invitation, which Paul's phone no longer has. Paul's phone is the only one besides the victim's to come within 1 km of the scene in the window, and it was switched off for most of it.",
    follow_ups: ['Where was Paul between 21:16 and 23:38?', 'What did Ravi text Paul on 16 April?'],
  },
  {
    id: 'INC-2',
    // The deletions show in the time-of-death timeline, on the morning after.
    inquiry: 'window',
    sids: ['SYNC'],
    signal_ids: ['sig_04', 'sig_05', 'sig_06'],
    headline: 'Three phones deleted threads within 35 minutes of the news breaking',
    title: 'Threads deleted after the news',
    facts: [`news alert ${fmtTime(SYNC.trigger!.t)}`, `3 phones in ${SYNC.window.minutes} min`, '2 then powered off'],
    why: "The sweep found this cluster without being told about the news; the alert turned up afterwards as the latest message before it. All three deletions removed the phone's thread with Ravi; Ravi's copies survive on his phone.",
    follow_ups: ['Who reacted to the news?', 'Which threads were deleted on 17 April?'],
    anchor_id: 'A1',
  },
  {
    id: 'INC-3',
    inquiry: 'window',
    sids: ['MISSING', 'GAMY'],
    signal_ids: ['sig_07', 'sig_08'],
    headline: "Amy's texts with Ravi that evening are gone from her phone, and her phone reported no location for 70 minutes of the window",
    title: 'Amy: texts deleted, location off in the window',
    facts: [['MISSING', `${MISSING.missing_count} texts gone from her phone`], ['GAMY', `no location ${fmtTime(GAMY.start)}–${fmtTime(GAMY.end)}`], ['GAMY', '2 calls to Ravi']],
    why: "Two checks agree on the same evening. Her bounding fixes are at home, 14 km from Pier 9, so the gap doesn't place her anywhere; it is a hole in the record during the window.",
    follow_ups: ["Was Amy's location off while her phone was in use?", 'What did Ravi and Amy text on 16 April?'],
  },
  {
    id: 'INC-4',
    // Shown on the board's relationship chart (click the Paul–Cara line for the exchanges).
    inquiry: 'connections',
    sids: ['MEET'],
    signal_ids: ['sig_10'],
    headline: "Paul's and Cara's phones met on five days at five different unnamed spots, yet neither phone has a single call, text, contact, payment or post involving the other",
    title: 'Paul and Cara: a link no record names',
    facts: [`${MEET.occasions.length} meetings, ${MEET.occasions.length} places`, '20 min each, arriving separately', '0 rows linking them'],
    why: 'Read phone by phone, Paul and Cara are strangers who each work with Ravi. The link appears only when their location tracks are compared: same unnamed roadside spots, same 20 minutes, five times. Ravi\'s 18:05 text names the "Novak invoices", and on 15 April he asked Paul for every Novak invoice since January.',
    follow_ups: ['Do Paul and Cara know each other?', 'Why would they meet but never call?'],
  },
  {
    id: 'INC-5',
    inquiry: 'motive',
    sids: ['HOSTILE'],
    signal_ids: ['sig_11'],
    headline: "Ken posted hostile comments about Ravi after being let go, but his phone was at least 9 km from Pier 9 all evening",
    title: 'Ken: hostile posts, but far away all evening',
    facts: [['HOSTILE', `${HOSTILE.flagged} posts ≥ ${HOSTILE.threshold}`], ['HOSTILE', 'after losing his job 14 Apr'], ['PRESENCE', `≥ ${fmtKm(kenMin)} away all window`]],
    why: 'A grievance is a lead for interview. The presence check, run alongside it, places his phone far from the scene in every slot with no gaps; motive alone does not put anyone at Pier 9.',
    follow_ups: ['Did anyone post threats about Ravi?', 'Where was Ken during the time-of-death window?'],
  },
  {
    id: 'INC-6',
    // Routine-area context is shown beside each phone on the time-of-death view.
    inquiry: 'window',
    sids: ['SPACE'],
    signal_ids: ['sig_12'],
    headline: "Pier 9 is part of Ken's and Cara's routine, but not Paul's or Amy's",
    title: 'Whose routine includes Pier 9',
    facts: [
      ['SPACE', `routine for ${SPACE.spaces.filter((s) => s.scene_inside && s.person !== 'ravi').map((s) => personName(s.person)).join(', ')}`],
      ['SPACE', `not for ${SPACE.spaces.filter((s) => !s.scene_inside).map((s) => personName(s.person)).join(', ')}`],
      ['SPACE', `rule: ${SPACE.rule.min_days}+ days, +${SPACE.rule.buffer_m} m`],
    ],
    why: "A visit to the scene means more from a phone that doesn't normally go there. Paul's phone stayed at Pier 9 on one day before the 16th; Amy's never did.",
    follow_ups: ["Whose usual area includes Pier 9?"],
  },
]

const sigById = (id: string) => SIGNALS.find((s) => s.signal_id === id)!

const MAPPED = new Set(Object.values(SIGNAL_OF).flat())

/**
 * rank_incidents(): code. Sort by distinct checks, then distinct phones, then max strength.
 * Only findings in `unlocked` count (their phones are loaded); an insight with none is not shown.
 * Finding ids keep their position in the full insight (INC-1:f2 is always Paul's gap).
 */
export function incidentsFor(unlocked: Iterable<ScenarioId>): Incident[] {
  const on = new Set(unlocked)
  const raw = DEFS.filter((d) => d.sids.some((sid) => on.has(sid))).map((d) => {
    const keepSig = new Set(d.sids.filter((sid) => on.has(sid)).flatMap((sid) => SIGNAL_OF[sid]))
    const sigs = d.signal_ids.filter((id) => keepSig.has(id) || !MAPPED.has(id)).map(sigById)
    const sids = d.sids.filter((sid) => on.has(sid))
    const checks = new Set(sigs.map((s) => s.check))
    const people = [...new Set(sigs.flatMap((s) => s.people).concat(sids.flatMap((sid) => SCENARIOS[sid].people)))]
    const starts = sigs.map((s) => s.start).sort()
    const ends = sigs.map((s) => s.end).sort()
    return { d, on, n_checks: checks.size, n_phones: people.length, strength: Math.max(...sigs.map((s) => s.strength)), people, start: starts[0], end: ends[ends.length - 1], checks: [...checks], signal_ids: sigs.map((s) => s.signal_id) }
  })
  raw.sort((a, b) => b.n_checks - a.n_checks || b.n_phones - a.n_phones || b.strength - a.strength)
  return raw.map((r, i) => ({
    incident_id: r.d.id,
    inquiry: r.d.inquiry,
    signal_ids: r.signal_ids,
    people: r.people,
    start: r.start,
    end: r.end,
    n_checks: r.n_checks,
    n_phones: r.n_phones,
    strength: r.strength,
    rank: i + 1,
    headline: r.d.headline,
    title: r.d.title,
    facts: r.d.facts.filter(([sid]) => r.on.has(sid)).map(([, text]) => text),
    why_it_matters: r.d.why,
    rank_reason: `${r.n_checks} check${r.n_checks > 1 ? 's' : ''} agree (${r.checks.join(', ')}) across ${r.n_phones} phones; strongest signal ${r.strength.toFixed(2)}.`,
    anchor_id: r.d.anchor_id,
    findings: r.d.sids.flatMap((sid, k) => (r.on.has(sid) ? [scenarioFinding(sid, `${r.d.id}:f${k + 1}`)] : [])),
    follow_ups: r.d.follow_ups,
  }))
}

export const INCIDENTS = incidentsFor(Object.keys(SIGNAL_OF) as ScenarioId[])

export const DISMISSALS: Dismissal[] = [
  { signal_id: 'sig_13', title: "Ken's phone off overnight, 14→15 April", reason: 'A power_off / power_on pair covers the gap, nothing else overlaps it, and it is days before the window. Phones are often switched off overnight.', rule: 'location_gaps: powered_off and not overlapping → not raised', by: 'code rule' },
  { signal_id: 'sig_14', title: "Cara's phone: no location data for 50 min on 19 April", reason: 'No message, call, transfer or power event during the gap, no other signal overlaps it, and it is after the window. Could be a flat battery or no signal.', rule: 'location_gaps: unexplained and not overlapping → not raised', by: 'code rule' },
  { signal_id: null, title: "Amy's and Ken's phones at FreshMart together once", reason: 'One occasion of 30 minutes, so it never became a signal.', rule: 'silent_meetings: needs ≥ 2 occasions', by: 'code rule' },
  { signal_id: null, title: 'Paul sent Amy $50 on 16 April, memo "lunch"', reason: 'Below the money-chain minimum, and nothing moved on from Amy afterwards. The memo gives an ordinary explanation.', rule: 'money_chains: first transfer ≥ $500', by: 'code rule' },
  { signal_id: null, title: 'Amy posted "Done being lied to." at 20:33 on 16 April', reason: 'Scored 0.55 by the classifier, below the 0.7 threshold, and it names no one. Context only.', rule: `social_hostility: score ≥ ${HOSTILE.threshold} and names a case person`, by: 'code rule' },
]
export const DECOY_EVIDENCE = { lunch: LUNCH_IDS, freshmart: FRESHMART_IDS, amyPost: AMY_POST }

export const findingById = (id: string) => INCIDENTS.flatMap((i) => i.findings).find((f) => f.id === id)
