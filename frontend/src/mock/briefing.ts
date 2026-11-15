// The opening briefing: stage ② triage output, shown as soon as the case-load run finishes.

import type { Briefing, TimelineEvent } from '../api/types'
import { GAMY, GPAUL, HOSTILE, KEN_NIGHT, CARA_GAP, MEET, MISSING, SYNC, SYNC_GAPS, TOD } from './data'
import { LAST } from './derived'
import { ANCHORS, DISMISSALS, INCIDENTS, SIGNALS } from './signals'

export function buildBriefing(): Briefing {
  const f = (inc: string, k = 1) => `${inc}:f${k}`
  const summon = LAST.items.find((i) => i.body?.startsWith("I've seen"))!
  const raw: Omit<TimelineEvent, 'id'>[] = [
    { owner: 'ken', t: HOSTILE.context!.t, kind: 'message', label: 'Text from Ravi ending his job', finding_id: f('INC-5') },
    ...HOSTILE.items.filter((i) => i.score >= HOSTILE.threshold).map((i) => ({ owner: 'ken', t: i.t, kind: 'trigger' as const, label: `Post about Ravi (${i.score.toFixed(2)})`, finding_id: f('INC-5') })),
    ...MEET.occasions.flatMap((o) => [
      { owner: 'paul', t: o.start, end: o.end, kind: 'meeting' as const, label: "With Cara's phone, unnamed spot", link_to: 'cara', finding_id: f('INC-4') },
      { owner: 'cara', t: o.start, end: o.end, kind: 'meeting' as const, label: "With Paul's phone, unnamed spot", finding_id: f('INC-4') },
    ]),
    { owner: 'ravi', t: summon.t, kind: 'message', label: 'Text to Paul: "Pier 9, 9:30"', link_to: 'paul', finding_id: f('INC-1') },
    ...MISSING.items.filter((i) => i.channel === 'message').map((i) => ({ owner: 'ravi', t: i.t, kind: 'message' as const, label: `Text ${i.from === 'ravi' ? 'to' : 'from'} Amy`, finding_id: f('INC-3') })),
    { owner: 'ravi', t: TOD.start, end: TOD.end, kind: 'location', label: 'Time-of-death window', finding_id: f('INC-1', 3) },
    { owner: 'paul', t: GPAUL.start, end: GPAUL.end, kind: 'gap', gap_type: 'powered_off', label: 'Powered off near Pier 9', finding_id: f('INC-1', 2) },
    { owner: 'amy', t: GAMY.start, end: GAMY.end, kind: 'gap', gap_type: 'location_off', label: 'No location data while in use', finding_id: f('INC-3', 2) },
    { owner: 'paul', t: SYNC.trigger!.t, kind: 'trigger', label: 'News alert received', finding_id: f('INC-2') },
    ...SYNC.events.filter((e) => e.event_type === 'thread_deleted').map((e) => ({ owner: e.device_owner, t: e.t, kind: 'deletion' as const, label: e.detail, finding_id: f('INC-2') })),
    ...SYNC_GAPS.map((g) => ({ owner: g.person, t: g.start, end: g.end, kind: 'gap' as const, gap_type: g.gap_type, label: 'Powered off, no location data', finding_id: f('INC-2') })),
    { owner: 'amy', t: MISSING.deletion_events[0].t, kind: 'deletion', label: 'Deleted thread with Ravi', finding_id: f('INC-3') },
    // Not raised
    { owner: 'ken', t: KEN_NIGHT.start, end: KEN_NIGHT.end, kind: 'gap', gap_type: 'powered_off', label: 'Off overnight (not raised)' },
    { owner: 'cara', t: CARA_GAP.start, end: CARA_GAP.end, kind: 'gap', gap_type: 'unexplained', label: 'No location data, no activity (not raised)' },
  ]

  return {
    generated_from: 'Sweep and triage on case load, with the scene and time-of-death window as inputs',
    headline: 'Here is what stands out across the five phones.',
    stats: [
      { label: 'Phones', value: '5' },
      { label: 'Signals from the sweep', value: String(SIGNALS.length) },
      { label: 'Insights after triage', value: String(INCIDENTS.length) },
      { label: 'Checked and dismissed', value: String(DISMISSALS.length) },
    ],
    anchors: ANCHORS,
    incidents: INCIDENTS,
    timeline: raw.map((e, i) => ({ id: `tl${i}`, ...e })).sort((a, b) => a.t.localeCompare(b.t)),
    dismissed: DISMISSALS,
    signals_total: SIGNALS.length,
    // Discovery, the integrity layer and suggested questions are not in the mock yet.
    leads: [],
    integrity_issues: [],
    questions: [],
    case_version: 1,
  }
}

/** Keep only what falls inside the investigator's chosen days (inclusive), and re-rank. */
export function scopeBriefing(b: Briefing, range: [number, number]): Briefing {
  if (range[0] <= 13 && range[1] >= 19) return b
  const lo = `2026-04-${String(range[0]).padStart(2, '0')}T00:00:00`
  const hi = `2026-04-${String(range[1]).padStart(2, '0')}T23:59:59`
  const overlaps = (s: string, e: string) => s.slice(0, 19) <= hi && e.slice(0, 19) >= lo
  const incidents = b.incidents.filter((i) => overlaps(i.start, i.end)).map((i, k) => ({ ...i, rank: k + 1 }))
  const anchors = b.anchors.filter((a) => overlaps(a.start, a.end))
  const timeline = b.timeline.filter((t) => overlaps(t.t, t.end ?? t.t))
  const signals = new Set(incidents.flatMap((i) => i.signal_ids))
  return { ...b, incidents, anchors, timeline, signals_total: Math.min(b.signals_total, signals.size + b.dismissed.filter((d) => d.signal_id).length) }
}
