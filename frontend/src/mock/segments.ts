// The `stays` table: location_timeline() output for every phone, 13–19 April.
// Built from a daily routine per person plus the planted scenarios, then gaps are cut in.
// In the real system this is computed from location rows at ingest.

import type { GapOutput, PersonId, Segment } from '../api/types'
import { ALL_GAPS, ALL_PHONES, GPAUL, GAMY, HOME, RAVI_END, SPOTS, SYNC_GAPS, VICTIM, findPlace, ts } from './data'

type Stay = [number, number, string] // [startMin, endMin, place] in minutes since local midnight
const H = (h: number, m = 0) => h * 60 + m
// The five unnamed spots where Paul's and Cara's phones meet (mock/data.ts MEET).
const [S1, S2, S3, S4, S5] = SPOTS.map((p) => p.name)

function day(person: PersonId, d: number): Stay[] {
  const home = HOME[person]
  const weekend = d >= 18
  if (person === 'ravi') {
    if (d === 16) return [[0, H(8), home], [H(8, 25), H(12), 'Harbor Supply Co.'], [H(12, 30), H(16), 'Pier 9 Warehouse'], [H(16, 25), H(18), 'Harbor Supply Co.'], [H(18, 20), H(21), home], [H(21, 25), 1440, 'Pier 9 Warehouse']]
    if (d === 14) return [[0, H(8), home], [H(8, 25), H(12), 'Harbor Supply Co.'], [H(12, 30), H(17), 'Pier 9 Warehouse'], [H(17, 25), 1440, home]]
    if (d >= 17) return [[0, 1440, 'Pier 9 Warehouse']]
    return [[0, H(8), home], [H(8, 25), H(12), 'Harbor Supply Co.'], [H(12, 30), H(16), 'Pier 9 Warehouse'], [H(16, 25), H(18, 30), 'Harbor Supply Co.'], [H(18, 50), 1440, home]]
  }
  if (person === 'paul') {
    if (d === 13) return [[0, H(7, 10), home], [H(7, 30), H(7, 50), S1], [H(8, 10), H(17, 30), 'Harbor Supply Co.'], [H(17, 50), 1440, home]]
    if (d === 14) return [[0, H(7, 40), home], [H(8), H(13, 40), 'Harbor Supply Co.'], [H(14), H(16), 'Pier 9 Warehouse'], [H(16, 20), H(17, 30), 'Harbor Supply Co.'], [H(18), H(18, 20), S2], [H(18, 45), 1440, home]]
    if (d === 15) return [[0, H(7, 40), home], [H(8), H(12, 20), 'Harbor Supply Co.'], [H(12, 40), H(13), S3], [H(13, 20), H(17, 30), 'Harbor Supply Co.'], [H(17, 50), 1440, home]]
    if (d === 16) return [[0, H(7, 40), home], [H(8), H(12, 15), 'Harbor Supply Co.'], [H(12, 30), H(12, 50), S4], [H(13, 10), H(17, 30), 'Harbor Supply Co.'], [H(17, 50), H(20, 45), home], [H(21, 10), H(21, 20), 'Harbor Rd lot'], [H(23, 30), 1440, home]]
    if (d === 17) return [[0, H(7, 40), home], [H(8), H(17, 30), 'Harbor Supply Co.'], [H(17, 50), 1440, home]]
    if (d === 18) return [[0, H(8, 40), home], [H(9), H(9, 20), S5], [H(9, 45), 1440, home]]
    return [[0, H(10), home], [H(10, 20), H(11, 30), 'Sunset Park'], [H(11, 50), 1440, home]]
  }
  if (person === 'amy') {
    if (weekend) return d === 18 ? [[0, H(10), home], [H(10, 20), H(12), 'Northgate Mall'], [H(12, 20), 1440, home]] : [[0, 1440, home]]
    if (d === 15) return [[0, H(8, 50), home], [H(9, 10), H(17), 'Northgate Mall'], [H(17, 20), H(18), 'FreshMart'], [H(18, 20), 1440, home]]
    if (d === 16) return [[0, H(8, 50), home], [H(9, 10), H(17, 30), 'Northgate Mall'], [H(17, 50), 1440, home]]
    return [[0, H(8, 50), home], [H(9, 10), H(17, 30), 'Northgate Mall'], [H(17, 50), 1440, home]]
  }
  if (person === 'ken') {
    if (d === 13) return [[0, H(7), home], [H(7, 25), H(16, 30), 'Pier 9 Warehouse'], [H(16, 55), H(18, 30), 'Riverside Gym'], [H(18, 50), 1440, home]]
    if (d === 14) return [[0, H(7), home], [H(7, 25), H(16, 20), 'Pier 9 Warehouse'], [H(16, 45), 1440, home]]
    if (d === 15) return [[0, H(10), home], [H(10, 20), H(12), 'Riverside Gym'], [H(12, 20), H(17), home], [H(17, 20), H(18), 'FreshMart'], [H(18, 20), 1440, home]]
    if (d === 16) return [[0, H(19, 50), home], [H(20, 10), H(21, 50), 'Riverside Gym'], [H(22, 10), 1440, home]]
    if (weekend) return [[0, H(10), home], [H(10, 20), H(12), 'Riverside Gym'], [H(12, 20), 1440, home]]
    return [[0, 1440, home]]
  }
  // cara
  if (d === 13) return [[0, H(7, 5), home], [H(7, 30), H(7, 50), S1], [H(8, 10), H(9), home], [H(9, 20), H(12), 'Pier 9 Warehouse'], [H(12, 15), 1440, home]]
  if (d === 14) return [[0, H(17, 25), home], [H(18), H(18, 20), S2], [H(18, 50), 1440, home]]
  if (d === 15) return [[0, H(12, 15), home], [H(12, 40), H(13), S3], [H(13, 30), H(15, 10), 'Pier 9 Warehouse'], [H(15, 25), 1440, home]]
  if (d === 16) return [[0, H(9, 40), home], [H(10), H(11, 30), 'Pier 9 Warehouse'], [H(11, 50), H(12, 15), home], [H(12, 30), H(12, 50), S4], [H(13, 5), 1440, home]]
  if (d === 18) return [[0, H(8, 40), home], [H(9), H(9, 20), S5], [H(9, 40), 1440, home]]
  return [[0, 1440, home]]
}

