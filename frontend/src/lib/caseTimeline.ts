// The case timeline: for each day, in blocks of a few hours, what each examined phone was doing
// (where it was, when it went dark, what it deleted) and every exchange between the people on the board.
// Built from the stays table and the evidence rows; nothing here is typed in.

import type { EvidenceRow, PersonId } from '../api'
import { ALL_GAPS, HOME, NUMBERS, PLACES, ROWS, SCENE, haversine, ts } from '../mock/data'
import { SEGMENTS } from '../mock/segments'

export interface Block {
  id: string
  day: number
  label: string
  start: string
  end: string
  /** The medical examiner's time-of-death window. */
  tod?: boolean
}

const B = (day: number, label: string, h0: number, m0: number, h1: number, m1: number, tod = false): Block => ({
  id: `${day}-${label}`,
  day,
  label,
  start: ts(day, h0, m0),
  end: h1 >= 24 ? ts(day + 1, h1 - 24, m1) : ts(day, h1, m1),
  tod,
})

export const DAYS: { day: number; title: string; blocks: Block[] }[] = [
  ...[13, 14, 15].map((d) => ({ day: d, title: '', blocks: [B(d, 'Morning', 6, 0, 12, 0), B(d, 'Afternoon', 12, 0, 18, 0), B(d, 'Evening', 18, 0, 24, 0)] })),
  {
    day: 16,
    title: 'The day Ravi died',
    blocks: [B(16, 'Morning', 6, 0, 12, 0), B(16, 'Afternoon', 12, 0, 18, 0), B(16, 'Evening', 18, 0, 21, 0), B(16, 'Time of death', 21, 0, 23, 30, true), B(16, 'Late night', 23, 30, 26, 0)],
  },
  { day: 17, title: 'The morning after', blocks: [B(17, 'Morning', 6, 0, 13, 0)] },
]

export interface Stay {
  kind: 'stay' | 'gap'
  start: string
  end: string
  place?: string
  home?: boolean
  scene?: boolean
  /** Metres from the scene when within 2 km (and not the scene itself). */
  near_m?: number
  /** Other examined phones at the same place at the same time (homes excluded). */
  with: PersonId[]
  gap_type?: string
  /** For a gap: the last location fix before the phone went dark. */
  last_fix?: { t: string; place: string; scene_m: number }
  /** Source rows: location fixes for a stay; bounding fixes and power events for a gap. */
  ids: string[]
}

export interface PhoneEvent {
  t: string
  label: string
  serious: boolean
  id: string
}

export interface Exchange {
  t: string
  from: PersonId
  /** A person, or a group name for group chats. */
  to: PersonId | string
  kind: 'call' | 'text' | 'money'
  text: string
  ids: string[]
}

const byNumber = new Map(Object.entries(NUMBERS).map(([p, n]) => [n, p as PersonId]))
const addHours = (iso: string, h: number) => {
  const d = new Date(new Date(iso).getTime() + h * 3600000 - 4 * 3600000)
  return `${d.toISOString().slice(0, 19)}-04:00`
}
const clip = (s: string, a: string, b: string) => (s < a ? a : s > b ? b : s)
const placeOf = (name?: string) => PLACES.find((p) => p.name === name)

/** Location rows for these phones between two times. */
export function locationIds(people: PersonId[], start: string, end: string) {
  return [...ROWS.values()].filter((r) => r.table === 'locations' && people.includes(r.device_owner) && r.timestamp >= start && r.timestamp <= end).map((r) => r.id)
}

