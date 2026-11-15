// Synthetic case data for the mock-up: "Death at Pier 9". Everything here is fictional, and the
// portraits are GAN-generated faces of people who do not exist (public/portraits/CREDITS.md).
//
// The mock builds the planted rows plus the check outputs the real checks (backend/checks/) would
// return over the same rows. Numbers in check outputs are computed from rows, never typed in, which
// mirrors the rule that statements use check output, not model arithmetic.
//
// The story the plants encode (what an investigator should be able to find):
//   - Ravi Mehta, owner of Harbor Supply Co., is found dead at the Pier 9 warehouse on 17 Apr at 07:40.
//     The medical examiner puts the time of death between 21:00 and 23:30 on 16 Apr.
//   - At 18:05 Ravi's phone texted Paul: "I've seen the Novak invoices. Pier 9, 9:30 tonight."
//     Paul's phone came within 0.9 km of Pier 9 at 21:10 and was then powered off until 23:38.
//   - Amy (Ravi's estranged partner) argued with Ravi by text that evening; those texts survive only on
//     Ravi's phone. Her phone reported no location 21:40–22:50 while it called Ravi twice.
//   - The hidden link: Paul and Cara have no call, text, saved contact, payment or social tie on any phone,
//     yet their phones spent 20 minutes within 100 m of each other on five days, at five different unnamed
//     roadside spots. No record names the link; it only appears when the two location tracks are compared.
//   - Ken, dismissed by Ravi on 14 Apr, posted hostile comments about him, but his phone was far from Pier 9
//     the whole window. Motive and a shared area are leads, not presence.
//   - After a news alert at 09:05 on 17 Apr, three phones deleted their threads with Ravi within 26 minutes.
//   Decoys: Ken's phone off overnight 14→15 Apr, Cara's 50-min gap on 19 Apr, Amy and Ken at FreshMart once,
//   Paul → Amy $50 "lunch", and Amy's "Done being lied to." post (below the hostility threshold).

import type { GapOutput, GapType, CoverageOutput, EvidenceRow, EvidenceTable, HostilityOutput, MeetingsOutput, MissingOutput, Person, PersonId, Place, SyncOutput, TrackPoint } from '../api/types'
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

export const addMin = (iso: string, m: number) => {
  const d = new Date(new Date(iso).getTime() + m * 60000 - 4 * 3600000)
  return `${d.toISOString().slice(0, 19)}${TZ}`
}
export const minsBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)

// ---------- the case ----------

export const PLACES: Place[] = [
  { name: 'Pier 9 Warehouse', kind: 'work', lat: 40.938, lon: -71.962 },
  { name: 'Harbor Rd lot', kind: 'parking', lat: 40.946, lon: -71.966 },
  { name: 'Harbor Supply Co.', kind: 'work', lat: 41.0, lon: -72.0 },
  { name: 'Dock Cafe', kind: 'cafe', lat: 40.9905, lon: -71.9842 },
  { name: 'Sunset Park', kind: 'park', lat: 40.905, lon: -72.04 },
  { name: 'Northgate Mall', kind: 'mall', lat: 41.11, lon: -71.99 },
  { name: 'FreshMart', kind: 'supermarket', lat: 41.03, lon: -72.03 },
  { name: 'Riverside Gym', kind: 'gym', lat: 41.045, lon: -72.052 },
  { name: 'Mehta residence', kind: 'home', lat: 40.972, lon: -71.978 },
  { name: 'Becker residence', kind: 'home', lat: 40.975, lon: -72.02 },
  { name: 'Brooks residence', kind: 'home', lat: 41.061, lon: -71.996 },
  { name: 'Walsh residence', kind: 'home', lat: 41.021, lon: -71.951 },
  { name: 'Novak residence', kind: 'home', lat: 40.961, lon: -71.94 },
]
/**
 * Points that no map or saved place names: the five spots where Paul's and Cara's phones met. Location rows
 * there carry coordinates only (place_name null), so there is nothing to search for. The stays table labels
 * them by their coordinates. Not part of PLACES, so maps don't mark them.
 */
