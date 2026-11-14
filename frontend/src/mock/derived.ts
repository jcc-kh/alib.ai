// Check outputs that can only be computed once every row exists (planted + background):
// presence_window(), activity_space(), last_contacts() and contact_graph(). Each is a pure function of
// the rows, as the real checks would be. Imported after background.ts so all rows are in place.

import './background'
import type { EvidenceRow, Graph, GraphEdge, LastContactsOutput, PersonId, PresenceOutput, PresenceStatus, SpaceOutput } from '../api/types'
import { ALL_GAPS, ALL_PHONES, HOME, MEET, NUMBERS, PEOPLE, RAVI_END, ROWS, SCENE, TOD, VICTIM, FRESHMART_IDS, addMin, haversine, place, ts } from './data'
import { SEGMENTS, absMin } from './segments'

const rows = () => [...ROWS.values()]
const locs = (p: PersonId) => rows().filter((r) => r.device_owner === p && r.table === 'locations').sort((a, b) => a.timestamp.localeCompare(b.timestamp))
const ll = (r: EvidenceRow) => [Number(r.fields.lat), Number(r.fields.lon)] as const
const NUM_TO_PERSON = new Map(Object.entries(NUMBERS).map(([p, n]) => [n, p as PersonId]))

// =====================================================================
// presence_window(): every phone, every 10-minute slot of the time-of-death window
// =====================================================================
export const PRESENCE_THRESHOLDS = { scene_m: 150, near_m: 2000, slot_min: 10 }
function presence(): PresenceOutput {
  const slots: string[] = []
  for (let t = TOD.start; t <= TOD.end; t = addMin(t, PRESENCE_THRESHOLDS.slot_min)) slots.push(t)
  return {
    kind: 'presence',
    scene: SCENE,
    window: { ...TOD },
    thresholds: PRESENCE_THRESHOLDS,
    phones: ALL_PHONES.map((person) => {
      const byT = new Map(locs(person).map((r) => [r.timestamp, r]))
      const s = slots.map((t) => {
        const r = byT.get(t)
        if (!r) {
          const g = ALL_GAPS.find((x) => x.person === person && t >= x.start && t <= x.end)
          return { t, status: 'no_data' as PresenceStatus, distance_m: null, row_id: null, gap_type: g?.gap_type }
        }
        const d = Math.round(haversine(...ll(r), SCENE.lat, SCENE.lon))
        const status: PresenceStatus = d <= PRESENCE_THRESHOLDS.scene_m ? 'scene' : d <= PRESENCE_THRESHOLDS.near_m ? 'near' : 'away'
        return { t, status, distance_m: d, row_id: r.id }
      })
      // Closest approach also looks at fixes just before the window (a phone that went dark on the way).
      const around = locs(person).filter((r) => r.timestamp >= addMin(TOD.start, -30) && r.timestamp <= TOD.end)
      const withD = around.map((r) => ({ r, d: Math.round(haversine(...ll(r), SCENE.lat, SCENE.lon)) })).sort((a, b) => a.d - b.d)
      const counts = { scene: 0, near: 0, away: 0, no_data: 0 } as Record<PresenceStatus, number>
      for (const x of s) counts[x.status]++
      return { person, slots: s, closest_m: withD[0]?.d ?? null, closest_t: withD[0]?.r.timestamp ?? null, counts }
    }),
  }
}
export const PRESENCE = presence()

