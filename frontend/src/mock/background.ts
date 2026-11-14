// Seeded background activity for every phone, 13–19 April: messages, calls, locations, transactions
// and contacts. Planted scenario rows (mock/data.ts) are left untouched; this fills in the ordinary
// week around them so that counts, charts and the sweep all run over a realistic full dataset.
//
// Rules that keep the plants valid:
//   - no background contact between case phones except Paul↔Ken and Paul↔Amy calls (on both phones)
//   - no activity while a phone is powered off, inside Ken's G1 gap, or inside Amy's decoy gap
//   - no location rows inside any gap; never two location rows for one phone at the same timestamp

import type { EvidenceTable, PersonId } from '../api/types'
import { AMY_GAP, G1, GRAPH, KEN_NIGHT, NUMBERS, PEOPLE, PLACES, ROWS, S7, addRow, haversine, ts } from './data'
import { SEGMENTS } from './segments'

// ---------- seeded helpers ----------
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
const rng = mulberry32(20260413)
const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)]
function poisson(l: number) {
  const L = Math.exp(-l)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng()
  } while (p > L)
  return k - 1
}
const normal = () => Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng())
const lognormal = (median: number, sigma: number) => median * Math.exp(sigma * normal())
/** Zipf-weighted index in [0, n). */
function zipf(n: number, s = 1.1) {
  const w = Array.from({ length: n }, (_, i) => 1 / Math.pow(i + 1, s))
  const tot = w.reduce((a, b) => a + b, 0)
  let r = rng() * tot
  for (let i = 0; i < n; i++) if ((r -= w[i]) <= 0) return i
  return n - 1
}

// ---------- time helpers (minutes since 13 Apr 00:00, case-local) ----------
const absOf = (iso: string) => (Number(iso.slice(8, 10)) - 13) * 1440 + Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)) + Number(iso.slice(17, 19)) / 60
const isoOf = (mins: number) => {
  const totalSec = Math.round(mins * 60)
  const d = 13 + Math.floor(totalSec / 86400)
  const r = totalSec % 86400
  return ts(d, Math.floor(r / 3600), Math.floor((r % 3600) / 60), r % 60)
}
const WEEK = 7 * 1440

// ---------- quiet windows ----------
type Win = [number, number]
const quiet: Record<PersonId, Win[]> = { paul: [], amy: [], ken: [], cara: [] }
for (const p of ['paul', 'ken', 'cara'] as PersonId[]) {
  const off = S7.events.find((e) => e.device_owner === p && e.event_type === 'power_off')!
  const on = S7.events.find((e) => e.device_owner === p && e.event_type === 'power_on')!
  quiet[p].push([absOf(off.t), absOf(on.t)])
}
quiet.ken.push([absOf(KEN_NIGHT.bounding.before.t), absOf(KEN_NIGHT.bounding.after.t)])
quiet.ken.push([absOf(G1.bounding.before.t), absOf(G1.bounding.after.t)])
quiet.amy.push([absOf(AMY_GAP.bounding.before.t), absOf(AMY_GAP.bounding.after.t)])
const isQuiet = (p: PersonId, m: number) => quiet[p].some(([a, b]) => m > a - 1 && m < b + 1)

// ---------- people-specific parameters ----------
const PERSONA: Record<PersonId, { msgRate: number; callRate: number; iphone: boolean }> = {
  paul: { msgRate: 1.0, callRate: 1.0, iphone: true },
  amy: { msgRate: 1.35, callRate: 0.8, iphone: false },
  ken: { msgRate: 0.8, callRate: 1.2, iphone: false },
  cara: { msgRate: 0.95, callRate: 1.1, iphone: true },
}