const spot = (lat: number, lon: number): Place => ({ name: `Unnamed (${lat.toFixed(3)}, ${lon.toFixed(3)})`, kind: 'unnamed', lat, lon })
export const SPOTS: Place[] = [
  spot(40.9835, -71.9605), // fuel station forecourt off Route 25, 2 km from Dock Cafe
  spot(41.097, -71.975), // lay-by on Northgate Rd, 1.9 km from the mall
  spot(40.918, -72.022), // Sunset Park south lot, 2.1 km from the park entrance
  spot(40.952, -71.951), // side street off Harbor Rd, 1.4 km from the lot
  spot(40.94, -71.99), // Shore Rd lay-by, 2.1 km from the lot
]
export const findPlace = (name?: string) => PLACES.find((p) => p.name === name) ?? SPOTS.find((p) => p.name === name)
export const isNamedPlace = (name?: string) => PLACES.some((p) => p.name === name)
export const place = (name: string) => findPlace(name)!
export const SCENE = place('Pier 9 Warehouse')

export const NUMBERS: Record<PersonId, string> = {
  ravi: '+1 555 010 0100',
  paul: '+1 555 010 0101',
  amy: '+1 555 010 0202',
  ken: '+1 555 010 0303',
  cara: '+1 555 010 0404',
}
export const NEWS_SENDER = 'Port Calder News'

const blank = { messages: 0, calls: 0, locations: 0, transfers: 0, social: 0 }
export const PEOPLE: Person[] = [
  { person_id: 'ravi', name: 'Ravi Mehta', role: 'Victim. Owner of Harbor Supply Co.', phone_number: NUMBERS.ravi, device_id: 'ravi-iphone', color: 'var(--p-ravi)', counts: { ...blank }, portrait: '/portraits/ravi.jpg', is_victim: true, handle: '@ravi.mehta' },
  { person_id: 'paul', name: 'Paul Becker', role: 'Bookkeeper at Harbor Supply Co.', phone_number: NUMBERS.paul, device_id: 'paul-iphone', color: 'var(--p-paul)', counts: { ...blank }, portrait: '/portraits/paul.jpg', handle: '@paulbecker' },
  { person_id: 'amy', name: 'Amy Brooks', role: "Ravi's estranged partner", phone_number: NUMBERS.amy, device_id: 'amy-pixel', color: 'var(--p-amy)', counts: { ...blank }, portrait: '/portraits/amy.jpg', handle: '@amybrooks' },
  { person_id: 'ken', name: 'Ken Walsh', role: 'Warehouse lead, dismissed 14 Apr', phone_number: NUMBERS.ken, device_id: 'ken-galaxy', color: 'var(--p-ken)', counts: { ...blank }, portrait: '/portraits/ken.jpg', handle: '@kwalsh_' },
  { person_id: 'cara', name: 'Cara Novak', role: 'Supplier to Harbor Supply Co.', phone_number: NUMBERS.cara, device_id: 'cara-iphone', color: 'var(--p-cara)', counts: { ...blank }, portrait: '/portraits/cara.jpg', handle: '@cara.novak' },
]
export const VICTIM: PersonId = 'ravi'
export const ALL_PHONES: PersonId[] = PEOPLE.map((p) => p.person_id)
/** Everyone except the victim. */
export const POI: PersonId[] = ALL_PHONES.filter((p) => p !== VICTIM)
export const personName = (id: PersonId) => PEOPLE.find((p) => p.person_id === id)?.name.split(' ')[0] ?? id
export const personColor = (id: PersonId) => PEOPLE.find((p) => p.person_id === id)?.color ?? 'var(--ink-3)'
export const personOf = (id: PersonId) => PEOPLE.find((p) => p.person_id === id)!
/** Relationships declared in the case file (from interviews and records), keyed by sorted pair. */
export const RELATIONS: Record<string, string> = {
  'paul|ravi': 'Employer · bookkeeper',
  'amy|ravi': 'Partners, estranged',
  'ken|ravi': 'Employer · dismissed 14 Apr',
  'cara|ravi': 'Supplier',
  'ken|paul': 'Co-workers',
}
export const pairKey = (a: PersonId, b: PersonId) => [a, b].sort().join('|')
export const HOME: Record<PersonId, string> = { ravi: 'Mehta residence', paul: 'Becker residence', amy: 'Brooks residence', ken: 'Walsh residence', cara: 'Novak residence' }