// =====================================================================
// activity_space(): anchor point (home) + radius out to the farthest routine place
// =====================================================================
export const SPACE_RULE = { min_days: 2, buffer_m: 500 }
function circleOverlapShare(r1: number, r2: number, d: number) {
  // Share of circle 1's area that lies inside circle 2.
  if (d >= r1 + r2) return 0
  if (d <= Math.abs(r2 - r1)) return r1 <= r2 ? 1 : (r2 * r2) / (r1 * r1)
  const a1 = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1))
  const a2 = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2))
  const a3 = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2))
  return (a1 + a2 - a3) / (Math.PI * r1 * r1)
}
function space(): SpaceOutput {
  const base = ALL_PHONES.map((person) => {
    const anchor = place(HOME[person])
    const fixes = locs(person)
    // Routine places: stayed at on at least min_days separate days (from the stays table).
    const days = new Map<string, Set<string>>()
    for (const s of SEGMENTS) if (s.person === person && s.kind === 'stay' && s.place !== anchor.name) days.set(s.place!, (days.get(s.place!) ?? new Set()).add(s.start.slice(0, 10)))
    const routine = [...days.entries()]
      .filter(([, d]) => d.size >= SPACE_RULE.min_days)
      .map(([name, d]) => ({ name, days: d.size, distance_m: Math.round(haversine(anchor.lat, anchor.lon, place(name).lat, place(name).lon)) }))
      .sort((a, b) => b.distance_m - a.distance_m)
    const radius = (routine[0]?.distance_m ?? 0) + SPACE_RULE.buffer_m
    const sceneD = Math.round(haversine(anchor.lat, anchor.lon, SCENE.lat, SCENE.lon))
    const near = fixes.filter((r) => haversine(...ll(r), SCENE.lat, SCENE.lon) <= PRESENCE_THRESHOLDS.scene_m)
    const byDay = new Map<string, EvidenceRow[]>()
    for (const r of near) byDay.set(r.timestamp.slice(0, 10), [...(byDay.get(r.timestamp.slice(0, 10)) ?? []), r])
    const mins = new Map<string, number>()
    for (const s of SEGMENTS) if (s.person === person && s.kind === 'stay') mins.set(s.place!, (mins.get(s.place!) ?? 0) + absMin(s.end) - absMin(s.start))
    return {
      person,
      anchor,
      radius_m: radius,
      fixes: fixes.length,
      routine,
      scene_distance_m: sceneD,
      scene_inside: sceneD <= radius,
      overlap_with_victim: 0,
      scene_visits: [...byDay.entries()].map(([date, rs]) => ({ date, fixes: rs.length, first: rs[0].timestamp, last: rs[rs.length - 1].timestamp })),
      top_places: [...mins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, minutes]) => ({ name, minutes })),
    }
  })
  const v = base.find((b) => b.person === VICTIM)!
  for (const b of base) {
    const d = haversine(b.anchor.lat, b.anchor.lon, v.anchor.lat, v.anchor.lon)
    b.overlap_with_victim = b.person === VICTIM ? 1 : Math.round(circleOverlapShare(b.radius_m, v.radius_m, d) * 100) / 100
  }
  return { kind: 'space', scene: SCENE, victim: VICTIM, rule: SPACE_RULE, spaces: base }
}
export const SPACE = space()

// =====================================================================
// last_contacts(): the victim's interactions from 17:00 on the 16th until the phone died
// =====================================================================
function lastContacts(): LastContactsOutput {
  const start = ts(16, 17, 0)
  const deletions = rows().filter((r) => r.table === 'device_events' && r.fields.event_type === 'thread_deleted')
  const items = rows()
    .filter((r) => r.device_owner === VICTIM && (r.table === 'messages' || r.table === 'calls') && r.timestamp >= start && r.timestamp <= RAVI_END)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((r) => {
      const dir = r.fields.direction === 'out' ? 'out' : 'in'
      const other = String(dir === 'out' ? r.fields.to : r.fields.from)
      const cp = NUM_TO_PERSON.get(other) ?? 'other'
      let on: 'present' | 'deleted' | 'n/a' = 'n/a'
      if (cp !== 'other') {
        const mirror = rows().some((x) => x.device_owner === cp && x.table === r.table && x.timestamp === r.timestamp)
        const del = deletions.some((x) => x.device_owner === cp && String(x.fields.detail).includes(NUMBERS[VICTIM]) && x.timestamp > r.timestamp)
        on = mirror ? 'present' : del ? 'deleted' : 'n/a'
      }
      const label = r.table === 'calls' ? r.summary : `${dir === 'out' ? 'Text to' : 'Text from'} ${cp === 'other' ? other : PEOPLE.find((p) => p.person_id === cp)!.name.split(' ')[0]}`
      return { id: r.id, t: r.timestamp, table: r.table as 'messages' | 'calls', direction: dir as 'in' | 'out', counterpart: cp, label, body: r.table === 'messages' ? String(r.fields.body) : undefined, on_counterpart: on }
    })
  const lastOut = [...items].reverse().find((i) => i.direction === 'out')!
  return { kind: 'last_contacts', person: VICTIM, window: { start, end: RAVI_END }, items, last_active: { id: lastOut.id, t: lastOut.t, label: lastOut.label } }
}
export const LAST = lastContacts()

