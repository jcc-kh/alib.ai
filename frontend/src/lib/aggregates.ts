// Chart aggregates over the evidence rows. Each function maps 1:1 to a future stats endpoint
// (GET /api/stats/<name>), so the dashboard never contains hand-typed numbers.

import type { EvidenceRow, EvidenceTable, PersonId } from '../api/types'
import { ALL_PHONES, PEOPLE, ROWS, haversine } from '../mock/data'
import { SEGMENTS } from '../mock/segments'
import { caseMinutes } from './format'

export const CASE_PEOPLE: PersonId[] = ALL_PHONES
const rows = () => [...ROWS.values()]
const hourOf = (r: EvidenceRow) => Math.floor(caseMinutes(r.timestamp) / 60)

/** Count of rows per hour (168 hours from 13 Apr 00:00) for one phone. */
export function hourlyActivity(person: PersonId, tables: EvidenceTable[] = ['messages', 'calls']) {
  const out = new Array(168).fill(0)
  for (const r of rows())
    if (r.device_owner === person && tables.includes(r.table)) {
      const h = hourOf(r)
      if (h >= 0 && h < 168) out[h]++
    }
  return out as number[]
}

/** Rows per table per phone. */
export function dataVolume() {
  const tables: EvidenceTable[] = ['messages', 'calls', 'locations', 'transactions', 'contacts', 'device_events', 'social_interactions']
  return CASE_PEOPLE.map((p) => {
    const c: Record<string, number> = Object.fromEntries(tables.map((t) => [t, 0]))
    for (const r of rows()) if (r.device_owner === p) c[r.table]++
    return { person: p, ...c } as { person: PersonId } & Record<EvidenceTable, number>
  })
}

/** Distance between two phones at every 10-minute slot both phones report. */
export function pairDistanceSeries(a: PersonId, b: PersonId) {
  const byT = new Map<string, EvidenceRow>()
  for (const r of rows()) if (r.table === 'locations' && r.device_owner === b) byT.set(r.timestamp, r)
  const out: { t: string; m: number; d: number }[] = []
  for (const r of rows()) {
    if (r.table !== 'locations' || r.device_owner !== a) continue
    const o = byT.get(r.timestamp)
    if (!o) continue
    out.push({ t: r.timestamp, m: caseMinutes(r.timestamp), d: Math.round(haversine(Number(r.fields.lat), Number(r.fields.lon), Number(o.fields.lat), Number(o.fields.lon))) })
  }
  return out.sort((x, y) => x.m - y.m)
}

/** Minutes spent per place, from the stays table, optionally within a window. */
export function dwellByPlace(window?: [number, number]) {
  const out: Record<string, Record<PersonId, number>> = {}
  for (const s of SEGMENTS) {
    if (s.kind !== 'stay') continue
    let a = caseMinutes(s.start)
    let b = caseMinutes(s.end)
    if (window) {
      a = Math.max(a, window[0])
      b = Math.min(b, window[1])
    }
    if (b <= a) continue
    const rec = (out[s.place!] ??= Object.fromEntries(CASE_PEOPLE.map((p) => [p, 0])) as Record<PersonId, number>)
    rec[s.person] += b - a
  }
  return out
}

/**
 * Pattern of life around one night: activity per hour from 18:00 to 02:00 on `night` against the median
 * of the same hours on the phone's other nights. Activity = messages + calls + social posts + device events.
 */
export const NIGHT_HOURS = [18, 19, 20, 21, 22, 23, 24, 25] // 24, 25 = 00:00, 01:00 next day
export function nightProfile(person: PersonId, night: number) {
  const tables: EvidenceTable[] = ['messages', 'calls', 'social_interactions', 'device_events']
  const h = hourlyActivity(person, tables)
  const at = (d: number, hr: number) => h[(d - 13) * 24 + hr] ?? 0
  const others = [13, 14, 15, 16, 17, 18].filter((d) => d !== night)
  // The victim's phone has no data after the 16th, so its baseline uses the nights before.
  const base = PEOPLE.find((p) => p.person_id === person)?.is_victim ? others.filter((d) => d < night) : others
  return NIGHT_HOURS.map((hr) => {
    const vals = base.map((d) => at(d, hr)).sort((a, b) => a - b)
    const median = vals.length ? vals[Math.floor(vals.length / 2)] : 0
    return { hour: hr % 24, night: at(night, hr), median, max: Math.max(0, ...vals) }
  })
}

/** Social activity per phone per day: posts, and the highest hostility score that day. */
export function socialByDay() {
  return CASE_PEOPLE.map((p) => {
    const days = [13, 14, 15, 16, 17, 18, 19].map((d) => {
      const rs = rows().filter((r) => r.device_owner === p && r.table === 'social_interactions' && Number(r.timestamp.slice(8, 10)) === d && r.fields.kind !== 'like' && r.fields.kind !== 'follow')
      const scores = rs.map((r) => Number(r.fields.hostility ?? 0))
      return { day: d, posts: rs.length, max: scores.length ? Math.max(...scores) : 0, ids: rs.map((r) => r.id) }
    })
    return { person: p, days }
  })
}

/** Every social row with text, newest first, for the motive view. */
export function socialItems() {
  return rows()
    .filter((r) => r.table === 'social_interactions' && r.fields.text)
    .map((r) => ({ id: r.id, person: r.device_owner, t: r.timestamp, kind: String(r.fields.kind), text: String(r.fields.text), score: Number(r.fields.hostility ?? 0), target: r.fields.target ? String(r.fields.target) : null, where: String(r.fields.where ?? '') }))
    .sort((a, b) => b.t.localeCompare(a.t))
}

export const personLabel = (p: PersonId) => PEOPLE.find((x) => x.person_id === p)?.name ?? p