export const TOD = { start: ts(16, 21, 0), end: ts(16, 23, 30) }
export const FOUND_AT = ts(17, 7, 40)

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
// Provenance: where each row lives in the ingested Case Bundle. Line numbers are derived from the
// record number so they are stable; the bundle hash is a fixed placeholder in the mock.
export const BUNDLE = { name: 'pier9-case.zip', sha256: '4b8e2d91c07a3f56e1d2c4a9b7f03e8126aa5d0c3b9e47f1a6d5c2b8e0f9a3d7', tool: 'synthetic-generator 0.2' }
const EXTRACTED_AT: Record<PersonId, string> = {
  ravi: '2026-04-17T15:20:00-04:00',
  paul: '2026-04-21T09:14:00-04:00',
  amy: '2026-04-21T10:02:00-04:00',
  ken: '2026-04-21T11:30:00-04:00',
  cara: '2026-04-21T13:45:00-04:00',
}
const deviceOf = (owner: PersonId) => PEOPLE.find((p) => p.person_id === owner)!.device_id

export function addRow(owner: PersonId, table: EvidenceTable, timestamp: string, summary: string, fields: EvidenceRow['fields']) {
  const id = nextId(owner, table)
  const recordNo = Number(id.split(':')[2])
  const record_id = `${SHORT[table][0]}${recordNo}`
  const raw = JSON.stringify({ record_id, timestamp, ...fields })
  ROWS.set(id, {
    id,
    device_owner: owner,
    table,
    timestamp,
    summary,
    fields,
    provenance: {
      bundle: BUNDLE.name,
      bundle_sha256: BUNDLE.sha256,
      file: `devices/${deviceOf(owner)}/${table}.jsonl`,
      line: recordNo - BASES[SHORT[table]] + 1,
      record_id,
      extraction_tool: BUNDLE.tool,
      extracted_at: EXTRACTED_AT[owner],
      raw,
    },
  })
  return id
}

export function locRow(owner: PersonId, t: string, placeName: string, jitterM = 25): TrackPoint {
  const pl = place(placeName)
  const dLat = ((rng() - 0.5) * 2 * jitterM) / 111320
  const dLon = ((rng() - 0.5) * 2 * jitterM) / (111320 * Math.cos((pl.lat * Math.PI) / 180))
  const lat = +(pl.lat + dLat).toFixed(6)
  const lon = +(pl.lon + dLon).toFixed(6)
  const acc = 5 + Math.floor(rng() * 20)
  const named = isNamedPlace(placeName)
  const id = addRow(owner, 'locations', t, `${named ? placeName : 'Unnamed location'} (±${acc} m)`, { lat, lon, accuracy_m: acc, place_name: named ? placeName : null, source: 'gps' })
  return { id, t, lat, lon }
}

/** A location row at an explicit point (travel fixes for the planted evening). */
function pointRow(owner: PersonId, t: string, lat: number, lon: number, label: string) {
  const acc = 8 + Math.floor(rng() * 12)
  const id = addRow(owner, 'locations', t, `${label} (±${acc} m)`, { lat: +lat.toFixed(6), lon: +lon.toFixed(6), accuracy_m: acc, place_name: label === 'In transit' ? null : label, source: 'gps' })
  return { id, t, lat: +lat.toFixed(6), lon: +lon.toFixed(6) }
}

const msg = (owner: PersonId, t: string, dir: 'in' | 'out', other: PersonId | string, body: string, app = 'SMS', label?: string) => {
  const otherNum = NUMBERS[other] ?? other
  const name = label ?? (NUMBERS[other] ? personName(other) : other)
  return addRow(owner, 'messages', t, `${dir === 'out' ? 'To' : 'From'} ${name}: "${body}"`, {
    thread_id: `${app.toLowerCase()}:${otherNum}`,
    app,
    direction: dir,
    from: dir === 'out' ? NUMBERS[owner] : otherNum,
    to: dir === 'out' ? otherNum : NUMBERS[owner],
    body,
  })
}
const call = (owner: PersonId, t: string, dir: 'in' | 'out', other: PersonId, dur: number) =>
  addRow(owner, 'calls', t, `${dir === 'out' ? 'Outgoing call to' : dur ? 'Incoming call from' : 'Missed call from'} ${personName(other)}${dur ? `, ${dur} s` : dir === 'out' ? ', not answered' : ''}`, {
    direction: dir,
    from: dir === 'out' ? NUMBERS[owner] : NUMBERS[other],
    to: dir === 'out' ? NUMBERS[other] : NUMBERS[owner],
    duration_s: dur,
    status: dur ? 'answered' : 'missed',
  })
