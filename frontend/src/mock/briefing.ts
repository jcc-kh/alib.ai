// The proactive briefing: generated right after ingest from the unprompted sweep, before the
// investigator has written anything. Items are ranked by a fixed rule (see rank_reason).

import type { Briefing, TimelineEvent } from '../api/types'
import { S1, S2, S4, S5, S7 } from './data'
import { scenarioFinding, type ScenarioId } from './findings'

const ITEMS: { sid: ScenarioId; headline: string; why: string; rank: string; follow_ups: string[] }[] = [
  {
    sid: 'S7',
    headline: 'Three phones went dark right after the audit notice',
    why: 'Coordinated deletion and power-off within an hour of a trigger is the strongest sign of a shared reaction. It involves 3 of the 4 phones.',
    rank: 'Ranked 1st: involves 3 phones and follows a key case event (the audit notice) within 20 minutes.',
    follow_ups: ['Which threads were deleted on 17 April?', 'Did anyone react to the audit announcement?'],
  },
  {
    sid: 'S4b',
    headline: '$5,000 moved from Paul to Ken, then $4,500 to Cara the same afternoon',
    why: 'Money that moves on within hours at a similar amount is a common pass-through pattern. Cara is a supplier to the company the money is missing from.',
    rank: 'Ranked 2nd: involves 3 phones and links two people who say they barely know each other.',
    follow_ups: ['Where did the missing money end up?', 'What was the $4,500 transfer for?'],
  },
  {
    sid: 'S5',
    headline: "Paul's and Cara's phones met four times with no contact on record",
    why: 'People who meet repeatedly but never text or call may be using another channel. This contradicts "barely know each other".',
    rank: 'Ranked 3rd: directly contradicts the stated account in the case summary.',
    follow_ups: ['Do Paul and Cara know each other?', 'What other channels could they have used?'],
  },
  {
    sid: 'S1',
    headline: "Texts from Paul are missing from Amy's phone",
    why: 'Only a cross-phone comparison can show this: the texts survive on the sender’s phone, and the receiver’s phone deleted the thread.',
    rank: "Ranked 4th: 2 phones, deletion 3 days later on the audit's evening.",
    follow_ups: ['What did Paul text Amy on 14 April?', 'When did Amy delete the thread?'],
  },
  {
    sid: 'S2',
    headline: "On 14 April, Paul's and Amy's phones were 23 km apart all evening",
    why: "Paul's texts ask Amy to come to Sunset Park, but her phone stays at Northgate Mall. Useful context if either names the other as an alibi.",
    rank: 'Ranked 5th: 2 phones, context for the deleted texts.',
    follow_ups: ['Were Paul and Amy together on the evening of 14 April?'],
  },
]

const ev = (e: Omit<TimelineEvent, 'id'>, i: number): TimelineEvent => ({ id: `tl${i}`, ...e })

export function buildBriefing(): Briefing {
  const items = ITEMS.map((it, i) => ({
    finding: scenarioFinding(it.sid, { id: `b${i + 1}`, section: 'unprompted', brief_item: null }),
    headline: it.headline,
    why_it_matters: it.why,
    rank_reason: it.rank,
    follow_ups: it.follow_ups,
  }))
  const fid = (sid: ScenarioId) => items[ITEMS.findIndex((x) => x.sid === sid)].finding.id

  const raw: Omit<TimelineEvent, 'id'>[] = [
    // S2 + S1, 14 Apr evening
    { owner: 'paul', t: S2.start, end: S2.end, kind: 'location', label: 'Sunset Park', finding_id: fid('S2') },
    { owner: 'amy', t: S2.start, end: S2.end, kind: 'location', label: 'Northgate Mall', finding_id: fid('S2') },
    { owner: 'paul', t: S1.items[0].t, kind: 'message', label: '3 texts to Amy', finding_id: fid('S1') },
    { owner: 'amy', t: S1.deletion_events[0].t, kind: 'deletion', label: 'Deleted thread with Paul', finding_id: fid('S1') },
    // S4
    { owner: 'paul', t: S4.links[0].t, kind: 'transfer', label: '$5,000 → Ken', link_to: 'ken', finding_id: fid('S4b') },
    { owner: 'ken', t: S4.links[1].t, kind: 'transfer', label: '$4,500 → Cara', link_to: 'cara', finding_id: fid('S4b') },
    // S5
    ...S5.occasions.flatMap((o) => [
      { owner: 'paul', t: o.start, end: o.end, kind: 'meeting' as const, label: `Dock Cafe with Cara's phone`, link_to: 'cara', finding_id: fid('S5') },
      { owner: 'cara', t: o.start, end: o.end, kind: 'meeting' as const, label: `Dock Cafe with Paul's phone`, finding_id: fid('S5') },
    ]),
    // S7
    { owner: 'paul', t: S7.trigger!.t, kind: 'trigger', label: 'Audit notice received', finding_id: fid('S7') },
    ...S7.events
      .filter((e) => e.event_type !== 'power_on')
      .map((e) => {
        const on = S7.events.find((x) => x.device_owner === e.device_owner && x.event_type === 'power_on')
        return e.event_type === 'power_off'
          ? { owner: e.device_owner, t: e.t, end: on?.t, kind: 'power_off' as const, label: 'Powered off', finding_id: fid('S7') }
          : { owner: e.device_owner, t: e.t, kind: 'deletion' as const, label: 'Deleted thread', finding_id: fid('S7') }
      }),
    // Not flagged (decoy): Ken's phone off overnight
    { owner: 'ken', t: '2026-04-15T23:10:00-04:00', end: '2026-04-16T07:00:00-04:00', kind: 'power_off', label: 'Powered off overnight (not flagged)' },
  ]

  return {
    generated_from: 'run_sweep() at ingest time, before any brief was written',
    headline: 'Here is what stands out across the four phones.',
    stats: [
      { label: 'Phones', value: '4' },
      { label: 'Rows read', value: '12,874' },
      { label: 'Patterns flagged', value: String(items.length) },
      { label: 'Checked and dismissed', value: '3' },
    ],
    items,
    timeline: raw.map(ev),
    dismissed: [
      { title: "Amy's and Ken's phones at FreshMart together once", why: 'One occasion of 30 minutes. The silent-meetings rule needs at least 2 occasions, so this was not flagged.' },
      { title: 'Paul sent Amy $50 on 16 April, memo "lunch"', why: 'Below the $500 minimum for the money-chain rule, and nothing moved on from Amy afterwards.' },
      { title: "Ken's phone was off overnight on 15 April", why: 'Only one phone. The synchronised-behaviour rule needs at least 3 phones in the same 60-minute window.' },
    ],
  }
}
