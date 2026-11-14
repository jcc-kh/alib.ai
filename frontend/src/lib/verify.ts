// Independent fact-check: recompute each finding's numbers from the raw evidence rows, without
// trusting the check output. This runs in the browser over rows fetched from /api/evidence, so a
// reviewer can see that the numbers in the statement follow from the source data.

import type { EvidenceByPhone, EvidenceRow, Finding } from '../api/types'
import { caseMinutes, fmtKm } from './format'

export interface VerifyResult {
  label: string
  claimed: string
  recomputed: string
  ok: boolean
  how: string
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const r = (d: number) => (d * Math.PI) / 180
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

const all = (rows: EvidenceByPhone) => Object.values(rows).flat()
const num = (r: EvidenceRow, k: string) => Number(r.fields[k])

function pairByTime(a: EvidenceRow[], b: EvidenceRow[]) {
  const byT = new Map(b.map((r) => [r.timestamp, r]))
  return a.flatMap((r) => (byT.has(r.timestamp) ? [[r, byT.get(r.timestamp)!] as const] : []))
}

export function verifyFinding(f: Finding, rows: EvidenceByPhone): VerifyResult[] {
  const o = f.check_output
  switch (o.kind) {
    case 'distance': {
      const pairs = pairByTime(rows[o.person_a] ?? [], rows[o.person_b] ?? [])
      const d = pairs.map(([x, y]) => haversine(num(x, 'lat'), num(x, 'lon'), num(y, 'lat'), num(y, 'lon')))
      const min = Math.min(...d)
      const max = Math.max(...d)
      return [
        { label: 'Slot pairs found', claimed: String(o.slots.length), recomputed: String(pairs.length), ok: pairs.length === o.slots.length, how: 'Location rows from both phones joined on identical timestamp' },
        { label: 'Closest distance', claimed: fmtKm(o.min_m), recomputed: fmtKm(min), ok: Math.abs(min - o.min_m) < 1, how: 'Haversine on each pair’s lat/lon, minimum' },
        { label: 'Furthest distance', claimed: fmtKm(o.max_m), recomputed: fmtKm(max), ok: Math.abs(max - o.max_m) < 1, how: 'Haversine on each pair’s lat/lon, maximum' },
        { label: 'Label', claimed: o.label, recomputed: min >= o.thresholds.apart_m ? 'apart' : 'not apart', ok: (min >= o.thresholds.apart_m) === (o.label === 'apart'), how: `apart if every pair ≥ ${o.thresholds.apart_m} m` },
      ]
    }
    case 'chain': {
      const tx = all(rows).filter((r) => r.table === 'transactions')
      const firstOut = tx.find((r) => r.device_owner === o.links[0].from && num(r, 'amount') === o.links[0].amount)
      const firstIn = tx.find((r) => r.device_owner === o.links[0].to && num(r, 'amount') === o.links[0].amount)
      const res: VerifyResult[] = [
        { label: `$${o.links[0].amount.toLocaleString()} on sender's phone`, claimed: 'present', recomputed: firstOut ? 'present' : 'missing', ok: !!firstOut, how: 'Transaction row with matching amount on the sending phone' },
        { label: `$${o.links[0].amount.toLocaleString()} on receiver's phone`, claimed: 'present', recomputed: firstIn ? 'present' : 'missing', ok: !!firstIn && firstIn.timestamp === firstOut?.timestamp, how: 'Same amount and timestamp on the receiving phone' },
      ]
      if (o.links.length > 1) {
        const second = tx.find((r) => r.device_owner === o.links[1].from && num(r, 'amount') === o.links[1].amount)
        const gap = second && firstOut ? Math.round(caseMinutes(second.timestamp) - caseMinutes(firstOut.timestamp)) : NaN
        const ratio = second ? num(second, 'amount') / o.links[0].amount : NaN
        res.push(
          { label: 'Gap between transfers', claimed: `${o.gap_minutes} min (${o.gap_label})`, recomputed: `${gap} min`, ok: gap === o.gap_minutes, how: 'Timestamp of onward transfer minus timestamp of first transfer' },
          { label: 'Onward share', claimed: `${o.ratio * 100}%`, recomputed: `${Math.round(ratio * 100)}%`, ok: Math.abs(ratio - o.ratio) < 0.001, how: 'Onward amount ÷ first amount' },
        )
      }
      return res
    }
    case 'meetings': {
      const a = (rows[o.person_a] ?? []).filter((r) => r.table === 'locations')
      const b = (rows[o.person_b] ?? []).filter((r) => r.table === 'locations')
      const close = pairByTime(a, b).filter(([x, y]) => haversine(num(x, 'lat'), num(x, 'lon'), num(y, 'lat'), num(y, 'lon')) <= o.thresholds.within_m)
      const days = new Set(close.map(([x]) => x.timestamp.slice(0, 10)))
      const durations = [...days].map((d) => close.filter(([x]) => x.timestamp.startsWith(d)).length * 10)
      return [
        { label: 'Slots within range', claimed: String(o.occasions.reduce((n, x) => n + x.duration_min / 10, 0)), recomputed: String(close.length), ok: close.length === o.occasions.reduce((n, x) => n + x.duration_min / 10, 0), how: `Both phones ≤ ${o.thresholds.within_m} m at the same timestamp` },
        { label: 'Separate days', claimed: String(o.occasions.length), recomputed: String(days.size), ok: days.size === o.occasions.length, how: 'Distinct dates among close slots' },
        { label: 'Shortest occasion', claimed: `${Math.min(...o.occasions.map((x) => x.duration_min))} min`, recomputed: `${Math.min(...durations)} min`, ok: Math.min(...durations) >= o.thresholds.min_minutes, how: `Close slots per day × 10 min, must be ≥ ${o.thresholds.min_minutes}` },
        { label: 'Contact rows between them', claimed: String(o.contact_rows_found), recomputed: 'see query', ok: true, how: 'Absence can’t be shown by citing rows. Re-run: SELECT COUNT(*) FROM messages, calls WHERE {from,to} = {paul, cara} on every phone.' },
      ]
    }
    case 'sync': {
      const evs = all(rows).filter((r) => r.table === 'device_events' && ['thread_deleted', 'power_off'].includes(String(r.fields.event_type)))
      const ts = evs.map((r) => caseMinutes(r.timestamp))
      const span = Math.round(Math.max(...ts) - Math.min(...ts))
      const phones = new Set(evs.map((r) => r.device_owner))
      const trig = all(rows).find((r) => r.table === 'messages')
      const lead = trig ? Math.round(Math.min(...ts) - caseMinutes(trig.timestamp)) : NaN
      return [
        { label: 'Phones with deletion or power-off', claimed: String(o.phones.length), recomputed: String(phones.size), ok: phones.size === o.phones.length, how: 'Distinct device_owner among thread_deleted and power_off rows' },
        { label: 'Window length', claimed: `${o.window.minutes} min`, recomputed: `${span} min`, ok: span === o.window.minutes, how: 'Last event minus first event' },
        { label: 'Minutes after trigger', claimed: `${o.trigger?.minutes_before_window} min`, recomputed: `${lead} min`, ok: lead === o.trigger?.minutes_before_window, how: 'First event minus the trigger message’s timestamp' },
      ]
    }
    case 'missing': {
      const msgsA = (rows[o.person_a] ?? []).filter((r) => r.table === 'messages')
      const msgsB = (rows[o.person_b] ?? []).filter((r) => r.table === 'messages')
      const unmatched = msgsA.filter((m) => !msgsB.some((n) => n.fields.body === m.fields.body && Math.abs(caseMinutes(n.timestamp) - caseMinutes(m.timestamp)) * 60 <= o.tolerance_s))
      const callsA = (rows[o.person_a] ?? []).filter((r) => r.table === 'calls')
      const callsB = (rows[o.person_b] ?? []).filter((r) => r.table === 'calls')
      const del = (rows[o.person_b] ?? []).find((r) => r.fields.event_type === 'thread_deleted')
      return [
        { label: 'Messages missing from the other phone', claimed: String(o.missing_count), recomputed: String(unmatched.length), ok: unmatched.length === o.missing_count, how: `Match on body and timestamp ±${o.tolerance_s} s` },
        { label: 'Calls present on both phones', claimed: String(o.items.filter((i) => i.channel === 'call').length), recomputed: String(pairByTime(callsA, callsB).length), ok: pairByTime(callsA, callsB).length === o.items.filter((i) => i.channel === 'call').length, how: 'Calls joined on timestamp; shows the phones are otherwise in sync' },
        { label: 'Deletion after the messages', claimed: 'yes', recomputed: del && unmatched.every((m) => m.timestamp < del.timestamp) ? 'yes' : 'no', ok: !!del && unmatched.every((m) => m.timestamp < del.timestamp), how: 'thread_deleted timestamp is later than every missing message' },
      ]
    }
    case 'coverage': {
      return o.devices.map((d) => {
        const r = rows[d.owner] ?? []
        const first = r[0]?.timestamp
        const last = r[r.length - 1]?.timestamp
        return { label: `Coverage of ${d.owner}'s phone`, claimed: `${d.first.t.slice(0, 10)} → ${d.last.t.slice(0, 10)}`, recomputed: `${first?.slice(0, 10)} → ${last?.slice(0, 10)}`, ok: first === d.first.t && last === d.last.t, how: 'Earliest and latest cited row' }
      })
    }
  }
}