/** Where one phone was during a block, merged into stays and gaps. */
export function staysFor(p: PersonId, b: Block, loaded: PersonId[]): Stay[] {
  const segs = SEGMENTS.filter((s) => s.person === p && s.start < b.end && s.end > b.start && s.kind !== 'travel')
  const out: Stay[] = []
  for (const s of segs) {
    const start = clip(s.start, b.start, b.end)
    const end = clip(s.end, b.start, b.end)
    if (start >= end) continue
    if (s.kind === 'gap') {
      const g = ALL_GAPS.find((x) => x.person === p && x.start < s.end && x.end > s.start)
      const r = g ? ROWS.get(g.bounding.before.id) : undefined
      const last_fix = r && s.start >= b.start && r.timestamp >= addHours(b.start, -3) ? { t: r.timestamp, place: r.fields.place_name ? String(r.fields.place_name) : 'in transit', scene_m: haversine(Number(r.fields.lat), Number(r.fields.lon), SCENE.lat, SCENE.lon) } : undefined
      // A switched-off phone: show the device log's off and on times rather than the 10-minute location slots.
      const pw = (g?.power_event_ids ?? []).map((id) => ROWS.get(id)!).filter(Boolean)
      const off = pw.find((r) => r.fields.event_type === 'power_off')
      const on = pw.find((r) => r.fields.event_type === 'power_on')
      const gs = off ? clip(off.timestamp, b.start, b.end) : start
      const ge = on ? clip(on.timestamp, b.start, b.end) : end
      if (gs >= ge) continue
      out.push({ kind: 'gap', start: gs, end: ge, gap_type: s.gap_type, with: [], last_fix, ids: g ? [g.bounding.before.id, ...g.power_event_ids, ...g.activity.map((a) => a.id), g.bounding.after.id] : [] })
      continue
    }
    const last = out[out.length - 1]
    if (last && last.kind === 'stay' && last.place === s.place) {
      last.end = end
      last.ids = locationIds([p, ...last.with], last.start, end)
      continue
    }
    const pl = placeOf(s.place)
    const d = pl ? haversine(pl.lat, pl.lon, SCENE.lat, SCENE.lon) : Infinity
    const home = s.place === HOME[p]
    const withP = home
      ? []
      : loaded.filter((o) => o !== p && SEGMENTS.some((x) => x.person === o && x.kind === 'stay' && x.place === s.place && x.start < end && x.end > start && s.place !== HOME[o]))
    out.push({ kind: 'stay', start, end, place: s.place, home, scene: d < 150, near_m: d >= 150 && d < 2000 ? d : undefined, with: withP, ids: locationIds([p, ...withP], start, end) })
  }
  return out
}

/** Deletions and power events on one phone during a block. */
export function eventsFor(p: PersonId, b: Block): PhoneEvent[] {
  return [...ROWS.values()]
    .filter((r) => r.device_owner === p && r.table === 'device_events' && r.timestamp >= b.start && r.timestamp < b.end)
    .sort((a, c) => a.timestamp.localeCompare(c.timestamp))
    .map((r) => {
      const t = String(r.fields.event_type)
      const detail = String(r.fields.detail ?? '')
      const who = detail.match(/\((\w+)\)/)?.[1]
      const label = t === 'thread_deleted' ? `Deleted ${detail.split(' ')[0]} thread${who ? ` with ${who}` : ''}` : t === 'power_off' ? (/battery/i.test(detail) ? 'Battery died' : 'Switched off') : t === 'power_on' ? 'Switched on' : detail
      return { t: r.timestamp, label, serious: t === 'thread_deleted' || t === 'power_off', id: r.id }
    })
}

/** Calls, texts and payments between people on the board (and their group chats), once each. */
export function exchangesIn(b: Block, loaded: PersonId[]): Exchange[] {
  const seen = new Map<string, Exchange>()
  for (const r of ROWS.values()) {
    if (r.timestamp < b.start || r.timestamp >= b.end || !loaded.includes(r.device_owner)) continue
    if (r.table !== 'calls' && r.table !== 'messages' && r.table !== 'transactions') continue
    const from = byNumber.get(String(r.fields.from))
    if (!from || !loaded.includes(from)) continue
    const group = r.fields.group ? String(r.fields.group) : null
    const to = group ?? byNumber.get(String(r.fields.to))
    if (!to || (!group && !loaded.includes(to as PersonId)) || to === from) continue
    const key = `${r.table}|${r.timestamp.slice(0, 19)}|${r.fields.body ?? r.fields.amount ?? r.fields.duration_s}`
    const prev = seen.get(key)
    if (prev) {
      prev.ids.push(r.id)
      continue
    }
    seen.set(key, { t: r.timestamp, from, to, kind: r.table === 'calls' ? 'call' : r.table === 'transactions' ? 'money' : 'text', text: describe(r), ids: [r.id] })
  }
  return [...seen.values()].sort((a, c) => a.t.localeCompare(c.t))
}

function describe(r: EvidenceRow) {
  const f = r.fields
  if (r.table === 'calls') return f.duration_s ? `call, ${f.duration_s} s` : 'call, not answered'
  if (r.table === 'transactions') return `$${Number(f.amount).toLocaleString()}${f.memo ? ` “${f.memo}”` : ''}`
  return `“${f.body}”`
}
