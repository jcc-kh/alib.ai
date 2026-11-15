// Interview transcripts and claim verification.
// A transcript is split into speaker turns; the interviewee's checkable statements are claims. Each
// claim has a fixed plan of checks. Every check runs over the rows of the phones examined so far, so a
// verdict can change when a phone is added. Nothing here is hand-scored: the outcome of each check is
// computed from rows, and the verdict and confidence follow from the outcomes by one rule (scoreClaim).
// In the real system the claim extraction is an LLM step and the checks are the same deterministic tools.

import type { EvidenceRow, PersonId } from '../api/types'
import { ALL_GAPS, GROUP, HOME, HOSTILE, NUMBERS, ROWS, SCENE, haversine, personName, ts } from './data'
import { fmtDate, fmtKm, fmtTime } from '../lib/format'

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

export type Outcome = 'supports' | 'contradicts' | 'inconclusive' | 'blocked'
export type Strength = 'strong' | 'weak'
export type ClaimVerdict = 'verified' | 'unverified' | 'disproven'

export interface CheckRun {
  outcome: Exclude<Outcome, 'blocked'>
  found: string
  evidence_ids: string[]
}

export interface CheckSpec {
  id: string
  label: string
  /** How the check works, in one sentence. */
  method: string
  /** Strong = would settle the claim on its own; weak = only shifts it. Fixed before the check runs. */
  strength: Strength
  /** Data the check needs. `all`: every listed person's phone. `any`: at least one of them. */
  needs: { all?: PersonId[]; any?: PersonId[]; what: string }
  run: (loaded: PersonId[]) => CheckRun
}

export interface Claim {
  id: string
  /** The words as spoken. */
  quote: string
  /** What exactly is being tested. */
  tests: string
  checks: CheckSpec[]
  /** Answer key: the verdict with every phone examined (graded in the scorecard). */
  expected: ClaimVerdict
}

export type Segment = string | { claim: string } | { opinion: string }

export interface Turn {
  who: 'Q' | 'A'
  parts: Segment[]
}

export interface Transcript {
  id: string
  person: PersonId
  interviewee: string
  at: string
  interviewer: string
  place: string
  minutes: number
  file: string
  turns: Turn[]
  claims: Claim[]
}

export interface CheckResult extends CheckSpec {
  result: CheckRun | { outcome: 'blocked'; found: string; evidence_ids: [] }
}

export interface ClaimResult {
  claim: Claim
  verdict: ClaimVerdict
  /** Probability the claim is true, after every check that ran. */
  p_true: number
  /** Confidence in the verdict shown: p_true for verified, 1 - p_true for disproven, the lean otherwise. */
  confidence: number
  checks: CheckResult[]
  ran: number
}

// ---------------------------------------------------------------------------------------------
// Scoring rule (shown to the investigator on the scorecard)
// ---------------------------------------------------------------------------------------------

export const SCORING = {
  prior: 0.5,
  /** Odds multiplier per check outcome. */
  factor: { strong: 10, weak: 2 },
  verified_at: 0.8,
  disproven_at: 0.2,
  cap: 0.98,
}

export function scoreClaim(claim: Claim, loaded: PersonId[]): ClaimResult {
  const checks: CheckResult[] = claim.checks.map((c) => {
    const ok = (c.needs.all ?? []).every((p) => loaded.includes(p)) && (!c.needs.any || c.needs.any.some((p) => loaded.includes(p)))
    return { ...c, result: ok ? c.run(loaded) : { outcome: 'blocked', found: `Can't run yet: needs ${c.needs.what}, which no examined phone has.`, evidence_ids: [] } }
  })
  let odds = SCORING.prior / (1 - SCORING.prior)
  for (const c of checks) {
    const f = SCORING.factor[c.strength]
    if (c.result.outcome === 'supports') odds *= f
    if (c.result.outcome === 'contradicts') odds /= f
  }
  const p = Math.min(SCORING.cap, Math.max(1 - SCORING.cap, odds / (1 + odds)))
  const strongSupport = checks.some((c) => c.strength === 'strong' && c.result.outcome === 'supports')
  const strongContra = checks.some((c) => c.strength === 'strong' && c.result.outcome === 'contradicts')
  const verdict: ClaimVerdict = p >= SCORING.verified_at && strongSupport ? 'verified' : p <= SCORING.disproven_at && strongContra ? 'disproven' : 'unverified'
  const confidence = verdict === 'verified' ? p : verdict === 'disproven' ? 1 - p : Math.max(p, 1 - p)
  return { claim, verdict, p_true: p, confidence, checks, ran: checks.filter((c) => c.result.outcome !== 'blocked').length }
}