/** Conversation sessions per hour on a weekday; weekends shift later and lose the commute peaks. */
const WEEKDAY = [0.06, 0.03, 0.01, 0.01, 0.01, 0.03, 0.2, 0.7, 1.0, 0.7, 0.55, 0.7, 1.4, 1.1, 0.6, 0.55, 0.7, 1.1, 1.3, 1.5, 1.8, 1.7, 1.1, 0.4]
const WEEKEND = [0.25, 0.12, 0.05, 0.02, 0.01, 0.01, 0.03, 0.1, 0.3, 0.7, 1.0, 1.2, 1.3, 1.1, 1.0, 1.0, 1.1, 1.2, 1.4, 1.6, 1.8, 1.7, 1.3, 0.7]
const CALLS = [0, 0, 0, 0, 0, 0, 0.02, 0.15, 0.35, 0.25, 0.2, 0.2, 0.35, 0.3, 0.2, 0.2, 0.25, 0.4, 0.45, 0.35, 0.3, 0.2, 0.08, 0.02]

const FIRST = ['Dave', 'Mum', 'Dad', 'Priya', 'Jon', 'Leah', 'Marco', 'Sam', 'Tess', 'Omar', 'Grace', 'Ben', 'Nina', 'Raj', 'Chloe', 'Felix', 'Ivy', 'Hugo', 'Mei', 'Zoe', 'Luis', 'Ana', 'Theo', 'Rosa', 'Kai', 'Elle', 'Max', 'June', 'Noah', 'Iris', 'Jack', 'Lena', 'Ravi', 'Ola', 'Finn', 'Maya', 'Carl', 'Bea', 'Ezra', 'Hana']
const SUFFIX = ['', ' (work)', ' gym', ' school', ' B', ' landlord', ' cousin', '']
const BODIES_OUT = [
  'on my way', 'running 10 min late sorry', 'did you see the game last night?', 'can you grab milk on the way home', 'ok sounds good', 'what time tomorrow?',
  'call you after work', 'thanks!!', 'send me the address', 'are we still on for friday?', "can't talk now, in a meeting", 'where are you?', 'be there in 5',
  'did you pay the electric bill?', 'no worries', 'see you there', 'how did it go?', 'pizza tonight?', "I'm at the gym, text later", 'remind me tomorrow', 'got it',
  'parking is a nightmare here', 'train delayed again', 'just finished, heading out', 'yes please', 'haha true', 'leaving now', 'can you call me when free',
  'happy birthday!!', 'sorry missed your call', 'what do you want for dinner', 'sure', 'nope', 'done', 'let me check and get back to you',
]
const BODIES_IN = [
  'lol', 'haha yes', '👍', 'ok', 'cool', 'thanks', 'see you soon', 'sounds good', 'no rush', 'where r u', 'call me', 'running late too', 'yep',
  'did you get my email?', 'can you pick up the kids at 4', "how's your day", 'traffic is bad', 'love you', 'good luck today!', 'what time?', 'ok will do',
  'nice!', 'are you free saturday?', 'don’t forget tomorrow', 'all good', 'hmm not sure', 'sent', 'perfect', 'is that ok?', 'got home safe',
]
const MERCHANTS: { name: string; median: number; sigma: number; hours: number[] }[] = [
  { name: 'Bean There Coffee', median: 4.6, sigma: 0.25, hours: [7, 8, 9, 10] },
  { name: 'Harbor Deli', median: 11.5, sigma: 0.3, hours: [12, 13] },
  { name: 'FreshMart', median: 38, sigma: 0.6, hours: [17, 18, 19, 11, 15] },
  { name: 'Port Calder Transit', median: 2.75, sigma: 0.01, hours: [7, 8, 17, 18] },
  { name: 'Shell Northgate', median: 46, sigma: 0.3, hours: [8, 16, 18] },
  { name: 'Lotus Noodle Bar', median: 22, sigma: 0.35, hours: [19, 20] },
  { name: 'Streamly', median: 12.99, sigma: 0.0, hours: [3] },
]

// ---------- generate ----------
const fmtNum = (n: number) => `+1 555 01${String(Math.floor(n / 10000) % 10)} ${String(n % 10000).padStart(4, '0')}`

