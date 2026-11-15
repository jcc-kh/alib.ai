// The synthetic case's answer key: what was planted and what was planted as a decoy. The scorecard
// grades the sweep against it. In the real system this file comes from the synthetic-data generator,
// never from the pipeline being graded.

import type { Briefing } from '../api/types'
import { SIGNAL_OF, type ScenarioId } from './findings'
import { DISMISSALS } from './signals'

export const PLANTS: { sid: ScenarioId; label: string }[] = [
  { sid: 'LAST', label: "Victim's text naming Pier 9, 9:30" },
  { sid: 'GPAUL', label: "Paul's phone off near the scene" },
  { sid: 'PRESENCE', label: 'Who was where in the window' },
  { sid: 'MISSING', label: 'Ravi–Amy texts deleted from Amy' },
  { sid: 'GAMY', label: "Amy's location off while in use" },
  { sid: 'SYNC', label: 'Threads deleted after the news' },
  { sid: 'MEET', label: 'Paul–Cara: met 5 times, no record links them' },
  { sid: 'HOSTILE', label: "Ken's hostile posts" },
  { sid: 'SPACE', label: 'Scene inside routine areas' },
]

/** Decoys look like findings but have ordinary explanations; raising one is a false positive. */
export const DECOYS: { label: string; signal_id: string | null; title: string }[] = [
  { label: "Ken's phone off overnight", signal_id: 'sig_13', title: "Ken's phone off overnight, 14→15 April" },
  { label: "Cara's 50-min gap, no activity", signal_id: 'sig_14', title: "Cara's phone: no location data for 50 min on 19 April" },
  { label: 'Amy & Ken at FreshMart once', signal_id: null, title: "Amy's and Ken's phones at FreshMart together once" },
  { label: 'Paul → Amy $50 "lunch"', signal_id: null, title: 'Paul sent Amy $50 on 16 April, memo "lunch"' },
  { label: 'Amy: "Done being lied to."', signal_id: null, title: 'Amy posted "Done being lied to." at 20:33 on 16 April' },
]

export interface Scorecard {
  plants: { sid: ScenarioId; label: string; recovered: boolean; incident?: string }[]
  decoys: { label: string; raised: boolean; dismissed: boolean }[]
  /** Insights that no plant explains. */
  unexplained: string[]
}

export function scorecard(b: Pick<Briefing, 'incidents'>): Scorecard {
  const raisedSignals = new Set(b.incidents.flatMap((i) => i.signal_ids))
  // A plant counts as recovered only if its own signal ended up inside a raised insight.
  const plants = PLANTS.map((p) => {
    const inc = b.incidents.find((i) => SIGNAL_OF[p.sid].some((s) => i.signal_ids.includes(s)))
    return { sid: p.sid, label: p.label, recovered: !!inc, incident: inc?.incident_id }
  })
  const decoys = DECOYS.map((d) => ({ label: d.label, raised: d.signal_id ? raisedSignals.has(d.signal_id) : false, dismissed: DISMISSALS.some((x) => x.title === d.title) }))
  const explained = new Set(plants.map((p) => p.incident))
  return { plants, decoys, unexplained: b.incidents.filter((i) => !explained.has(i.incident_id)).map((i) => i.incident_id) }
}