// ---------------------------------------------------------------------------------------------
// Row helpers (all restricted to the phones examined)
// ---------------------------------------------------------------------------------------------

const ALL_ROWS = () => [...ROWS.values()]
const byNumber = new Map(Object.entries(NUMBERS).map(([p, n]) => [n, p as PersonId]))
const sortT = (a: EvidenceRow, b: EvidenceRow) => a.timestamp.localeCompare(b.timestamp)

function rowsOf(loaded: PersonId[], table: EvidenceRow['table'], owner?: PersonId) {
  return ALL_ROWS()
    .filter((r) => r.table === table && loaded.includes(r.device_owner) && (!owner || r.device_owner === owner))
    .sort(sortT)
}

/** Calls and texts between two people on any examined phone; copies on both phones counted once. */
function contactsBetween(loaded: PersonId[], a: PersonId, b: PersonId, from = ts(13, 0, 0), to = ts(20, 0, 0)) {
  const seen = new Map<string, EvidenceRow>()
  for (const r of ALL_ROWS()) {
    if ((r.table !== 'calls' && r.table !== 'messages') || !loaded.includes(r.device_owner)) continue
    if (r.timestamp < from || r.timestamp > to) continue
    const x = byNumber.get(String(r.fields.from))
    const y = byNumber.get(String(r.fields.to))
    if (!((x === a && y === b) || (x === b && y === a))) continue
    const k = `${r.table}|${r.timestamp}|${r.fields.body ?? r.fields.duration_s}`
    if (!seen.has(k)) seen.set(k, r)
  }
  return [...seen.values()].sort(sortT)
}

function transfersBetween(loaded: PersonId[], a: PersonId, b: PersonId) {
  const seen = new Map<string, EvidenceRow>()
  for (const r of rowsOf(loaded, 'transactions')) {
    const x = byNumber.get(String(r.fields.from))
    const y = byNumber.get(String(r.fields.to))
    if (!((x === a && y === b) || (x === b && y === a))) continue
    const k = `${r.timestamp}|${r.fields.amount}`
    if (!seen.has(k)) seen.set(k, r)
  }
  return [...seen.values()].sort(sortT)
}

const fixes = (loaded: PersonId[], p: PersonId, from: string, to: string) => rowsOf(loaded, 'locations', p).filter((r) => r.timestamp >= from && r.timestamp <= to)
const distTo = (r: EvidenceRow, lat: number, lon: number) => haversine(Number(r.fields.lat), Number(r.fields.lon), lat, lon)
const sceneDist = (r: EvidenceRow) => distTo(r, SCENE.lat, SCENE.lon)
const placeOf = (r: EvidenceRow) => (r.fields.place_name ? String(r.fields.place_name) : 'in transit')
const gapsIn = (p: PersonId, from: string, to: string) => ALL_GAPS.filter((g) => g.person === p && g.start <= to && g.end >= from)
const pct = (n: number, d: number) => `${n} of ${d}`

/** Same 10-minute slot and within 100 m, grouped into occasions. */
function together(loaded: PersonId[], a: PersonId, b: PersonId) {
  const bySlot = new Map(rowsOf(loaded, 'locations', b).map((r) => [r.timestamp.slice(0, 16), r]))
  const hits: [EvidenceRow, EvidenceRow][] = []
  for (const r of rowsOf(loaded, 'locations', a)) {
    const o = bySlot.get(r.timestamp.slice(0, 16))
    if (o && distTo(r, Number(o.fields.lat), Number(o.fields.lon)) <= 100) hits.push([r, o])
  }
  const occasions: { place: string; start: string; end: string; ids: string[] }[] = []
  for (const [r, o] of hits) {
    const last = occasions[occasions.length - 1]
    const gapMin = last ? (new Date(r.timestamp).getTime() - new Date(last.end).getTime()) / 60000 : Infinity
    if (last && gapMin <= 20) {
      last.end = r.timestamp
      last.ids.push(r.id, o.id)
    } else occasions.push({ place: placeOf(r), start: r.timestamp, end: r.timestamp, ids: [r.id, o.id] })
  }
  // Ignore home addresses and single-slot brushes.
  return occasions.filter((x) => x.ids.length >= 4 && !Object.values(HOME).includes(x.place))
}

const deletions = (loaded: PersonId[], p: PersonId, other?: PersonId) =>
  rowsOf(loaded, 'device_events', p).filter((r) => r.fields.event_type === 'thread_deleted' && (!other || String(r.fields.detail).includes(NUMBERS[other])))