/** A call that appears on both phones (calls are not removed when a message thread is deleted). */
const callBoth = (t: string, from: PersonId, to: PersonId, dur: number) => ({ on_from: call(from, t, 'out', to, dur), on_to: call(to, t, 'in', from, dur) })

// =====================================================================
// LAST  The victim's final evening, as recorded on Ravi's phone
// =====================================================================
export const LAST_IDS: Record<string, string> = {}
// 18:05 Ravi → Paul. Paul's phone deleted this SMS thread on 17 Apr (see SYNC), so it lives on Ravi's phone only.
LAST_IDS.summon = msg('ravi', ts(16, 18, 5, 12), 'out', 'paul', "I've seen the Novak invoices. Pier 9, 9:30 tonight. Come alone.")
LAST_IDS.reply = msg('ravi', ts(16, 18, 11, 40), 'in', 'paul', 'Ok. We can sort this out.')
// 20:58 Paul → Ravi call, 64 s, on both phones.
const paulCall = callBoth(ts(16, 20, 58), 'paul', 'ravi', 64)
LAST_IDS.call = paulCall.on_to
LAST_IDS.call_paul = paulCall.on_from

// =====================================================================
// MISSING  Ravi ↔ Amy texts on 16 Apr: on Ravi's phone, gone from Amy's (thread deleted 17 Apr 09:25)
// =====================================================================
const amyThread: [string, 'ravi' | 'amy', string][] = [
  [ts(16, 19, 40, 3), 'amy', 'We need to talk about the house. Tonight.'],
  [ts(16, 19, 52, 30), 'ravi', 'Not tonight.'],
  [ts(16, 20, 31, 9), 'amy', "You always say that. I'm done waiting."],
  [ts(16, 21, 47, 51), 'ravi', "I'm at the warehouse. Tomorrow."],
  [ts(16, 22, 15, 20), 'amy', 'Answer your phone.'],
]
const missingItems: MissingOutput['items'] = amyThread.map(([t, from, body]) => ({
  t,
  channel: 'message' as const,
  from,
  to: from === 'ravi' ? 'amy' : 'ravi',
  body,
  on_a: msg('ravi', t, from === 'ravi' ? 'out' : 'in', 'amy', body),
  on_b: null,
}))
// Amy's two calls during her location gap: on both phones, unanswered on Ravi's.
const amyCalls = [ts(16, 22, 30), ts(16, 22, 31)].map((t) => {
  const on_b = call('amy', t, 'out', 'ravi', 0)
  const on_a = call('ravi', t, 'in', 'amy', 0)
  missingItems.push({ t, channel: 'call', from: 'amy', to: 'ravi', body: 'Call, not answered', on_a, on_b })
  return { t, on_a, on_b }
})
LAST_IDS.last_out = missingItems[3].on_a!
export const AMY_CALL_IDS = amyCalls

// =====================================================================
// SYNC  News alert 17 Apr 09:05, then deletions and power-offs on three phones
// =====================================================================
const newsT = ts(17, 9, 5)
const newsBody = 'Port Calder News: Man found dead at Pier 9 warehouse. Police are appealing for anyone who was in the area last night.'
const newsIds: Record<PersonId, string> = {}
for (const p of ['paul', 'amy', 'ken', 'cara'] as PersonId[]) newsIds[p] = msg(p, newsT, 'in', NEWS_SENDER, newsBody, 'Alerts', NEWS_SENDER)
export const NEWS_IDS = newsIds
const syncDef: [PersonId, 'thread_deleted' | 'power_off' | 'power_on', string, string][] = [
  ['paul', 'thread_deleted', ts(17, 9, 20), `SMS thread with ${NUMBERS.ravi} (Ravi)`],
  ['amy', 'thread_deleted', ts(17, 9, 25), `SMS thread with ${NUMBERS.ravi} (Ravi)`],
  ['paul', 'power_off', ts(17, 9, 30), 'Device powered off'],
  ['cara', 'thread_deleted', ts(17, 9, 46), `SMS thread with ${NUMBERS.ravi} (Ravi)`],
  ['cara', 'power_off', ts(17, 9, 55), 'Device powered off'],
  ['paul', 'power_on', ts(17, 12, 40), 'Device powered on'],
  ['cara', 'power_on', ts(17, 13, 10), 'Device powered on'],
]
const syncEvents: SyncOutput['events'] = syncDef.map(([owner, type, t, detail]) => ({
  id: addRow(owner, 'device_events', t, `${type}: ${detail}`, { event_type: type, detail }),
  device_owner: owner,
  event_type: type,
  t,
  detail,
}))
const firstEv = syncEvents[0].t
const lastOff = syncEvents.filter((e) => e.event_type !== 'power_on').map((e) => e.t).sort().pop()!
export const SYNC: SyncOutput = {
  kind: 'sync',
  window: { start: firstEv, end: lastOff, minutes: minsBetween(firstEv, lastOff) },
  view: { start: ts(17, 8, 30), end: ts(17, 13, 30) },
  trigger: { id: newsIds.paul, device_owner: 'paul', t: newsT, from_label: NEWS_SENDER, body: newsBody, minutes_before_window: minsBetween(newsT, firstEv) },
  events: syncEvents,
  phones: ['paul', 'amy', 'cara'],
  thresholds: { window_min: 60, min_phones: 3 },
}
const amyDelete = syncEvents.find((e) => e.device_owner === 'amy')!
export const MISSING: MissingOutput = {
  kind: 'missing',
  person_a: 'ravi',
  person_b: 'amy',
  items: missingItems,
  deletion_events: [{ id: amyDelete.id, device_owner: 'amy', t: amyDelete.t, counterpart: 'ravi' }],
  missing_count: missingItems.filter((i) => i.on_a && !i.on_b).length,
  tolerance_s: 2,
}
export const PAUL_DELETE_RAVI = syncEvents[0]