for (const person of PEOPLE) {
  const p = person.person_id
  const P = PERSONA[p]
  const nContacts = 18 + Math.floor(rng() * 20)
  const contacts = Array.from({ length: nContacts }, (_, i) => ({
    name: FIRST[(i * 7 + p.length * 3) % FIRST.length] + SUFFIX[i % SUFFIX.length],
    number: fmtNum(20000 + Math.floor(rng() * 70000)),
  }))
  // Saved contacts (the contacts table)
  for (const c of contacts) addRow(p, 'contacts', ts(13, 0, 0), `Contact: ${c.name}`, { saved_name: c.name, number: c.number })

  // Messages: conversation sessions
  for (let h = 0; h < 168; h++) {
    const day = 13 + Math.floor(h / 24)
    const hour = h % 24
    const rate = (day >= 18 ? WEEKEND : WEEKDAY)[hour] * P.msgRate * 0.95
    const sessions = poisson(rate)
    for (let s = 0; s < sessions; s++) {
      const c = contacts[zipf(contacts.length)]
      const app = rng() < 0.55 ? 'WhatsApp' : P.iphone ? 'iMessage' : 'SMS'
      let t = h * 60 + rng() * 60
      const n = 2 + Math.floor(-Math.log(rng() || 1e-9) * 3.2)
      let out = rng() < 0.5
      for (let k = 0; k < Math.min(n, 15) && t < WEEK; k++) {
        if (!isQuiet(p, t)) {
          const body = out ? pick(BODIES_OUT) : pick(BODIES_IN)
          addRow(p, 'messages', isoOf(t), `${out ? 'To' : 'From'} ${c.name}: "${body}"`, {
            thread_id: `${app.toLowerCase()}:${c.number}`,
            app,
            direction: out ? 'out' : 'in',
            from: out ? person.phone_number : c.number,
            to: out ? c.number : person.phone_number,
            body,
          })
        }
        out = rng() < 0.65 ? !out : out
        t += (10 + rng() * 230) / 60
      }
    }
  }

  // Calls
  for (let h = 0; h < 168; h++) {
    const n = poisson(CALLS[h % 24] * P.callRate * ((13 + Math.floor(h / 24)) >= 18 ? 0.7 : 1))
    for (let k = 0; k < n; k++) {
      const t = h * 60 + rng() * 60
      if (isQuiet(p, t)) continue
      const c = contacts[zipf(contacts.length, 1.3)]
      const out = rng() < 0.5
      const missed = rng() < 0.15
      const dur = missed ? 0 : Math.round(Math.min(3600, lognormal(90, 0.9)))
      addRow(p, 'calls', isoOf(t), `${out ? 'Outgoing call to' : missed ? 'Missed call from' : 'Incoming call from'} ${c.name}${missed ? '' : `, ${dur} s`}`, {
        direction: out ? 'out' : 'in',
        from: out ? person.phone_number : c.number,
        to: out ? c.number : person.phone_number,
        duration_s: dur,
        status: missed ? 'missed' : 'answered',
      })
    }
  }

  // Transactions: everyday card and app payments
  for (let d = 0; d < 7; d++) {
    const n = Math.floor(rng() * 3.4)
    for (let k = 0; k < n; k++) {
      const m = pick(MERCHANTS.filter((x) => x.name !== 'Streamly'))
      const t = d * 1440 + pick(m.hours) * 60 + rng() * 60
      if (isQuiet(p, t)) continue
      const amount = Math.round(lognormal(m.median, m.sigma) * 100) / 100
      addRow(p, 'transactions', isoOf(t), `Card payment $${amount.toFixed(2)} to ${m.name}`, {
        app: 'Card',
        from: person.phone_number,
        to: `merchant:${m.name}`,
        amount,
        currency: 'USD',
        memo: '',
      })
    }
  }
  if (p === 'amy' || p === 'paul') {
    addRow(p, 'transactions', ts(16, 3, 12), 'Subscription $12.99 to Streamly', { app: 'Card', from: person.phone_number, to: 'merchant:Streamly', amount: 12.99, currency: 'USD', memo: 'monthly' })
  }
}

