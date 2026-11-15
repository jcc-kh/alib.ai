// Semantic analysis over everything people on the board wrote: public posts and comments, and the texts
// between them (including group chats). Each statement is tagged with themes by fixed phrase rules (a
// stand-in for a semantic model; the rules are shown in the UI) and, for posts, the hostility score.

import type { PersonId } from '../api/types'
import { ALL_PHONES, NUMBERS, PEOPLE, ROWS, personName } from './data'

export type ThemeId = 'threat' | 'grievance' | 'meeting' | 'money' | 'pressure'

export const THEMES: { id: ThemeId; label: string; what: string; color: string; rule: RegExp }[] = [
  { id: 'threat', label: 'Threats or ill-wishing', what: 'wishing harm or a comeuppance on someone', color: 'var(--serious)', rule: /get what'?s coming|karma|costs them|enjoy it while it lasts|remember that name|only learn/gi },
  { id: 'grievance', label: 'Grievance or blame', what: 'a wrong someone feels was done to them', color: 'var(--amber)', rule: /walks me out|cardboard box|'?missing'? stock|lied|always say that|done waiting|not your call|honesty isn'?t optional|cleaning house/gi },
  { id: 'meeting', label: 'Arranging to meet', what: 'a time or place to meet, especially that night', color: 'var(--accent)', rule: /tonight|\b\d{1,2}:\d{2}\b|come alone|at the warehouse|tomorrow|drinks at/gi },
  { id: 'money', label: 'Money and accounts', what: 'invoices, ledgers, stock or debts', color: 'var(--good)', rule: /invoices?|ledger|novak|'?missing'? stock/gi },
  { id: 'pressure', label: 'Pressure or distress', what: 'insisting, pleading or breaking off', color: 'var(--warning)', rule: /answer your phone|not tonight|done being|need to talk|sort this out|sorry about/gi },
]

export interface Statement {
  id: string
  t: string
  speaker: PersonId
  /** "public post", "text to Paul", "Harbor crew group". */
  audience: string
  channel: 'post' | 'text'
  text: string
  /** People on the board named or addressed. */
  about: PersonId[]
  themes: ThemeId[]
  /** Matched phrases per theme, for highlighting. */
  matches: { theme: ThemeId; phrase: string }[]
  /** Hostility classifier score (posts only). */
  score: number | null
}

const byNumber = new Map(Object.entries(NUMBERS).map(([p, n]) => [n, p as PersonId]))
const handleOf = new Map(PEOPLE.map((p) => [p.handle, p.person_id]))

function tag(text: string) {
  const matches: Statement['matches'] = []
  for (const th of THEMES) for (const m of text.matchAll(th.rule)) matches.push({ theme: th.id, phrase: m[0] })
  return { matches, themes: [...new Set(matches.map((m) => m.theme))] }
}

function mentioned(text: string, loaded: PersonId[], extra: (PersonId | null)[]) {
  const named = loaded.filter((p) => new RegExp(`\\b${personName(p)}\\b`, 'i').test(text))
  return [...new Set([...named, ...extra.filter((x): x is PersonId => !!x && loaded.includes(x))])]
}

/** Every statement by people on the board, oldest first. */
export function statementsFor(loaded: PersonId[]): Statement[] {
  const out = new Map<string, Statement>()
  for (const r of ROWS.values()) {
    if (!loaded.includes(r.device_owner)) continue
    if (r.table === 'social_interactions' && r.fields.text) {
      const text = String(r.fields.text)
      const target = r.fields.target ? (handleOf.get(String(r.fields.target)) ?? (ALL_PHONES.includes(String(r.fields.target)) ? String(r.fields.target) : null)) : null
      out.set(r.id, { id: r.id, t: r.timestamp, speaker: r.device_owner, audience: `public ${r.fields.kind ?? 'post'}`, channel: 'post', text, about: mentioned(text, loaded, [target]), ...tag(text), score: r.fields.hostility === undefined ? null : Number(r.fields.hostility) })
      continue
    }
    if (r.table !== 'messages' || !r.fields.body) continue
    const from = byNumber.get(String(r.fields.from))
    if (!from || !loaded.includes(from)) continue
    const group = r.fields.group ? String(r.fields.group) : null
    const to = group ? null : byNumber.get(String(r.fields.to))
    if (!group && (!to || !loaded.includes(to))) continue
    const key = `${r.timestamp.slice(0, 19)}|${r.fields.body}`
    if (out.has(key)) continue
    const text = String(r.fields.body)
    out.set(key, { id: r.id, t: r.timestamp, speaker: from, audience: group ? `${group} group` : `text to ${personName(to!)}`, channel: 'text', text, about: mentioned(text, loaded, [to ?? null]).filter((p) => p !== from), ...tag(text), score: null })
  }
  return [...out.values()].sort((a, b) => a.t.localeCompare(b.t))
}