// =====================================================================
// Swiftpay helper. There is no money plant between Paul and Cara: a direct transfer would name the link
// in one row. The only Swiftpay transfer between case phones is the Paul → Amy $50 decoy below.
// =====================================================================
const tx = (owner: PersonId, t: string, from: PersonId, to: PersonId, amount: number, memo: string) =>
  addRow(owner, 'transactions', t, `${owner === from ? `Sent $${amount.toLocaleString()} to ${personOf(to).name}` : `Received $${amount.toLocaleString()} from ${personOf(from).name}`} (Swiftpay)${memo ? `, memo "${memo}"` : ', no memo'}`, {
    app: 'Swiftpay',
    from: NUMBERS[from],
    to: NUMBERS[to],
    amount,
    currency: 'USD',
    memo,
  })

// =====================================================================
// MEET  The hidden link. Paul's and Cara's phones within 100 m for 20 min on five days, at five different
// unnamed spots (SPOTS), arriving separately. No call, text, saved contact, payment or social tie between
// them exists on any phone, so nothing in either phone names the other.
// =====================================================================
const occasionsDef = [
  { day: 13, h: 7, m: 30, slots: 2, spot: 0 },
  { day: 14, h: 18, m: 0, slots: 2, spot: 1 },
  { day: 15, h: 12, m: 40, slots: 2, spot: 2 },
  { day: 16, h: 12, m: 30, slots: 2, spot: 3 },
  { day: 18, h: 9, m: 0, slots: 2, spot: 4 },
]
/** "unnamed spot 1.9 km from Northgate Mall": the nearest named place that isn't a home, computed from coordinates. */
export function nearestLabel(lat: number, lon: number) {
  const [d, n] = PLACES.filter((p) => p.kind !== 'home')
    .map((p) => [haversine(lat, lon, p.lat, p.lon), p.name] as const)
    .sort((x, y) => x[0] - y[0])[0]
  return `unnamed spot ${(d / 1000).toFixed(1)} km from ${n}`
}
export const MEET: MeetingsOutput = {
  kind: 'meetings',
  person_a: 'paul',
  person_b: 'cara',
  occasions: occasionsDef.map(({ day, h, m, slots, spot }) => {
    const row_ids: string[] = []
    let minD = Infinity
    let first = ''
    let last = ''
    const pl = SPOTS[spot]
    for (let i = 0; i < slots; i++) {
      const mins = h * 60 + m + i * 10
      const t = ts(day, Math.floor(mins / 60), mins % 60)
      const a = locRow('paul', t, pl.name, 20)
      const b = locRow('cara', t, pl.name, 20)
      minD = Math.min(minD, haversine(a.lat, a.lon, b.lat, b.lon))
      row_ids.push(a.id, b.id)
      if (i === 0) first = t
      last = t
    }
    return { date: fmtDate(first), place: nearestLabel(pl.lat, pl.lon), start: first, end: last, duration_min: slots * 10, min_distance_m: Math.round(minD), lat: pl.lat, lon: pl.lon, row_ids }
  }),
  contact_rows_found: 0,
  channels_checked: ['messages', 'calls', 'contacts', 'transactions', 'social interactions'],
  thresholds: { within_m: 100, min_minutes: 20, min_occasions: 2 },
}