// =====================================================================
// contact_graph(): every tie between case phones, from the rows (copies on both phones counted once)
// =====================================================================
function graph(): Graph {
  const key = (a: PersonId, b: PersonId) => [a, b].sort().join('|')
  type Acc = { ids: string[]; seen: Set<string>; times: string[] }
  const acc = new Map<string, Acc>()
  const add = (a: PersonId, b: PersonId, channel: string, dedupe: string, id: string, t: string) => {
    const k = `${key(a, b)}|${channel}`
    const e = acc.get(k) ?? { ids: [], seen: new Set(), times: [] }
    e.ids.push(id)
    if (!e.seen.has(dedupe)) {
      e.seen.add(dedupe)
      e.times.push(t)
    }
    acc.set(k, e)
  }
  for (const r of rows()) {
    if (r.table === 'calls' || r.table === 'messages' || r.table === 'transactions') {
      const a = NUM_TO_PERSON.get(String(r.fields.from))
      const b = NUM_TO_PERSON.get(String(r.fields.to))
      if (a && b && a !== b) add(a, b, r.table === 'calls' ? 'call' : r.table === 'messages' ? 'message' : 'transfer', `${r.timestamp}|${r.fields.amount ?? r.fields.body ?? ''}`, r.id, r.timestamp)
    }
    if (r.table === 'social_interactions' && r.fields.target) {
      const b = PEOPLE.find((p) => p.handle === r.fields.target)?.person_id
      if (b && b !== r.device_owner) add(r.device_owner, b, Number(r.fields.hostility ?? 0) >= 0.7 ? 'hostile' : 'social', r.id, r.id, r.timestamp)
    }
    if (r.table === 'device_events' && r.fields.event_type === 'thread_deleted') {
      const b = [...NUM_TO_PERSON.entries()].find(([n]) => String(r.fields.detail).includes(n))?.[1]
      if (b) add(r.device_owner, b, 'deleted_thread', r.id, r.id, r.timestamp)
    }
  }
  for (const o of MEET.occasions) add(MEET.person_a, MEET.person_b, 'colocation', o.start, o.row_ids[0], o.start)
  for (const o of MEET.occasions) acc.get(`${key(MEET.person_a, MEET.person_b)}|colocation`)!.ids.push(...o.row_ids.slice(1))
  const edges: GraphEdge[] = []
  const LABEL: Record<string, (n: number) => string> = {
    call: (n) => `${n} call${n === 1 ? '' : 's'}`,
    message: (n) => `${n} text${n === 1 ? '' : 's'}`,
    transfer: (n) => `${n} transfer${n === 1 ? '' : 's'}`,
    social: (n) => `${n} follow${n === 1 ? '' : 's'} or like${n === 1 ? '' : 's'}`,
    hostile: (n) => `${n} hostile post${n === 1 ? '' : 's'}`,
    deleted_thread: (n) => `thread deleted on ${n} phone${n === 1 ? '' : 's'}`,
    colocation: (n) => `together ${n} times, no call or text`,
  }
  for (const [k, e] of acc) {
    const [a, b, channel] = k.split('|') as [PersonId, PersonId, GraphEdge['channel']]
    const times = [...e.times].sort()
    edges.push({ source: a, target: b, channel, label: LABEL[channel](e.seen.size), count: e.seen.size, first: times[0], last: times[times.length - 1], evidence_ids: e.ids })
  }
  // Below-threshold co-location: shown faintly so the investigator sees what was set aside.
  edges.push({ source: 'amy', target: 'ken', channel: 'colocation', label: 'together once at FreshMart (needs 2+)', weak: true, count: 1, first: ROWS.get(FRESHMART_IDS[0])!.timestamp, evidence_ids: FRESHMART_IDS })
  return { nodes: PEOPLE.map((p) => ({ id: p.person_id, label: p.name, color: p.color })), edges, cells: [] }
}
export const GRAPH = graph()
