// Synthetic case data for the mock-up. Everything here is fictional.
// The mock builds the planted-scenario rows plus the check outputs that the real checks
// (backend/checks/) would return over the same rows. The numbers in the check outputs are
// computed from the rows, which mirrors the rule that statements use check output, not model arithmetic.

import type {
  ChainOutput,
  CoverageOutput,
  DistanceOutput,
  EvidenceRow,
  EvidenceTable,
  Graph,
  MeetingsOutput,
  MissingOutput,
  Person,
  PersonId,
  Place,
  SyncOutput,
  TrackPoint,
} from '../api/types'
import { fmtDate } from '../lib/format'

// ---------- helpers ----------

const TZ = '-04:00'
const p2 = (n: number) => String(n).padStart(2, '0')
export const ts = (day: number, h: number, m: number, s = 0) => `2026-04-${p2(day)}T${p2(h)}:${p2(m)}:${p2(s)}${TZ}`

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(42)

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// ---------- the case ----------

export const PLACES: Place[] = [
  { name: 'Harbor Supply Co.', kind: 'work', lat: 41.0, lon: -72.0 },
  { name: 'Dock Cafe', kind: 'cafe', lat: 40.9905, lon: -71.9842 },
  { name: 'Sunset Park', kind: 'park', lat: 40.905, lon: -72.04 },
  { name: 'Northgate Mall', kind: 'mall', lat: 41.11, lon: -71.99 },
  { name: 'FreshMart', kind: 'supermarket', lat: 41.03, lon: -72.03 },
  { name: 'Riverside Gym', kind: 'gym', lat: 41.045, lon: -72.052 },
  { name: 'Tan residence', kind: 'home', lat: 40.975, lon: -72.02 },
  { name: 'Lim residence', kind: 'home', lat: 41.061, lon: -71.996 },
  { name: 'Ong residence', kind: 'home', lat: 41.021, lon: -71.951 },
  { name: 'Diaz residence', kind: 'home', lat: 40.961, lon: -71.94 },
]
const place = (name: string) => PLACES.find((p) => p.name === name)!

export const NUMBERS: Record<PersonId, string> = {
  paul: '+1 555 010 0101',
  amy: '+1 555 010 0202',
  ken: '+1 555 010 0303',
  cara: '+1 555 010 0404',
}
export const COMPANY_NUMBER = '+1 555 010 0900'

export const PEOPLE: Person[] = [
  { person_id: 'paul', name: 'Paul Tan', role: 'Bookkeeper at Harbor Supply Co.', phone_number: NUMBERS.paul, device_id: 'paul-iphone', color: '#2563eb', counts: { messages: 912, calls: 64, locations: 992, transfers: 14, social: 41 } },
  { person_id: 'amy', name: 'Amy Lim', role: "Paul's friend", phone_number: NUMBERS.amy, device_id: 'amy-pixel', color: '#db2777', counts: { messages: 801, calls: 51, locations: 1008, transfers: 9, social: 67 } },
  { person_id: 'ken', name: 'Ken Ong', role: "Paul's friend", phone_number: NUMBERS.ken, device_id: 'ken-galaxy', color: '#d97706', counts: { messages: 655, calls: 47, locations: 944, transfers: 11, social: 22 } },
  { person_id: 'cara', name: 'Cara Diaz', role: 'Supplier to Harbor Supply Co.', phone_number: NUMBERS.cara, device_id: 'cara-iphone', color: '#059669', counts: { messages: 702, calls: 39, locations: 991, transfers: 17, social: 35 } },
]
export const personName = (id: PersonId) => PEOPLE.find((p) => p.person_id === id)?.name.split(' ')[0] ?? id
export const personColor = (id: PersonId) => PEOPLE.find((p) => p.person_id === id)?.color ?? '#64748b'

// ---------- row store ----------

export const ROWS = new Map<string, EvidenceRow>()
const SHORT: Record<EvidenceTable, string> = {
  messages: 'msg',
  calls: 'call',
  locations: 'loc',
  transactions: 'txn',
  device_events: 'evt',
  social_interactions: 'soc',
  contacts: 'ct',
}
// Start counters at different bases so ids look like they come from full-size tables.
const BASES: Record<string, number> = { msg: 3100, call: 210, loc: 1000, txn: 40, evt: 1, soc: 500, ct: 100 }
const counters = new Map<string, number>()
function nextId(owner: PersonId, table: EvidenceTable) {
  const short = SHORT[table]
  const key = `${owner}:${short}`
  const n = (counters.get(key) ?? BASES[short] + Math.floor(rng() * 400)) + 1
  counters.set(key, n)
  return `${owner}:${short}:${String(n).padStart(4, '0')}`
}
function addRow(owner: PersonId, table: EvidenceTable, timestamp: string, summary: string, fields: EvidenceRow['fields']) {
  const id = nextId(owner, table)
  ROWS.set(id, { id, device_owner: owner, table, timestamp, summary, fields })
  return id
}