// =====================================================================
// HOSTILE  Ken's posts about Ravi after his dismissal on 14 Apr (Snapline, scored by a fixed classifier)
// =====================================================================
export const HOSTILITY_MODEL = 'toxic-bert v1.2 (local, deterministic)'
const firedT = ts(14, 16, 20)
const firedBody = 'Ken, as discussed: today is your last day. HR will send the paperwork. Please return your keys to Paul.'
const firedId = msg('ken', firedT, 'in', 'ravi', firedBody)
export const FIRED_RAVI_ID = msg('ravi', firedT, 'out', 'ken', firedBody)
export function social(owner: PersonId, t: string, kind: 'post' | 'comment' | 'reply' | 'like' | 'follow', text: string, score: number | null, target: PersonId | null, where: string) {
  return addRow(owner, 'social_interactions', t, `Snapline ${kind}${text ? `: "${text}"` : ''}${where ? ` (${where})` : ''}`, {
    platform: 'Snapline',
    actor: personOf(owner).handle,
    target: target ? personOf(target).handle : null,
    kind,
    text,
    where,
    hostility: score,
  })
}
const kenPosts: [string, 'post' | 'comment' | 'reply', string, number, string][] = [
  [ts(14, 19, 2), 'post', '11 years at Pier 9 and Ravi Mehta walks me out with a cardboard box. Remember that name.', 0.74, 'own profile'],
  [ts(14, 22, 40), 'comment', "Ask the owner where the 'missing' stock really goes.", 0.62, 'Harbor Supply Co. page'],
  [ts(15, 8, 15), 'post', 'Some people only learn when it costs them.', 0.71, 'own profile'],
  [ts(15, 21, 30), 'reply', 'Enjoy it while it lasts.', 0.78, "reply to @ravi.mehta's post"],
  [ts(16, 12, 5), 'post', "He'll get what's coming to him. Not my problem anymore.", 0.86, 'own profile'],
  [ts(17, 9, 50), 'post', 'karma.', 0.73, 'own profile'],
]
export const HOSTILE: HostilityOutput = {
  kind: 'hostility',
  actor: 'ken',
  target: 'ravi',
  platform: 'Snapline',
  threshold: 0.7,
  model: HOSTILITY_MODEL,
  items: kenPosts.map(([t, kind, text, score, where]) => ({ id: social('ken', t, kind, text, score, 'ravi', where), t, kind, text, score, where })),
  flagged: kenPosts.filter((p) => p[3] >= 0.7).length,
  context: { id: firedId, t: firedT, label: "Ravi's text ending Ken's job" },
}
// Ravi's own post that Ken replied to.
export const RAVI_POST = social('ravi', ts(15, 18, 0), 'post', "Cleaning house at Harbor Supply. Honesty isn't optional.", 0.12, null, 'own profile')
// Decoy: Amy's vague post scores below the threshold and names no one.
export const AMY_POST = social('amy', ts(16, 20, 33), 'post', 'Done being lied to.', 0.55, null, 'own profile')
// Ordinary ties the relationship mapper picks up.
export const SOCIAL_TIES = [
  social('amy', ts(13, 9, 12), 'follow', '', null, 'ravi', 'follow list'),
  social('ken', ts(13, 9, 40), 'follow', '', null, 'ravi', 'follow list'),
  social('paul', ts(15, 18, 22), 'like', '', null, 'ravi', "liked @ravi.mehta's post"),
]

// =====================================================================
// Location gaps. A gap runs from the slot after the last location row to the slot before the next one.
// =====================================================================
function makeGap(person: PersonId, before: TrackPoint, after: TrackPoint, gap_type: GapType, raised: boolean, activity: GapOutput['activity'] = [], power_event_ids: string[] = []): GapOutput {
  const start = addMin(before.t, 10)
  const end = addMin(after.t, -10)
  return {
    kind: 'gap',
    person,
    start,
    end,
    minutes: minsBetween(start, end),
    gap_type,
    raised,
    bounding: { before: { id: before.id, t: before.t }, after: { id: after.id, t: after.t } },
    activity,
    power_event_ids,
    thresholds: { min_gap_min: 45, interval_min: 10 },
  }
}