const quote = (r: EvidenceRow) => (r.fields.body ? `“${r.fields.body}”` : r.table === 'calls' ? `call ${r.fields.duration_s ? `${r.fields.duration_s} s` : 'not answered'}` : r.summary)
const when = (iso: string) => `${fmtDate(iso)} ${fmtTime(iso)}`
const range = (a: string, b: string) => `${fmtDate(a)} ${fmtTime(a)}–${a.slice(0, 10) === b.slice(0, 10) ? '' : `${fmtDate(b)} `}${fmtTime(b)}`
/** End a sentence without doubling the full stop after a quoted sentence. */
const dot = (s: string) => (/[.!?]”$/.test(s) ? s : `${s}.`)
const mins = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)

// ---------------------------------------------------------------------------------------------
// Reusable checks
// ---------------------------------------------------------------------------------------------

function contactCheck(id: string, a: PersonId, b: PersonId, opts: { from?: string; to?: string; label?: string; strength?: Strength; ifFound: 'contradicts' | 'supports'; ifNone: Exclude<Outcome, 'blocked'>; noneText?: string; needs?: 'any' | 'own' }): CheckSpec {
  const { from = ts(13, 0, 0), to = ts(20, 0, 0) } = opts
  const own = opts.needs === 'own'
  return {
    id,
    label: opts.label ?? `Calls and texts between ${personName(a)} and ${personName(b)}`,
    method: `Match every call and message between the two numbers${own ? '' : ' on any examined phone'}, ${fmtDate(from)}–${fmtDate(to)}; a copy on both phones counts once.`,
    strength: opts.strength ?? 'strong',
    needs: own ? { any: [a, b].filter((p) => p !== 'ravi'), what: `${personName(a)}'s or ${personName(b)}'s own call and message logs` } : { any: [a, b], what: `call and message logs for ${personName(a)} or ${personName(b)}` },
    run: (loaded) => {
      const rows = contactsBetween(loaded, a, b, from, to)
      if (!rows.length) return { outcome: opts.ifNone, found: opts.noneText ?? 'None found.', evidence_ids: [] }
      const calls = rows.filter((r) => r.table === 'calls').length
      const last = rows[rows.length - 1]
      return {
        outcome: opts.ifFound,
        found: `${rows.length} found (${rows.length - calls} text${rows.length - calls === 1 ? '' : 's'}, ${calls} call${calls === 1 ? '' : 's'}). Latest ${when(last.timestamp)}: ${dot(quote(last))}`,
        evidence_ids: rows.slice(-8).map((r) => r.id),
      }
    },
  }
}

function deletionCheck(id: string, p: PersonId, other: PersonId, outcome: 'contradicts', strength: Strength): CheckSpec {
  return {
    id,
    label: `Deleted threads with ${personName(other)} on ${personName(p)}'s phone`,
    method: `Look for thread_deleted events on ${personName(p)}'s phone that name ${personName(other)}'s number.`,
    strength,
    needs: { all: [p], what: `${personName(p)}'s device log` },
    run: (loaded) => {
      const d = deletions(loaded, p, other)
      if (!d.length) return { outcome: 'inconclusive', found: 'No deletion events found.', evidence_ids: [] }
      return { outcome, found: `${d.map((r) => `${String(r.fields.detail).split(' with ')[0]} deleted ${when(r.timestamp)}`).join('; ')}. A deleted thread means one existed.`, evidence_ids: d.map((r) => r.id) }
    },
  }
}

function togetherCheck(id: string, a: PersonId, b: PersonId, strength: Strength, describe: (n: number) => { outcome: Exclude<Outcome, 'blocked'>; note: string }): CheckSpec {
  return {
    id,
    label: `${personName(a)} and ${personName(b)} in the same place`,
    method: 'Location fixes from both phones in the same 10-minute slot and within 100 m, grouped into occasions of 20 min or more; homes excluded.',
    strength,
    needs: { all: [a, b], what: `location data for both ${personName(a)} and ${personName(b)}` },
    run: (loaded) => {
      const occ = together(loaded, a, b)
      const d = describe(occ.length)
      if (!occ.length) return { outcome: d.outcome, found: `No occasions. ${d.note}`, evidence_ids: [] }
      return {
        outcome: d.outcome,
        found: `${occ.length} occasion${occ.length > 1 ? 's' : ''}: ${occ.map((o) => `${o.place}, ${range(o.start, o.end)} (${mins(o.start, o.end) + 10} min)`).join('; ')}. ${d.note}`,
        evidence_ids: occ.flatMap((o) => o.ids).slice(0, 12),
      }
    },
  }
}