function locRow(owner: PersonId, t: string, placeName: string, jitterM = 25): TrackPoint {
  const pl = place(placeName)
  const dLat = ((rng() - 0.5) * 2 * jitterM) / 111320
  const dLon = ((rng() - 0.5) * 2 * jitterM) / (111320 * Math.cos((pl.lat * Math.PI) / 180))
  const lat = +(pl.lat + dLat).toFixed(6)
  const lon = +(pl.lon + dLon).toFixed(6)
  const acc = 5 + Math.floor(rng() * 20)
  const id = addRow(owner, 'locations', t, `${placeName} (±${acc} m)`, { lat, lon, accuracy_m: acc, place_name: placeName, source: 'gps' })
  return { id, t, lat, lon }
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// =====================================================================
// S2  Shared alibi: 14 Apr 18:00–21:00, Paul's phone at Sunset Park, Amy's at Northgate Mall
// =====================================================================
const s2Slots: DistanceOutput['slots'] = []
for (let i = 0; i <= 18; i++) {
  const t = ts(14, 18 + Math.floor((i * 10) / 60), (i * 10) % 60)
  const a = locRow('paul', t, 'Sunset Park', 60)
  const b = locRow('amy', t, 'Northgate Mall', 80)
  s2Slots.push({ t, a, b, distance_m: Math.round(haversine(a.lat, a.lon, b.lat, b.lon)) })
}
const s2d = s2Slots.map((s) => s.distance_m)
export const S2: DistanceOutput = {
  kind: 'distance',
  person_a: 'paul',
  person_b: 'amy',
  start: ts(14, 18, 0),
  end: ts(14, 21, 0),
  slots: s2Slots,
  min_m: Math.min(...s2d),
  median_m: Math.round(median(s2d)),
  max_m: Math.max(...s2d),
  label: 'apart',
  thresholds: { together_m: 150, together_share: 0.8, apart_m: 1000 },
}

// =====================================================================
// S1  Deleted message: three texts Paul -> Amy at 18:32 on 14 Apr, absent from Amy's phone
// =====================================================================
const s1Bodies = [
  [ts(14, 18, 32, 4), 'Are you free tonight? Need to talk to you about something.'],
  [ts(14, 18, 32, 51), "Come to Sunset Park, I'm by the boathouse."],
  [ts(14, 18, 34, 12), 'Please come. Better in person than over text.'],
] as const
const s1Items: MissingOutput['items'] = s1Bodies.map(([t, body]) => ({
  t,
  channel: 'message' as const,
  from: 'paul',
  to: 'amy',
  body,
  on_a: addRow('paul', 'messages', t, `To Amy: "${body}"`, { thread_id: 'sms:amy', app: 'SMS', direction: 'out', from: NUMBERS.paul, to: NUMBERS.amy, body }),
  on_b: null,
}))
// Calls are not deleted with a thread, so this call appears on both phones and anchors the alignment.
{
  const t = ts(14, 18, 41)
  s1Items.push({
    t,
    channel: 'call',
    from: 'paul',
    to: 'amy',
    body: 'Call, not answered (0 s)',
    on_a: addRow('paul', 'calls', t, 'Outgoing call to Amy, not answered', { direction: 'out', from: NUMBERS.paul, to: NUMBERS.amy, duration_s: 0, status: 'missed' }),
    on_b: addRow('amy', 'calls', t, 'Missed call from Paul', { direction: 'in', from: NUMBERS.paul, to: NUMBERS.amy, duration_s: 0, status: 'missed' }),
  })
}
{
  const t = ts(15, 9, 12)
  s1Items.push({
    t,
    channel: 'call',
    from: 'amy',
    to: 'paul',
    body: 'Call, answered (3 min 24 s)',
    on_a: addRow('paul', 'calls', t, 'Incoming call from Amy, 204 s', { direction: 'in', from: NUMBERS.amy, to: NUMBERS.paul, duration_s: 204, status: 'answered' }),
    on_b: addRow('amy', 'calls', t, 'Outgoing call to Paul, 204 s', { direction: 'out', from: NUMBERS.amy, to: NUMBERS.paul, duration_s: 204, status: 'answered' }),
  })
}
const amyDeleteT = ts(17, 20, 15)
const amyDeleteId = addRow('amy', 'device_events', amyDeleteT, `thread_deleted: SMS thread with ${NUMBERS.paul}`, { event_type: 'thread_deleted', counterpart: NUMBERS.paul, app: 'SMS' })
export const S1: MissingOutput = {
  kind: 'missing',
  person_a: 'paul',
  person_b: 'amy',
  items: s1Items,
  deletion_events: [{ id: amyDeleteId, device_owner: 'amy', t: amyDeleteT, counterpart: 'paul' }],
  missing_count: s1Items.filter((i) => i.on_a && !i.on_b).length,
  tolerance_s: 2,
}

// =====================================================================
// S4  Money chain: Paul -> Ken $5,000 at 11:05, Ken -> Cara $4,500 at 15:40 on 15 Apr
// =====================================================================
const l1t = ts(15, 11, 5)
const l2t = ts(15, 15, 40)
const l1 = {
  from: 'paul', to: 'ken', amount: 5000, currency: 'USD', t: l1t, memo: '',
  row_ids: [
    addRow('paul', 'transactions', l1t, 'Sent $5,000 to Ken Ong (Swiftpay), no memo', { app: 'Swiftpay', from: NUMBERS.paul, to: NUMBERS.ken, amount: 5000, currency: 'USD', memo: '' }),
    addRow('ken', 'transactions', l1t, 'Received $5,000 from Paul Tan (Swiftpay), no memo', { app: 'Swiftpay', from: NUMBERS.paul, to: NUMBERS.ken, amount: 5000, currency: 'USD', memo: '' }),
  ],
}
const l2 = {
  from: 'ken', to: 'cara', amount: 4500, currency: 'USD', t: l2t, memo: 'materials',
  row_ids: [
    addRow('ken', 'transactions', l2t, 'Sent $4,500 to Cara Diaz (Swiftpay), memo "materials"', { app: 'Swiftpay', from: NUMBERS.ken, to: NUMBERS.cara, amount: 4500, currency: 'USD', memo: 'materials' }),
    addRow('cara', 'transactions', l2t, 'Received $4,500 from Ken Ong (Swiftpay), memo "materials"', { app: 'Swiftpay', from: NUMBERS.ken, to: NUMBERS.cara, amount: 4500, currency: 'USD', memo: 'materials' }),
  ],
}
export const S4: ChainOutput = {
  kind: 'chain',
  links: [l1, l2],
  gap_minutes: 275,
  gap_label: '4 h 35 min',
  ratio: 0.9,
  thresholds: { window_h: 24, ratio_min: 0.8, ratio_max: 1.0, min_amount: 500 },
}
/** Just the first link, for the "Paul sent Ken $5,000" brief item. */
export const S4_FIRST: ChainOutput = { ...S4, links: [l1] }

// =====================================================================
// S5  Silent meetings: Paul's and Cara's phones at Dock Cafe on 13, 15, 16, 18 Apr; no contact anywhere
// =====================================================================
const occasionsDef = [
  { day: 13, h: 8, m: 10, slots: 5 },
  { day: 15, h: 7, m: 50, slots: 4 },
  { day: 16, h: 12, m: 30, slots: 5 },
  { day: 18, h: 9, m: 0, slots: 6 },
]
export const S5: MeetingsOutput = {
  kind: 'meetings',
  person_a: 'paul',
  person_b: 'cara',
  occasions: occasionsDef.map(({ day, h, m, slots }) => {
    const row_ids: string[] = []
    let minD = Infinity
    let first = ''
    let last = ''
    for (let i = 0; i < slots; i++) {
      const mins = h * 60 + m + i * 10
      const t = ts(day, Math.floor(mins / 60), mins % 60)
      const a = locRow('paul', t, 'Dock Cafe', 15)
      const b = locRow('cara', t, 'Dock Cafe', 15)
      minD = Math.min(minD, haversine(a.lat, a.lon, b.lat, b.lon))
      row_ids.push(a.id, b.id)
      if (i === 0) first = t
      last = t
    }
    const pl = place('Dock Cafe')
    return { date: fmtDate(first), place: 'Dock Cafe', start: first, end: last, duration_min: slots * 10, min_distance_m: Math.round(minD), lat: pl.lat, lon: pl.lon, row_ids }
  }),
  contact_rows_found: 0,
  channels_checked: ['messages', 'calls', 'social direct messages'],
  thresholds: { within_m: 100, min_minutes: 20, min_occasions: 2 },
}

// =====================================================================
// S7  Synchronised behaviour on 17 Apr: audit notice 10:00, deletions + power-offs 10:20–11:10
// =====================================================================
const auditT = ts(17, 10, 0)
const auditBody = 'Harbor Supply Co. Finance: an external audit of all supplier payments starts Monday 20 April. Please keep every record as it is.'
const auditId = addRow('paul', 'messages', auditT, `From Harbor Supply Finance: "${auditBody}"`, { thread_id: 'sms:hsc-finance', app: 'SMS', direction: 'in', from: COMPANY_NUMBER, to: NUMBERS.paul, body: auditBody })
const syncDef: [PersonId, 'thread_deleted' | 'power_off' | 'power_on', string, string][] = [
  ['paul', 'thread_deleted', ts(17, 10, 20), `WhatsApp thread with ${NUMBERS.ken} (Ken)`],
  ['paul', 'power_off', ts(17, 10, 25), 'Device powered off'],
  ['ken', 'thread_deleted', ts(17, 10, 40), `WhatsApp thread with ${NUMBERS.paul} (Paul)`],
  ['ken', 'thread_deleted', ts(17, 10, 41), `WhatsApp thread with ${NUMBERS.cara} (Cara)`],
  ['ken', 'power_off', ts(17, 10, 45), 'Device powered off'],
  ['cara', 'thread_deleted', ts(17, 11, 0), `WhatsApp thread with ${NUMBERS.ken} (Ken)`],
  ['cara', 'power_off', ts(17, 11, 10), 'Device powered off'],
  ['paul', 'power_on', ts(17, 13, 5), 'Device powered on'],
  ['ken', 'power_on', ts(17, 13, 30), 'Device powered on'],
  ['cara', 'power_on', ts(17, 14, 0), 'Device powered on'],
]
const syncEvents: SyncOutput['events'] = syncDef.map(([owner, type, t, detail]) => ({
  id: addRow(owner, 'device_events', t, `${type}: ${detail}`, { event_type: type, detail }),
  device_owner: owner,
  event_type: type,
  t,
  detail,
}))
export const S7: SyncOutput = {
  kind: 'sync',
  window: { start: ts(17, 10, 20), end: ts(17, 11, 10), minutes: 50 },
  view: { start: ts(17, 9, 30), end: ts(17, 14, 30) },
  trigger: { id: auditId, device_owner: 'paul', t: auditT, from_label: 'Harbor Supply Finance', body: auditBody, minutes_before_window: 20 },
  events: syncEvents,
  phones: ['paul', 'ken', 'cara'],
  thresholds: { window_min: 60, min_phones: 3 },
}

// =====================================================================
// Coverage rows: first and last location row per phone (used by cannot_tell findings)
// =====================================================================
const homes: Record<PersonId, string> = { paul: 'Tan residence', amy: 'Lim residence', ken: 'Ong residence', cara: 'Diaz residence' }
const coverageDevices = PEOPLE.map((p) => {
  const first = locRow(p.person_id, ts(13, 0, 0), homes[p.person_id])
  const last = locRow(p.person_id, ts(19, 23, 50), homes[p.person_id])
  return { owner: p.person_id, first: { id: first.id, t: first.t }, last: { id: last.id, t: last.t } }
})
export function coverageFor(item: string): CoverageOutput {
  return { kind: 'coverage', item, start: ts(13, 0, 0), end: ts(19, 23, 50), devices: coverageDevices }
}
export const COVERAGE_IDS = coverageDevices.flatMap((d) => [d.first.id, d.last.id])

// =====================================================================
// Relations graph extras (social, decoy co-location) — not findings, but the mapper's raw material
// =====================================================================
const caraLikeId = addRow('cara', 'social_interactions', ts(16, 21, 14), 'Snapline: @cara.diaz liked a post by @paultan_', { platform: 'Snapline', actor: '@cara.diaz', target: '@paultan_', kind: 'like' })
const caraFollowId = addRow('cara', 'social_interactions', ts(13, 7, 2), 'Snapline follow list: @cara.diaz follows @paultan_ (date followed not recorded)', { platform: 'Snapline', actor: '@cara.diaz', target: '@paultan_', kind: 'follow' })
const amyKenMall: string[] = []
for (let i = 0; i < 3; i++) {
  const t = ts(16, 17, 30 + i * 10)
  amyKenMall.push(locRow('amy', t, 'FreshMart', 20).id, locRow('ken', t, 'FreshMart', 20).id)
}
const paulKenCall = addRow('paul', 'calls', ts(14, 12, 3), 'Outgoing call to Ken, 312 s', { direction: 'out', from: NUMBERS.paul, to: NUMBERS.ken, duration_s: 312, status: 'answered' })
const kenPaulCall = addRow('ken', 'calls', ts(14, 12, 3), 'Incoming call from Paul, 312 s', { direction: 'in', from: NUMBERS.paul, to: NUMBERS.ken, duration_s: 312, status: 'answered' })
const lunchIds = [
  addRow('paul', 'transactions', ts(16, 13, 20), 'Sent $50 to Amy Lim (Swiftpay), memo "lunch"', { app: 'Swiftpay', from: NUMBERS.paul, to: NUMBERS.amy, amount: 50, currency: 'USD', memo: 'lunch' }),
  addRow('amy', 'transactions', ts(16, 13, 20), 'Received $50 from Paul Tan (Swiftpay), memo "lunch"', { app: 'Swiftpay', from: NUMBERS.paul, to: NUMBERS.amy, amount: 50, currency: 'USD', memo: 'lunch' }),
]
const ev = (owner: PersonId, type: string) => syncEvents.filter((e) => e.device_owner === owner && e.event_type === type).map((e) => e.id)

export const GRAPH: Graph = {
  nodes: PEOPLE.map((p) => ({ id: p.person_id, label: p.name, color: p.color })),
  edges: [
    { source: 'paul', target: 'amy', channel: 'call', label: '2 calls in the window, on both phones', evidence_ids: s1Items.filter((i) => i.channel === 'call').flatMap((i) => [i.on_a!, i.on_b!]) },
    { source: 'paul', target: 'amy', channel: 'message', label: "3 texts, on Paul's phone only", evidence_ids: s1Items.filter((i) => i.channel === 'message').map((i) => i.on_a!) },
    { source: 'paul', target: 'amy', channel: 'transfer', label: '$50 "lunch"', evidence_ids: lunchIds },
    { source: 'paul', target: 'ken', channel: 'call', label: 'Call on 14 Apr, on both phones', evidence_ids: [paulKenCall, kenPaulCall] },
    { source: 'paul', target: 'ken', channel: 'transfer', label: '$5,000, no memo', evidence_ids: l1.row_ids },
    { source: 'paul', target: 'ken', channel: 'deleted_thread', label: 'Thread deleted on both phones, 17 Apr', evidence_ids: [...ev('paul', 'thread_deleted'), ev('ken', 'thread_deleted')[0]] },
    { source: 'ken', target: 'cara', channel: 'transfer', label: '$4,500 "materials"', evidence_ids: l2.row_ids },
    { source: 'ken', target: 'cara', channel: 'deleted_thread', label: 'Thread deleted on both phones, 17 Apr', evidence_ids: [ev('ken', 'thread_deleted')[1], ...ev('cara', 'thread_deleted')] },
    { source: 'paul', target: 'cara', channel: 'colocation', label: 'Within 100 m at Dock Cafe, 4 occasions', evidence_ids: S5.occasions.flatMap((o) => o.row_ids) },
    { source: 'cara', target: 'paul', channel: 'social', label: "Cara's Snapline account follows and liked Paul's", evidence_ids: [caraFollowId, caraLikeId] },
    { source: 'amy', target: 'ken', channel: 'colocation', label: '1 occasion at FreshMart (below the 2-occasion threshold)', weak: true, evidence_ids: amyKenMall },
  ],
}

export const NEXT_STEPS = [
  'Interview Amy about the evening of 14 April and the SMS thread with Paul that her phone deleted on 17 April.',
  'Interview Paul and Cara separately about the four occasions their phones were together at Dock Cafe.',
  'Ask Ken what the $4,500 Swiftpay transfer to Cara on 15 April, memo "materials", was for.',
  'Request Swiftpay account records for Paul, Ken and Cara for 1 to 30 April.',
  'Request WhatsApp account metadata for the Paul–Ken and Ken–Cara threads deleted on 17 April.',
  'Request Dock Cafe card-payment and CCTV records for 13, 15, 16 and 18 April.',
]

export const ASSUMPTIONS = [
  'Phone data is treated as genuine; spoofing is not assessed.',
  "A phone's location is not proof of where its owner was.",
  'Data covers 13 to 19 April 2026 only.',
]
