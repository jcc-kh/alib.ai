// The `stays` table: location_timeline() output for every phone, 13–19 April.
// Built from a daily routine per person plus the planted scenarios, then gaps are cut in.
// In the real system this is computed from location rows at ingest.

import type { GapOutput, PersonId, Segment } from '../api/types'
import { AMY_GAP, G1, KEN_NIGHT, PLACES, S7_GAPS, ts } from './data'

type Stay = [number, number, string] // [startMin, endMin, place] in minutes since local midnight

const HOME: Record<PersonId, string> = { paul: 'Tan residence', amy: 'Lim residence', ken: 'Ong residence', cara: 'Diaz residence' }
const TRAVEL = 20

function day(person: PersonId, d: number): Stay[] {
  const home = HOME[person]
  const weekend = d >= 18
  if (person === 'paul') {
    if (d === 13) return [[0, 470, home], [490, 540, 'Dock Cafe'], [555, 1050, 'Harbor Supply Co.'], [1070, 1440, home]]
    if (d === 14) return [[0, 460, home], [480, 1050, 'Harbor Supply Co.'], [1080, 1260, 'Sunset Park'], [1290, 1440, home]]
    if (d === 15) return [[0, 450, home], [470, 510, 'Dock Cafe'], [530, 1050, 'Harbor Supply Co.'], [1070, 1440, home]]
    if (d === 16) return [[0, 460, home], [480, 735, 'Harbor Supply Co.'], [750, 800, 'Dock Cafe'], [815, 1050, 'Harbor Supply Co.'], [1070, 1440, home]]
    if (d === 17) return [[0, 460, home], [480, 1050, 'Harbor Supply Co.'], [1070, 1440, home]]
    if (d === 18) return [[0, 520, home], [540, 600, 'Dock Cafe'], [620, 1440, home]]
    return [[0, 580, home], [600, 690, 'Riverside Gym'], [710, 1440, home]]
  }
  if (person === 'amy') {
    if (weekend) return d === 18 ? [[0, 580, home], [600, 690, 'Riverside Gym'], [710, 1440, home]] : [[0, 1440, home]]
    if (d === 14) return [[0, 530, home], [550, 1260, 'Northgate Mall'], [1280, 1440, home]]
    if (d === 16) return [[0, 530, home], [550, 1030, 'Northgate Mall'], [1050, 1080, 'FreshMart'], [1100, 1440, home]]
    return [[0, 530, home], [550, 1050, 'Northgate Mall'], [1070, 1440, home]]
  }
  if (person === 'ken') {
    if (d === 16) return [[0, 520, home], [540, 720, 'Riverside Gym'], [740, 1030, home], [1050, 1080, 'FreshMart'], [1100, 1440, home]]
    if (weekend) return [[0, 1440, home]]
    return [[0, 520, home], [540, 720, 'Riverside Gym'], [740, 1440, home]]
  }
  // cara
  if (d === 13) return [[0, 470, home], [490, 540, 'Dock Cafe'], [560, 1020, 'Pier 9 Warehouse'], [1040, 1440, home]]
  if (d === 15) return [[0, 450, home], [470, 510, 'Dock Cafe'], [530, 1020, 'Pier 9 Warehouse'], [1040, 1440, home]]
  if (d === 16) return [[0, 470, home], [490, 735, 'Pier 9 Warehouse'], [750, 800, 'Dock Cafe'], [815, 1020, 'Pier 9 Warehouse'], [1040, 1440, home]]
  if (d === 17) return [[0, 470, home], [490, 1020, 'Pier 9 Warehouse'], [1040, 1440, home]]
  if (d === 18) return [[0, 520, home], [540, 600, 'Dock Cafe'], [620, 1440, home]]
  if (d === 19) return [[0, 1440, home]]
  return [[0, 470, home], [490, 1020, 'Pier 9 Warehouse'], [1040, 1440, home]]
}

const iso = (d: number, m: number) => (m >= 1440 ? ts(d + 1, 0, 0) : ts(d, Math.floor(m / 60), m % 60))
const abs = (isoT: string) => {
  const day = Number(isoT.slice(8, 10))
  return (day - 13) * 1440 + Number(isoT.slice(11, 13)) * 60 + Number(isoT.slice(14, 16))
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
  const gaps = [G1, AMY_GAP, KEN_NIGHT, ...S7_GAPS].filter((g) => g.person === person)
  let segs = out
  for (const g of gaps) {
    const gs = abs(g.start) - 10
    const ge = abs(g.end) + 10
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
  return segs.filter((r) => r.e > r.s)
}

export const SEGMENTS: Segment[] = (['paul', 'amy', 'ken', 'cara'] as PersonId[]).flatMap((person) =>
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
    finding_id: r.gap === G1 ? 'INC-2:f2' : r.gap && S7_GAPS.includes(r.gap) ? 'INC-1:f1' : undefined,
  })),
)

/** Gap outputs by segment, for the timeline's side panel. */
export const GAP_OF = new Map<string, GapOutput>()
for (const person of ['paul', 'amy', 'ken', 'cara'] as PersonId[]) {
  const gaps = [G1, AMY_GAP, KEN_NIGHT, ...S7_GAPS].filter((g) => g.person === person)
  for (const seg of SEGMENTS.filter((x) => x.person === person && x.kind === 'gap')) {
    const g = gaps.find((x) => Math.abs(abs(x.start) - 10 - abs(seg.start)) < 1)
    if (g) GAP_OF.set(seg.segment_id, g)
  }
}

export const placeCoords = (name?: string) => PLACES.find((p) => p.name === name)