function eveningFixes(id: string, p: PersonId, from: string, to: string, opts: { home: boolean }): CheckSpec {
  return {
    id,
    label: `${personName(p)}'s location ${fmtTime(from)}–${fmtTime(to)}, ${fmtDate(from)}`,
    method: `Every location fix from ${personName(p)}'s phone in the period, by place.`,
    strength: 'strong',
    needs: { all: [p], what: `${personName(p)}'s location data` },
    run: (loaded) => {
      const f = fixes(loaded, p, from, to)
      if (!f.length) return { outcome: 'inconclusive', found: 'No fixes in the period.', evidence_ids: [] }
      const home = HOME[p]
      const away = f.filter((r) => placeOf(r) !== home)
      const atHome = f.length - away.length
      if (opts.home) {
        if (!away.length) return { outcome: 'supports', found: `${pct(atHome, f.length)} fixes at ${home}; none elsewhere.`, evidence_ids: [f[0].id, f[f.length - 1].id] }
        const far = away.reduce((m, r) => (sceneDist(r) < sceneDist(m) ? r : m), away[0])
        return {
          outcome: 'contradicts',
          found: `${away.length} fix${away.length > 1 ? 'es' : ''} away from home, from ${fmtTime(away[0].timestamp)}. Closest to ${SCENE.name}: ${placeOf(far)} at ${fmtTime(far.timestamp)}, ${fmtKm(sceneDist(far))} away.`,
          evidence_ids: away.map((r) => r.id).slice(0, 8),
        }
      }
      return { outcome: 'supports', found: `${f.length} fixes: ${summarisePlaces(f)}.`, evidence_ids: [f[0].id, f[f.length - 1].id] }
    },
  }
}

function summarisePlaces(f: EvidenceRow[]) {
  const runs: { place: string; start: string; end: string }[] = []
  for (const r of f) {
    const pl = placeOf(r)
    const last = runs[runs.length - 1]
    if (last && last.place === pl) last.end = r.timestamp
    else runs.push({ place: pl, start: r.timestamp, end: r.timestamp })
  }
  return runs
    .filter((x) => x.place !== 'in transit')
    .map((x) => `${x.place} ${fmtTime(x.start)}–${fmtTime(x.end)}`)
    .join(', ')
}

function gapCheck(id: string, p: PersonId, from: string, to: string): CheckSpec {
  return {
    id,
    label: `Gaps in ${personName(p)}'s location, ${fmtTime(from)}–${fmtTime(to)}`,
    method: 'Location gaps of 45 min or more, with whether the phone was off or still in use.',
    strength: 'weak',
    needs: { all: [p], what: `${personName(p)}'s location data` },
    run: (loaded) => {
      const g = gapsIn(p, from, to)
      if (!g.length) return { outcome: 'supports', found: 'No gaps: the phone reported its location throughout.', evidence_ids: [] }
      return {
        outcome: 'inconclusive',
        found: g
          .map((x) => `No location ${range(x.start, x.end)} (${x.minutes} min): ${x.gap_type === 'powered_off' ? 'phone switched off' : x.gap_type === 'location_off' ? `location off while the phone was in use (${x.activity.length} calls or texts)` : 'no activity'}`)
          .join('; ') + '. Neither confirms nor rules out the claim for that period.',
        evidence_ids: g.flatMap((x) => [x.bounding.before.id, x.bounding.after.id]),
      }
    },
  }
}

// ---------------------------------------------------------------------------------------------
// The three transcripts
// ---------------------------------------------------------------------------------------------

const EVE = { from: ts(16, 18, 0), to: ts(16, 23, 59) }