const iso = (d: number, m: number) => (m >= 1440 ? ts(d + 1, 0, 0) : ts(d, Math.floor(m / 60), m % 60))
export const absMin = (isoT: string) => {
  const dd = Number(isoT.slice(8, 10))
  return (dd - 13) * 1440 + Number(isoT.slice(11, 13)) * 60 + Number(isoT.slice(14, 16))
}
const fromAbs = (m: number) => iso(13 + Math.floor(m / 1440), m % 1440)

interface Raw {
  kind: Segment['kind']
  s: number
  e: number
  place?: string
  from?: string
  to?: string
  gap?: GapOutput
}

function build(person: PersonId): Raw[] {
  const out: Raw[] = []
  for (let d = 13; d <= 19; d++) {
    const stays = day(person, d)
    stays.forEach(([s, e, place], i) => {
      const base = (d - 13) * 1440
      const last = out[out.length - 1]
      // merge midnight-spanning stays at the same place
      if (last && last.kind === 'stay' && last.place === place && last.e === base + s) last.e = base + e
      else out.push({ kind: 'stay', s: base + s, e: base + e, place })
      const next = stays[i + 1]
      if (next && next[0] > e) out.push({ kind: 'travel', s: base + e, e: base + next[0], from: place, to: next[2] })
    })
  }
  // cut gaps
  let segs = out
  for (const g of ALL_GAPS.filter((x) => x.person === person)) {
    const gs = absMin(g.start) - 10
    const ge = absMin(g.end) + 10
    const next: Raw[] = []
    for (const r of segs) {
      if (r.e <= gs || r.s >= ge) next.push(r)
      else {
        if (r.s < gs) next.push({ ...r, e: gs })
        if (r.e > ge) next.push({ ...r, s: ge })
      }
    }
    next.push({ kind: 'gap', s: gs, e: ge, gap: g })
    segs = next.sort((a, b) => a.s - b.s)
  }
  // The victim's phone has no data after its battery ran out.
  if (person === VICTIM) {
    const end = absMin(RAVI_END)
    segs = segs.filter((r) => r.s < end).map((r) => ({ ...r, e: Math.min(r.e, end) }))
  }
  return segs.filter((r) => r.e > r.s)
}

const FINDING_OF_GAP = new Map<GapOutput, string>([
  [GPAUL, 'INC-1:f1'],
  [GAMY, 'INC-9:f1'],
  [SYNC_GAPS[0], 'INC-2:f1'],
  [SYNC_GAPS[1], 'INC-2:f1'],
])

export const SEGMENTS: Segment[] = ALL_PHONES.flatMap((person) =>
  build(person).map((r, i) => ({
    segment_id: `${person}:seg:${String(i + 1).padStart(3, '0')}`,
    person,
    kind: r.kind,
    start: fromAbs(r.s),
    end: fromAbs(r.e),
    place: r.place,
    from: r.from,
    to: r.to,
    gap_type: r.gap?.gap_type,
    raised: r.gap?.raised,
    finding_id: r.gap ? FINDING_OF_GAP.get(r.gap) : undefined,
  })),
)

/** Gap outputs by segment, for the timeline's side panel. */
export const GAP_OF = new Map<string, GapOutput>()
for (const person of ALL_PHONES) {
  const gaps = ALL_GAPS.filter((x) => x.person === person)
  for (const seg of SEGMENTS.filter((x) => x.person === person && x.kind === 'gap')) {
    const g = gaps.find((x) => Math.abs(absMin(x.start) - 10 - absMin(seg.start)) < 1)
    if (g) GAP_OF.set(seg.segment_id, g)
  }
}

export const placeCoords = (name?: string) => findPlace(name)