// GPAUL: Paul's phone heads toward Pier 9 and is powered off 21:16–23:38, covering most of the window.
export const PAUL_TRAVEL = [pointRow('paul', ts(16, 20, 50), 40.969, -72.008, 'In transit'), pointRow('paul', ts(16, 21, 0), 40.955, -71.99, 'In transit')]
export const PAUL_LAST_FIX = pointRow('paul', ts(16, 21, 10), place('Harbor Rd lot').lat, place('Harbor Rd lot').lon, 'Harbor Rd lot')
const paulOff = addRow('paul', 'device_events', ts(16, 21, 16), 'power_off: Device powered off', { event_type: 'power_off', detail: 'Device powered off' })
const paulOn = addRow('paul', 'device_events', ts(16, 23, 38), 'power_on: Device powered on', { event_type: 'power_on', detail: 'Device powered on' })
const paulBack = locRow('paul', ts(16, 23, 40), 'Becker residence', 20)
export const GPAUL: GapOutput = makeGap('paul', PAUL_LAST_FIX, paulBack, 'powered_off', true, [], [paulOff, paulOn])

// GAMY: Amy's phone reports no location 21:40–22:50 while it calls Ravi twice (it also sent the 22:15 text, since deleted).
const amyBefore = locRow('amy', ts(16, 21, 30), 'Brooks residence', 20)
const amyAfter = locRow('amy', ts(16, 23, 0), 'Brooks residence', 20)
export const GAMY: GapOutput = makeGap('amy', amyBefore, amyAfter, 'location_off', true, amyCalls.map((c, i) => ({ id: c.on_b, t: c.t, table: 'calls' as const, label: i ? 'Second call to Ravi, not answered' : 'Call to Ravi, not answered' })))

// Decoy: Ken's phone off overnight 14→15 Apr.
const kenOff = addRow('ken', 'device_events', ts(14, 23, 14), 'power_off: Device powered off', { event_type: 'power_off', detail: 'Device powered off' })
const kenOn = addRow('ken', 'device_events', ts(15, 7, 2), 'power_on: Device powered on', { event_type: 'power_on', detail: 'Device powered on' })
export const KEN_NIGHT: GapOutput = makeGap('ken', locRow('ken', ts(14, 23, 10), 'Walsh residence', 20), locRow('ken', ts(15, 7, 10), 'Walsh residence', 20), 'powered_off', false, [], [kenOff, kenOn])

// Decoy: Cara's phone, 19 Apr 09:10–10:00, no location and no activity of any kind.
export const CARA_GAP: GapOutput = makeGap('cara', locRow('cara', ts(19, 9, 0), 'Novak residence', 20), locRow('cara', ts(19, 10, 10), 'Novak residence', 20), 'unexplained', false)

// Sync power-offs show up as powered_off gaps, raised because they overlap the synchronised-behaviour signal.
const powerIds = (owner: PersonId) => syncEvents.filter((e) => e.device_owner === owner && e.event_type !== 'thread_deleted').map((e) => e.id)
export const SYNC_GAPS: GapOutput[] = [
  makeGap('paul', locRow('paul', ts(17, 9, 20), 'Harbor Supply Co.', 20), locRow('paul', ts(17, 12, 50), 'Harbor Supply Co.', 20), 'powered_off', true, [], powerIds('paul')),
  makeGap('cara', locRow('cara', ts(17, 9, 50), 'Novak residence', 20), locRow('cara', ts(17, 13, 20), 'Novak residence', 20), 'powered_off', true, [], powerIds('cara')),
]

// The victim's phone: battery runs out at the scene, after which there is no data.
export const RAVI_DEAD_BATTERY = addRow('ravi', 'device_events', ts(17, 1, 52), 'power_off: Battery depleted (0%)', { event_type: 'power_off', detail: 'Battery depleted (0%)' })
export const RAVI_END = ts(17, 1, 52)

export const ALL_GAPS: GapOutput[] = [GPAUL, GAMY, KEN_NIGHT, CARA_GAP, ...SYNC_GAPS]