const AMY: Transcript = {
  id: 'amy-0418',
  person: 'amy',
  interviewee: 'Amy Brooks',
  at: ts(18, 14, 0),
  interviewer: 'Det. R. Ortiz',
  place: 'Port Calder PD, room 2',
  minutes: 22,
  file: 'interview_brooks_2026-04-18.txt',
  turns: [
    { who: 'Q', parts: ['When did you last speak to Ravi?'] },
    { who: 'A', parts: [{ claim: 'A1' }, ' Not since we separated, really.'] },
    { who: 'Q', parts: ['Where were you on the evening of the 16th?'] },
    { who: 'A', parts: [{ claim: 'A2' }, ' ', { opinion: 'I was exhausted.' }, ' I watched something and went to bed.'] },
    { who: 'Q', parts: ['Do you know Ken Walsh?'] },
    { who: 'A', parts: [{ claim: 'A3' }, ' He worked for Ravi, that’s all I know.'] },
    { who: 'Q', parts: ['Has Paul Becker ever given you money?'] },
    { who: 'A', parts: [{ claim: 'A4' }] },
    { who: 'Q', parts: ['After you heard the news, did you delete anything from your phone?'] },
    { who: 'A', parts: [{ claim: 'A5' }, ' ', { opinion: 'I had nothing to hide.' }] },
  ],
  claims: [
    {
      id: 'A1',
      quote: 'We hadn’t spoken in weeks.',
      tests: 'No calls or texts between Amy and Ravi in the weeks before his death.',
      expected: 'disproven',
      checks: [
        contactCheck('a1-contact', 'amy', 'ravi', { ifFound: 'contradicts', ifNone: 'supports', noneText: 'No calls or texts in the week.' }),
        deletionCheck('a1-del', 'amy', 'ravi', 'contradicts', 'weak'),
      ],
    },
    {
      id: 'A2',
      quote: 'I was at home all evening.',
      tests: 'Amy’s phone stayed at the Brooks residence from 18:00 to midnight on 16 April.',
      expected: 'unverified',
      checks: [
        { ...eveningFixes('a2-fix', 'amy', EVE.from, EVE.to, { home: true }), strength: 'weak' },
        gapCheck('a2-gap', 'amy', EVE.from, EVE.to),
      ],
    },
    {
      id: 'A3',
      quote: 'I don’t know Ken. I’ve never met him.',
      tests: 'No sign that Amy and Ken know each other: no shared groups, no meetings, no contact.',
      expected: 'disproven',
      checks: [
        {
          id: 'a3-group',
          label: 'Shared group chats',
          method: 'Group threads on any examined phone that list both numbers as members; count what each wrote and whether they address each other.',
          strength: 'strong',
          needs: { any: GROUP.members, what: `a phone that is in a group with Amy or Ken` },
          run: (loaded) => {
            const rows = rowsOf(loaded, 'messages').filter((r) => r.fields.group && String(r.fields.members).includes(NUMBERS.amy) && String(r.fields.members).includes(NUMBERS.ken))
            const uniq = [...new Map(rows.map((r) => [`${r.timestamp}|${r.fields.body}`, r])).values()]
            if (!uniq.length) return { outcome: 'inconclusive', found: 'No shared groups on the examined phones.', evidence_ids: [] }
            const by = (p: PersonId) => uniq.filter((r) => r.fields.from === NUMBERS[p])
            const direct = by('amy').filter((r) => /\bken\b/i.test(String(r.fields.body)))
            return {
              outcome: 'contradicts',
              found: `Both are members of ${GROUP.app} group “${GROUP.name}” (${GROUP.members.length} members). Amy wrote ${by('amy').length} messages, Ken ${by('ken').length}. Amy addresses Ken directly ${direct.length} times, e.g. ${dot(quote(direct[0]))}`,
              evidence_ids: [...direct, ...by('ken')].map((r) => r.id),
            }
          },
        },
        togetherCheck('a3-together', 'amy', 'ken', 'weak', (n) => (n ? { outcome: 'contradicts', note: 'A supermarket at rush hour; on its own this could be chance.' } : { outcome: 'inconclusive', note: '' })),
        contactCheck('a3-contact', 'amy', 'ken', { label: 'Direct calls or texts between Amy and Ken', strength: 'weak', ifFound: 'contradicts', ifNone: 'inconclusive', noneText: 'None. Absence of calls does not show two people have never met.', needs: 'own' }),
      ],
    },
    {
      id: 'A4',
      quote: 'Paul paid me back for lunch once. Fifty dollars. That’s it.',
      tests: 'The only money between Paul and Amy is one $50 payment for lunch.',
      expected: 'verified',
      checks: [
        {
          id: 'a4-money',
          label: 'Payments between Paul and Amy',
          method: 'Every payment-app transaction between the two numbers on any examined phone; a copy on both phones counts once.',
          strength: 'strong',
          needs: { any: ['paul', 'amy'], what: 'Paul’s or Amy’s payment records' },
          run: (loaded) => {
            const t = transfersBetween(loaded, 'paul', 'amy')
            if (!t.length) return { outcome: 'contradicts', found: 'No payments at all between them.', evidence_ids: [] }
            const one = t.length === 1 && Number(t[0].fields.amount) === 50
            return {
              outcome: one ? 'supports' : 'contradicts',
              found: `${t.length} payment${t.length > 1 ? 's' : ''}: ${t.map((r) => `$${r.fields.amount} on ${when(r.timestamp)}, memo “${r.fields.memo}”`).join('; ')}.`,
              evidence_ids: t.map((r) => r.id),
            }
          },
        },
      ],
    },
    {
      id: 'A5',
      quote: 'No. I haven’t deleted anything.',
      tests: 'Nothing was deleted from Amy’s phone after the news on 17 April.',
      expected: 'disproven',
      checks: [
        {
          id: 'a5-events',
          label: 'Deletion events on Amy’s phone',
          method: 'thread_deleted events in Amy’s device log after the news alert (17 Apr 09:05).',
          strength: 'strong',
          needs: { all: ['amy'], what: 'Amy’s device log' },
          run: (loaded) => {
            const d = rowsOf(loaded, 'device_events', 'amy').filter((r) => r.fields.event_type === 'thread_deleted' && r.timestamp >= ts(17, 9, 5))
            if (!d.length) return { outcome: 'supports', found: 'No deletion events.', evidence_ids: [] }
            return { outcome: 'contradicts', found: d.map((r) => `${r.fields.detail}, deleted ${when(r.timestamp)}, ${mins(ts(17, 9, 5), r.timestamp)} min after the alert`).join('; ') + '.', evidence_ids: d.map((r) => r.id) }
          },
        },
        {
          id: 'a5-cross',
          label: 'Texts on Ravi’s phone missing from Amy’s',
          method: 'For each text between them on Ravi’s phone, look for the same message (±2 s) on Amy’s phone.',
          strength: 'strong',
          needs: { all: ['ravi', 'amy'], what: 'both Ravi’s and Amy’s message logs' },
          run: (loaded) => {
            const onRavi = rowsOf(loaded, 'messages', 'ravi').filter((r) => [r.fields.from, r.fields.to].includes(NUMBERS.amy))
            const onAmy = new Set(rowsOf(loaded, 'messages', 'amy').map((r) => r.timestamp.slice(0, 19)))
            const missing = onRavi.filter((r) => !onAmy.has(r.timestamp.slice(0, 19)))
            if (!missing.length) return { outcome: 'supports', found: 'Every text on Ravi’s phone is also on Amy’s.', evidence_ids: [] }
            return { outcome: 'contradicts', found: `${pct(missing.length, onRavi.length)} texts on Ravi’s phone are not on Amy’s, all from ${fmtDate(missing[0].timestamp)}. Latest: ${dot(quote(missing[missing.length - 1]))}`, evidence_ids: missing.map((r) => r.id) }
          },
        },
      ],
    },
  ],
}

