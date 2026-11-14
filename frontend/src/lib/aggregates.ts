// Chart aggregates over the evidence rows. Each function maps 1:1 to a future stats endpoint
// (GET /api/stats/<name>), so the dashboard never contains hand-typed numbers.

import type { EvidenceRow, EvidenceTable, PersonId } from '../api/types'
import { NUMBERS, PEOPLE, ROWS, haversine } from '../mock/data'
import { SEGMENTS } from '../mock/segments'
import { caseMinutes } from './format'

export const CASE_PEOPLE: PersonId[] = ['paul', 'amy', 'ken', 'cara']
const NUM_TO_PERSON = new Map(Object.entries(NUMBERS).map(([p, n]) => [n, p as PersonId]))
const rows = () => [...ROWS.values()]
const hourOf = (r: EvidenceRow) => Math.floor(caseMinutes(r.timestamp) / 60)

/** Count of rows per hour (168 hours from 13 Apr 00:00) for one phone. */
export function hourlyActivity(person: PersonId, tables: EvidenceTable[] = ['messages', 'calls']) {
  const out = new Array(168).fill(0)
  for (const r of rows()) if (r.device_owner === person && tables.includes(r.table)) {
    const h = hourOf(r)
    if (h >= 0 && h < 168) out[h]++
  }
  return out as number[]
}

/** Day × hour matrix (7 × 24) for one phone. */
export function activityHeatmap(person: PersonId, tables: EvidenceTable[] = ['messages', 'calls']) {
  const h = hourlyActivity(person, tables)
  return Array.from({ length: 7 }, (_, d) => h.slice(d * 24, d * 24 + 24))
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

const counterpart = (r: EvidenceRow): PersonId | 'other' | null => {
  const from = String(r.fields.from ?? '')
  const to = String(r.fields.to ?? '')
  const other = r.fields.direction === 'out' ? to : from
  return NUM_TO_PERSON.get(other) ?? (other ? 'other' : null)
}

/** Contacts between case phones per channel, de-duplicated across both copies of a row. */
export function contactMatrix() {
  const seen = new Set<string>()
  const key = (a: string, b: string) => [a, b].sort().join('|')
  const m: Record<string, { messages: number; calls: number; transfers: number; deleted: boolean }> = {}
  const cell = (a: string, b: string) => (m[key(a, b)] ??= { messages: 0, calls: 0, transfers: 0, deleted: false })
  const others: Record<PersonId, { messages: number; calls: number }> = { paul: { messages: 0, calls: 0 }, amy: { messages: 0, calls: 0 }, ken: { messages: 0, calls: 0 }, cara: { messages: 0, calls: 0 } }
  for (const r of rows()) {
    if (r.table === 'messages' || r.table === 'calls') {
      const cp = counterpart(r)
      if (cp === 'other') others[r.device_owner][r.table]++
      else if (cp) {
        const id = `${r.table}|${r.fields.from}|${r.fields.to}|${r.timestamp}`
        if (!seen.has(id)) {
          seen.add(id)
          cell(r.device_owner, cp)[r.table]++
        }
      }
    }
    if (r.table === 'transactions') {
      const to = NUM_TO_PERSON.get(String(r.fields.to))
      const from = NUM_TO_PERSON.get(String(r.fields.from))
      if (to && from) {
        const id = `${from}|${to}|${r.timestamp}`
        if (!seen.has(id)) {
          seen.add(id)
          cell(from, to).transfers++
        }
      }
    }
    if (r.table === 'device_events' && r.fields.event_type === 'thread_deleted') {
      const cp = CASE_PEOPLE.find((p) => String(r.fields.detail ?? r.fields.counterpart ?? '').includes(NUMBERS[p]))
      if (cp) cell(r.device_owner, cp).deleted = true
    }
  }
  return { pairs: m, others, key }
}

/** Money flows for a Sankey: case-person transfers plus card spend grouped per person. */
export function moneyFlows() {
  const seen = new Set<string>()
  const links: { source: string; target: string; value: number; label: string }[] = []
  const spend: Record<string, number> = {}
  for (const r of rows()) {
    if (r.table !== 'transactions') continue
    const amount = Number(r.fields.amount)
    const to = String(r.fields.to)
    if (to.startsWith('merchant:')) {
      spend[r.device_owner] = (spend[r.device_owner] ?? 0) + amount
      continue
    }
    const from = NUM_TO_PERSON.get(String(r.fields.from))
    const tp = NUM_TO_PERSON.get(to)
    if (!from || !tp) continue
    const id = `${from}|${tp}|${amount}|${r.timestamp}`
    if (seen.has(id)) continue
    seen.add(id)
    links.push({ source: from, target: tp, value: amount, label: String(r.fields.memo || 'no memo') })
  }
  for (const [p, v] of Object.entries(spend)) links.push({ source: p, target: 'Card spend', value: Math.round(v * 100) / 100, label: 'everyday purchases' })
  return links
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
    const rec = (out[s.place!] ??= { paul: 0, amy: 0, ken: 0, cara: 0 })
    rec[s.person] += b - a
  }
  return out
}

/** Transaction amounts (everyday card spend) for a distribution chart. */
export function spendAmounts() {
  return rows()
    .filter((r) => r.table === 'transactions' && String(r.fields.to).startsWith('merchant:'))
    .map((r) => ({ person: r.device_owner, amount: Number(r.fields.amount), merchant: String(r.fields.to).slice(9) }))
}

export const personLabel = (p: PersonId) => PEOPLE.find((x) => x.person_id === p)?.name ?? p