// =====================================================================
// GROUP  "Harbor crew" WhatsApp group: Ravi, Paul, Amy, Ken. Each member's phone holds a copy.
// Used by the interview checks (Amy says she has never met Ken). Group messages are addressed to the
// group, not to a person, so they add no person-to-person edges to the graph.
// =====================================================================
export const GROUP = { name: 'Harbor crew', app: 'WhatsApp', id: 'whatsapp:grp-harbor-crew', members: ['ravi', 'paul', 'amy', 'ken'] as PersonId[] }
const groupDef: [number, number, number, PersonId, string][] = [
  [13, 19, 2, 'ken', 'Drinks at the Anchor Friday?'],
  [13, 19, 5, 'amy', "In. Ken you still owe me a round from last time 😄"],
  [13, 19, 7, 'ken', 'Ha. Fair. First one’s on me.'],
  [13, 19, 20, 'ravi', 'Count me in.'],
  [15, 12, 41, 'paul', 'Ken, sorry about yesterday.'],
  [15, 12, 44, 'ken', "Not your call. Ravi's."],
  [15, 12, 50, 'amy', 'Ken, call me if you need anything.'],
]
export const GROUP_IDS: { sender: PersonId; t: string; body: string; ids: string[] }[] = groupDef.map(([d, h, m, sender, body]) => {
  const t = ts(d, h, m)
  const ids = GROUP.members.map((owner) =>
    addRow(owner, 'messages', t, `${GROUP.name} · ${personName(sender)}: "${body}"`, {
      thread_id: GROUP.id,
      app: GROUP.app,
      direction: owner === sender ? 'out' : 'in',
      from: NUMBERS[sender],
      to: `group:${GROUP.name}`,
      group: GROUP.name,
      members: GROUP.members.map((p) => NUMBERS[p]).join(','),
      body,
    }),
  )
  return { sender, t, body, ids }
})

// =====================================================================
// Other planted ties: Paul → Amy $50 "lunch" (decoy), Amy and Ken at FreshMart once (decoy)
// =====================================================================
export const LUNCH_IDS = [tx('paul', ts(16, 13, 20), 'paul', 'amy', 50, 'lunch'), tx('amy', ts(16, 13, 20), 'paul', 'amy', 50, 'lunch')]
export const FRESHMART_IDS: string[] = []
for (let i = 0; i < 3; i++) {
  const t = ts(15, 17, 30 + i * 10)
  FRESHMART_IDS.push(locRow('amy', t, 'FreshMart', 20).id, locRow('ken', t, 'FreshMart', 20).id)
}

// =====================================================================
// Coverage rows: first and last location row per phone (used by cannot_tell answers)
// =====================================================================
const coverageDevices = PEOPLE.map((p) => {
  const first = locRow(p.person_id, ts(13, 0, 0), HOME[p.person_id])
  const isV = p.person_id === VICTIM
  const last = locRow(p.person_id, isV ? ts(17, 1, 50) : ts(19, 23, 50), isV ? 'Pier 9 Warehouse' : HOME[p.person_id], isV ? 8 : 25)
  return { owner: p.person_id, first: { id: first.id, t: first.t }, last: { id: last.id, t: last.t } }
})
export function coverageFor(item: string): CoverageOutput {
  return { kind: 'coverage', item, start: ts(13, 0, 0), end: ts(19, 23, 50), devices: coverageDevices }
}
export const COVERAGE_IDS = coverageDevices.flatMap((d) => [d.first.id, d.last.id])

export const NEXT_STEPS = [
  "Ask Paul where he was between 21:16 and 23:38 on 16 April, when his phone was off, and about the 18:05 text from Ravi's phone.",
  'Ask Amy where she was between 21:40 and 22:50 on 16 April, and why the thread with Ravi was deleted at 09:25 on 17 April.',
  'Request bank records for Paul and Cara, and every Harbor Supply Co. invoice from Novak since January (the invoices Ravi asked Paul for on 15 April).',
  'Request CCTV and parking records for Harbor Rd lot and Pier 9, 16 April 20:30 to 00:00.',
  "Request carrier cell-site records for Paul's and Amy's numbers for the same window; a phone that is off leaves none.",
  "Preserve Ken's Snapline account; the posts are context for interview, not evidence of presence.",
]

export const ASSUMPTIONS = [
  'Phone data is treated as genuine; spoofing is not assessed.',
  "A phone's location is not proof of where its owner was.",
  'The time-of-death window comes from the medical examiner and is taken as given.',
  "Data covers 13 to 19 April 2026; the victim's phone ends at 01:52 on 17 April.",
]