const PAUL: Transcript = {
  id: 'paul-0417',
  person: 'paul',
  interviewee: 'Paul Becker',
  at: ts(17, 16, 30),
  interviewer: 'Det. R. Ortiz',
  place: 'Port Calder PD, room 1',
  minutes: 31,
  file: 'interview_becker_2026-04-17.txt',
  turns: [
    { who: 'Q', parts: ['Talk me through the 16th, after work.'] },
    { who: 'A', parts: [{ claim: 'P1' }, ' ', { claim: 'P2' }, ' ', { opinion: 'It was a normal evening.' }] },
    { who: 'Q', parts: ['Did Ravi contact you that day?'] },
    { who: 'A', parts: [{ claim: 'P3' }] },
    { who: 'Q', parts: ['Your phone was off for part of the evening. Why?'] },
    { who: 'A', parts: [{ claim: 'P4' }] },
    { who: 'Q', parts: ['How well do you know Cara Novak?'] },
    { who: 'A', parts: [{ claim: 'P5' }, ' ', { opinion: 'She’s always been professional.' }] },
  ],
  claims: [
    {
      id: 'P1',
      quote: 'I left the office around half five and went straight home.',
      tests: 'Paul’s phone left Harbor Supply Co. about 17:30 and went to the Becker residence.',
      expected: 'verified',
      checks: [eveningFixes('p1-fix', 'paul', ts(16, 17, 0), ts(16, 18, 30), { home: false })],
    },
    {
      id: 'P2',
      quote: 'I was home the rest of the night.',
      tests: 'Paul’s phone stayed at the Becker residence from 18:00 to midnight on 16 April.',
      expected: 'disproven',
      checks: [eveningFixes('p2-fix', 'paul', EVE.from, EVE.to, { home: true }), gapCheck('p2-gap', 'paul', EVE.from, EVE.to)],
    },
    {
      id: 'P3',
      quote: 'No. I didn’t hear from him at all that day.',
      tests: 'No calls or texts between Ravi and Paul on 16 April.',
      expected: 'disproven',
      checks: [
        contactCheck('p3-contact', 'paul', 'ravi', { from: ts(16, 0, 0), to: ts(16, 23, 59), label: 'Calls and texts between Paul and Ravi on 16 April', ifFound: 'contradicts', ifNone: 'supports' }),
        deletionCheck('p3-del', 'paul', 'ravi', 'contradicts', 'weak'),
      ],
    },
    {
      id: 'P4',
      quote: 'The battery died. It does that.',
      tests: 'Paul’s phone switched off on 16 April because its battery ran out.',
      expected: 'disproven',
      checks: [
        {
          id: 'p4-reason',
          label: 'Shutdown reason in Paul’s device log',
          method: 'The OS records why the phone turned off. Compare with a real battery shutdown on another phone (Ravi’s: “Battery depleted (0%)”).',
          strength: 'strong',
          needs: { all: ['paul'], what: 'Paul’s device log' },
          run: (loaded) => {
            const off = rowsOf(loaded, 'device_events', 'paul').filter((r) => r.fields.event_type === 'power_off' && r.timestamp.startsWith('2026-04-16'))
            if (!off.length) return { outcome: 'inconclusive', found: 'No shutdown recorded on 16 April.', evidence_ids: [] }
            const battery = off.some((r) => /battery/i.test(String(r.fields.detail)))
            const on = rowsOf(loaded, 'device_events', 'paul').find((r) => r.fields.event_type === 'power_on' && r.timestamp > off[0].timestamp)
            return {
              outcome: battery ? 'supports' : 'contradicts',
              found: `Off at ${fmtTime(off[0].timestamp)}, recorded as “${off[0].fields.detail}”, not a battery shutdown.${on ? ` Back on at ${fmtTime(on.timestamp)}, ${mins(off[0].timestamp, on.timestamp)} min later.` : ''}`,
              evidence_ids: [off[0].id, ...(on ? [on.id] : [])],
            }
          },
        },
        {
          id: 'p4-low',
          label: 'Low-battery warnings before the shutdown',
          method: 'battery_low events on Paul’s phone in the two hours before it turned off.',
          strength: 'weak',
          needs: { all: ['paul'], what: 'Paul’s device log' },
          run: (loaded) => {
            const low = rowsOf(loaded, 'device_events', 'paul').filter((r) => r.fields.event_type === 'battery_low' && r.timestamp >= ts(16, 19, 16) && r.timestamp <= ts(16, 21, 16))
            return low.length ? { outcome: 'supports', found: `${low.length} warnings.`, evidence_ids: low.map((r) => r.id) } : { outcome: 'contradicts', found: 'None recorded. The phone made a 64 s call 18 min before it turned off.', evidence_ids: [] }
          },
        },
      ],
    },
    {
      id: 'P5',
      quote: 'She’s a supplier. I only deal with her over email.',
      tests: 'Paul and Cara’s only contact is business email: no calls, texts, meetings or private payments.',
      expected: 'disproven',
      checks: [
        contactCheck('p5-contact', 'paul', 'cara', { label: 'Calls and texts between Paul and Cara', strength: 'weak', ifFound: 'contradicts', ifNone: 'supports', noneText: 'None, consistent with email only.' }),
        {
          id: 'p5-money',
          label: 'Payments between Paul and Cara',
          method: 'Payment-app transactions between the two numbers, and whether money came back within 24 h.',
          strength: 'weak',
          needs: { any: ['paul', 'cara'], what: 'Paul’s or Cara’s payment records' },
          run: (loaded) => {
            const t = transfersBetween(loaded, 'paul', 'cara')
            if (!t.length) return { outcome: 'supports', found: 'No payments.', evidence_ids: [] }
            return {
              outcome: t.length > 1 ? 'contradicts' : 'inconclusive',
              found: `${t.map((r) => `$${Number(r.fields.amount).toLocaleString()} ${byNumber.get(String(r.fields.from)) === 'paul' ? 'Paul → Cara' : 'Cara → Paul'} ${when(r.timestamp)} (“${r.fields.memo}”)`).join('; ')}.${t.length > 1 ? ' A supplier invoice that is mostly sent back the same day is not ordinary business.' : ''}`,
              evidence_ids: t.map((r) => r.id),
            }
          },
        },
        deletionCheck('p5-del', 'paul', 'cara', 'contradicts', 'weak'),
        togetherCheck('p5-together', 'paul', 'cara', 'strong', (n) => (n >= 2 ? { outcome: 'contradicts', note: 'Repeated meetings, never at either workplace.' } : n ? { outcome: 'inconclusive', note: 'Once only.' } : { outcome: 'supports', note: '' })),
      ],
    },
  ],
}

