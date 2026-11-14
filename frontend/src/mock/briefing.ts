// The opening briefing: stage ② triage output, shown on page load before any brief is written.

import type { Briefing, TimelineEvent } from '../api/types'
import { AMY_GAP, G1, KEN_NIGHT, S1, S2, S4, S5, S7, S7_GAPS } from './data'
import { ANCHORS, DISMISSALS, INCIDENTS, SIGNALS } from './signals'

export function buildBriefing(): Briefing {
  const f = (inc: string, k = 1) => `${inc}:f${k}`
  const raw: Omit<TimelineEvent, 'id'>[] = [
    // INC-3: 14 Apr evening
    { owner: 'paul', t: S2.start, end: S2.end, kind: 'location', label: 'Sunset Park', finding_id: f('INC-3', 1) },
    { owner: 'amy', t: S2.start, end: S2.end, kind: 'location', label: 'Northgate Mall', finding_id: f('INC-3', 1) },
    { owner: 'paul', t: S1.items[0].t, kind: 'message', label: '3 texts to Amy', finding_id: f('INC-3', 2) },
    { owner: 'amy', t: S1.deletion_events[0].t, kind: 'deletion', label: 'Deleted thread with Paul', finding_id: f('INC-3', 2) },
    // INC-2: money + Ken's location_off gap
    { owner: 'paul', t: S4.links[0].t, kind: 'transfer', label: '$5,000 → Ken', link_to: 'ken', finding_id: f('INC-2', 1) },
    { owner: 'ken', t: G1.start, end: G1.end, kind: 'gap', gap_type: 'location_off', label: 'No location data while in use', finding_id: f('INC-2', 2) },
    { owner: 'ken', t: S4.links[1].t, kind: 'transfer', label: '$4,500 → Cara', link_to: 'cara', finding_id: f('INC-2', 1) },
    // INC-4
    ...S5.occasions.flatMap((o) => [
      { owner: 'paul', t: o.start, end: o.end, kind: 'meeting' as const, label: "Dock Cafe with Cara's phone", link_to: 'cara', finding_id: f('INC-4') },
      { owner: 'cara', t: o.start, end: o.end, kind: 'meeting' as const, label: "Dock Cafe with Paul's phone", finding_id: f('INC-4') },
    ]),
    // INC-1
    { owner: 'paul', t: S7.trigger!.t, kind: 'trigger', label: 'Audit notice received', finding_id: f('INC-1') },
    ...S7.events.filter((e) => e.event_type === 'thread_deleted').map((e) => ({ owner: e.device_owner, t: e.t, kind: 'deletion' as const, label: 'Deleted thread', finding_id: f('INC-1') })),
    ...S7_GAPS.map((g) => ({ owner: g.person, t: g.start, end: g.end, kind: 'gap' as const, gap_type: g.gap_type, label: 'Powered off, no location data', finding_id: f('INC-1') })),
    // Not raised
    { owner: 'ken', t: KEN_NIGHT.start, end: KEN_NIGHT.end, kind: 'gap', gap_type: 'powered_off', label: 'Off overnight (not raised)' },
    { owner: 'amy', t: AMY_GAP.start, end: AMY_GAP.end, kind: 'gap', gap_type: 'unexplained', label: 'No location data, no activity (not raised)' },
  ]

  return {
    generated_from: 'Sweep and triage on case load, before any brief was written',
    headline: 'Here is what stands out across the four phones.',
    stats: [
      { label: 'Phones', value: '4' },
      { label: 'Signals from the sweep', value: String(SIGNALS.length) },
      { label: 'Incidents after triage', value: String(INCIDENTS.length) },
      { label: 'Checked and dismissed', value: String(DISMISSALS.length) },
    ],
    anchors: ANCHORS,
    incidents: INCIDENTS,
    timeline: raw.map((e, i) => ({ id: `tl${i}`, ...e })),
    dismissed: DISMISSALS,
    signals_total: SIGNALS.length,
    // Discovery is not in the mock yet.
    leads: [],
  }
}