// Paul ↔ Ken calls, on both phones: daily until the 17th, then none (a pair that went quiet).
const pkCalls: string[] = []
for (const [d, h, m, dur, out] of [
  [13, 19, 42, 245, true], [15, 20, 5, 410, false], [16, 18, 51, 133, true], [16, 21, 30, 0, false], [17, 8, 12, 96, true],
] as [number, number, number, number, boolean][]) {
  const t = ts(d, h, m)
  const from = out ? NUMBERS.paul : NUMBERS.ken
  const to = out ? NUMBERS.ken : NUMBERS.paul
  const status = dur ? 'answered' : 'missed'
  pkCalls.push(
    addRow('paul', 'calls', t, `${out ? 'Outgoing call to Ken' : dur ? 'Incoming call from Ken' : 'Missed call from Ken'}${dur ? `, ${dur} s` : ''}`, { direction: out ? 'out' : 'in', from, to, duration_s: dur, status }),
    addRow('ken', 'calls', t, `${out ? (dur ? 'Incoming call from Paul' : 'Missed call from Paul') : 'Outgoing call to Paul'}${dur ? `, ${dur} s` : ''}`, { direction: out ? 'in' : 'out', from, to, duration_s: dur, status }),
  )
}
const pkEdge = GRAPH.edges.find((e) => e.source === 'paul' && e.target === 'ken' && e.channel === 'call')!
pkEdge.evidence_ids = [...pkEdge.evidence_ids, ...pkCalls]
pkEdge.label = `${pkEdge.evidence_ids.length / 2} calls on both phones, none after 17 Apr 08:12`

// ---------- locations from the stays table ----------
const taken = new Set<string>()
for (const r of ROWS.values()) if (r.table === 'locations') taken.add(`${r.device_owner}|${r.timestamp}`)
const coords = (name?: string) => PLACES.find((x) => x.name === name)
for (const seg of SEGMENTS) {
  if (seg.kind === 'gap') continue
  const a = absOf(seg.start)
  const b = absOf(seg.end)
  for (let m = Math.ceil(a / 10) * 10; m < b; m += 10) {
    const iso = isoOf(m)
    if (taken.has(`${seg.person}|${iso}`)) continue
    // never inside a gap
    if (SEGMENTS.some((g) => g.person === seg.person && g.kind === 'gap' && m > absOf(g.start) && m < absOf(g.end))) continue
    let lat: number
    let lon: number
    let place = ''
    let acc: number
    if (seg.kind === 'stay') {
      const c = coords(seg.place)!
      const indoor = rng() < 0.12
      acc = indoor ? 35 + Math.floor(rng() * 60) : 5 + Math.floor(rng() * 18)
      const j = acc * 0.8
      lat = c.lat + (normal() * j) / 111320
      lon = c.lon + (normal() * j) / (111320 * Math.cos((c.lat * Math.PI) / 180))
      place = seg.place!
    } else {
      const f = coords(seg.from)!
      const t = coords(seg.to)!
      // Offset so the first travel fix is already on the way, not still at the origin.
      const k = (m - a + 4) / Math.max(1, b - a + 4)
      acc = 8 + Math.floor(rng() * 25)
      lat = f.lat + (t.lat - f.lat) * k + (normal() * 40) / 111320
      lon = f.lon + (t.lon - f.lon) * k + (normal() * 40) / 84000
    }
    taken.add(`${seg.person}|${iso}`)
    addRow(seg.person, 'locations', iso, place ? `${place} (±${acc} m)` : `In transit (±${acc} m)`, {
      lat: +lat.toFixed(6),
      lon: +lon.toFixed(6),
      accuracy_m: acc,
      place_name: place || null,
      source: acc > 40 ? 'wifi' : 'gps',
    })
  }
}

// ---------- computed counts (replace the old hand-typed numbers) ----------
export function countsFor(p: PersonId) {
  const c: Record<EvidenceTable, number> = { messages: 0, calls: 0, locations: 0, transactions: 0, device_events: 0, social_interactions: 0, contacts: 0 }
  for (const r of ROWS.values()) if (r.device_owner === p) c[r.table]++
  return c
}
for (const person of PEOPLE) {
  const c = countsFor(person.person_id)
  person.counts = { messages: c.messages, calls: c.calls, locations: c.locations, transfers: c.transactions, social: c.social_interactions }
}

export const BACKGROUND_READY = true
// Sanity marker used by tests: haversine imported so tree-shaking keeps the module honest.
void haversine