const KEN: Transcript = {
  id: 'ken-0418',
  person: 'ken',
  interviewee: 'Ken Walsh',
  at: ts(18, 10, 0),
  interviewer: 'Det. S. Laine',
  place: 'Port Calder PD, room 1',
  minutes: 18,
  file: 'interview_walsh_2026-04-18.txt',
  turns: [
    { who: 'Q', parts: ['Where were you on the evening of the 16th?'] },
    { who: 'A', parts: [{ claim: 'K1' }] },
    { who: 'Q', parts: ['When were you last at Pier 9?'] },
    { who: 'A', parts: [{ claim: 'K2' }, ' ', { opinion: 'I wasn’t welcome there any more.' }] },
    { who: 'Q', parts: ['Did you say anything about Ravi after you were let go?'] },
    { who: 'A', parts: [{ opinion: 'I was angry.' }, ' ', { claim: 'K3' }] },
  ],
  claims: [
    {
      id: 'K1',
      quote: 'At the gym from about eight until ten, then home.',
      tests: 'Ken’s phone was at Riverside Gym about 20:00–22:00 on 16 April, then at the Walsh residence.',
      expected: 'verified',
      checks: [
        eveningFixes('k1-fix', 'ken', ts(16, 19, 30), ts(16, 23, 30), { home: false }),
        {
          id: 'k1-dist',
          label: 'Ken’s closest approach to Pier 9 in the time-of-death window',
          method: 'Smallest distance from Pier 9 across Ken’s fixes, 21:00–23:30.',
          strength: 'weak',
          needs: { all: ['ken'], what: 'Ken’s location data' },
          run: (loaded) => {
            const f = fixes(loaded, 'ken', ts(16, 21, 0), ts(16, 23, 30))
            if (!f.length) return { outcome: 'inconclusive', found: 'No fixes in the window.', evidence_ids: [] }
            const m = f.reduce((a, r) => (sceneDist(r) < sceneDist(a) ? r : a), f[0])
            return { outcome: sceneDist(m) > 2000 ? 'supports' : 'contradicts', found: `Never closer than ${fmtKm(sceneDist(m))} (${placeOf(m)}, ${fmtTime(m.timestamp)}).`, evidence_ids: [m.id] }
          },
        },
        gapCheck('k1-gap', 'ken', ts(16, 19, 30), ts(16, 23, 30)),
      ],
    },
    {
      id: 'K2',
      quote: 'Not since they let me go on the 14th.',
      tests: 'No fixes from Ken’s phone at Pier 9 after his dismissal on 14 April.',
      expected: 'verified',
      checks: [
        {
          id: 'k2-pier',
          label: 'Ken’s fixes within 150 m of Pier 9',
          method: 'Every fix from Ken’s phone within 150 m of the warehouse, before and after the dismissal text (14 Apr 16:20).',
          strength: 'strong',
          needs: { all: ['ken'], what: 'Ken’s location data' },
          run: (loaded) => {
            const all = rowsOf(loaded, 'locations', 'ken').filter((r) => sceneDist(r) <= 150)
            const after = all.filter((r) => r.timestamp > ts(14, 16, 20))
            const before = all.filter((r) => r.timestamp <= ts(14, 16, 20))
            if (after.length) return { outcome: 'contradicts', found: `${after.length} fixes at Pier 9 after the dismissal, first ${when(after[0].timestamp)}.`, evidence_ids: after.slice(0, 8).map((r) => r.id) }
            return { outcome: 'supports', found: `${before.length} fixes at Pier 9, the last ${when(before[before.length - 1].timestamp)}. None after.`, evidence_ids: before.slice(-2).map((r) => r.id) }
          },
        },
        gapCheck('k2-gap', 'ken', ts(14, 16, 20), ts(19, 23, 59)),
      ],
    },
    {
      id: 'K3',
      quote: 'I never said anything about him publicly.',
      tests: 'No public posts or comments by Ken about Ravi after 14 April.',
      expected: 'disproven',
      checks: [
        {
          id: 'k3-posts',
          label: 'Ken’s public posts and comments about Ravi',
          method: `Every post, comment and reply by Ken naming or replying to Ravi, scored by ${HOSTILE.model}.`,
          strength: 'strong',
          needs: { all: ['ken'], what: 'Ken’s social media data' },
          run: () => ({
            outcome: 'contradicts',
            found: `${HOSTILE.items.length} public posts or replies about Ravi, ${HOSTILE.flagged} scored ≥ ${HOSTILE.threshold} for hostility. Highest: ${dot(`“${[...HOSTILE.items].sort((a, b) => b.score - a.score)[0].text}”`)}`,
            evidence_ids: HOSTILE.items.map((i) => i.id),
          }),
        },
      ],
    },
  ],
}

export const TRANSCRIPTS: Transcript[] = [PAUL, AMY, KEN]
export const transcriptOf = (id: string) => TRANSCRIPTS.find((t) => t.id === id)!

export function verifyTranscript(t: Transcript, loaded: PersonId[]) {
  const results = t.claims.map((c) => scoreClaim(c, loaded))
  const decided = results.filter((r) => r.verdict !== 'unverified')
  const planned = results.reduce((n, r) => n + r.checks.length, 0)
  const ran = results.reduce((n, r) => n + r.ran, 0)
  return {
    results,
    counts: { verified: results.filter((r) => r.verdict === 'verified').length, unverified: results.filter((r) => r.verdict === 'unverified').length, disproven: results.filter((r) => r.verdict === 'disproven').length },
    mean_confidence: decided.length ? decided.reduce((a, r) => a + r.confidence, 0) / decided.length : null,
    planned,
    ran,
  }
}
