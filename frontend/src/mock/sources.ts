// Evidence sources and the case board computed from them.
// The board is a pure function of which sources are loaded: every graph, map, grid and insight is
// recomputed from the rows of the loaded phones only, so adding a source genuinely adds evidence.
// In the real system this is GET /api/board after POST /api/sources (see ARCHITECTURE §10).

import './background'
import type { Channel, EvidenceTable, Graph, GraphEdge, Incident, PersonId, PresenceOutput, Segment, SpaceOutput } from '../api/types'
import { ALL_PHONES, NUMBERS, PEOPLE, RELATIONS, ROWS, pairKey, personName } from './data'
import { PRESENCE, SPACE, graphFor } from './derived'
import { SEGMENTS } from './segments'
import { SCENARIOS, SIGNAL_OF, type ScenarioId } from './findings'
import { incidentsFor } from './signals'
import { countsFor } from './background'
import { EXTRACTED, MODELS } from './ingest'

// ---------------------------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------------------------

export interface EvidenceSource {
  id: PersonId
  label: string
  kind: 'phone'
  model: string
  extracted_at: string
  tables: Record<EvidenceTable, number>
  rows: number
}

export const SOURCES: EvidenceSource[] = PEOPLE.map((p) => {
  const tables = countsFor(p.person_id)
  return {
    id: p.person_id,
    label: `${personName(p.person_id)}'s phone`,
    kind: 'phone',
    model: MODELS[p.person_id],
    extracted_at: EXTRACTED[p.person_id],
    tables,
    rows: Object.values(tables).reduce((a, b) => a + b, 0),
  }
})
export const sourceOf = (id: PersonId) => SOURCES.find((s) => s.id === id)!
/** Exhibit number for a seized phone. Until a phone is examined its owner is not shown. */
export const exhibitOf = (id: PersonId) => `Phone ${ALL_PHONES.indexOf(id) + 1}`
export const phoneLabel = (id: PersonId, known: boolean) => (known ? `${personName(id)}'s phone` : exhibitOf(id))

/** The board opens on the victim's phone (recovered at the scene) and Paul's. */
export const START: PersonId[] = ['ravi', 'paul']
/** The order in which the remaining phones arrive in the demo. */
export const QUEUE: PersonId[] = ['amy', 'ken', 'cara']

const ALL_SIDS = Object.keys(SIGNAL_OF) as ScenarioId[]
/** A finding is unlocked once every phone it reads is loaded. */
export const unlockedFor = (loaded: PersonId[]) => ALL_SIDS.filter((sid) => SCENARIOS[sid].people.every((p) => loaded.includes(p)))

// ---------------------------------------------------------------------------------------------
// Relationships: one tie per pair, classified from the loaded rows
// ---------------------------------------------------------------------------------------------

export type TieLevel = 'close' | 'regular' | 'acquaintance' | 'hidden'
/** Calls + texts in the week (copies on both phones counted once). */
export const TIE_RULE = { close: 8, regular: 3 }

export interface Tie {
  key: string
  a: PersonId
  b: PersonId
  level: TieLevel
  /** Relationship from the case file if declared, otherwise what the rows show. */
  label: string
  declared: boolean
  contacts: number
  /** Saved in at least one loaded phone's contacts. */
  saved: boolean
  /** Notable channels besides calls and texts. */
  flags: Channel[]
  edges: GraphEdge[]
  evidence_ids: string[]
}

export interface Mutual {
  key: string
  a: PersonId
  b: PersonId
  via: PersonId[]
}

const FLAG_ORDER: Channel[] = ['transfer', 'colocation', 'deleted_thread', 'hostile', 'social']

function tiesFor(graph: Graph, loaded: PersonId[]): Tie[] {
  const byPair = new Map<string, GraphEdge[]>()
  for (const e of graph.edges) {
    if (e.weak) continue
    const k = pairKey(e.source, e.target)
    byPair.set(k, [...(byPair.get(k) ?? []), e])
  }
  // Saved contacts on loaded phones that point at another case person.
  const saved = new Set<string>()
  const numToPerson = new Map(Object.entries(NUMBERS).map(([p, n]) => [n, p as PersonId]))
  for (const r of ROWS.values()) {
    if (r.table !== 'contacts' || !loaded.includes(r.device_owner)) continue
    const other = numToPerson.get(String(r.fields.number))
    if (other && other !== r.device_owner) {
      const k = pairKey(r.device_owner, other)
      saved.add(k)
      if (!byPair.has(k)) byPair.set(k, [])
    }
  }
  return [...byPair.entries()].map(([key, edges]) => {
    const [a, b] = key.split('|') as [PersonId, PersonId]
    const contacts = edges.filter((e) => e.channel === 'call' || e.channel === 'message').reduce((n, e) => n + e.count, 0)
    const flags = FLAG_ORDER.filter((c) => edges.some((e) => e.channel === c))
    const level: TieLevel = contacts === 0 && flags.includes('colocation') ? 'hidden' : contacts >= TIE_RULE.close ? 'close' : contacts >= TIE_RULE.regular ? 'regular' : 'acquaintance'
    const inferred =
      level === 'hidden'
        ? 'Meet, never call or text'
        : contacts >= TIE_RULE.close
          ? 'Close contact'
          : contacts >= TIE_RULE.regular
            ? 'Regular contact'
            : contacts > 0
              ? 'Occasional contact'
              : flags.includes('transfer')
                ? 'Money only'
                : flags.includes('social')
                  ? 'Follows on social'
                  : 'Saved contact'
    // The case file's description of a relationship is only shown once both phones are examined.
    const declared = loaded.includes(a) && loaded.includes(b) ? RELATIONS[key] : undefined
    return {
      key,
      a,
      b,
      level,
      label: declared ?? inferred,
      declared: !!declared,
      contacts,
      saved: saved.has(key),
      flags,
      edges,
      evidence_ids: edges.flatMap((e) => e.evidence_ids),
    }
  })
}

function mutualsFor(ties: Tie[], people: PersonId[]): Mutual[] {
  const has = (x: PersonId, y: PersonId) => ties.some((t) => t.key === pairKey(x, y))
  const out: Mutual[] = []
  for (let i = 0; i < people.length; i++)
    for (let j = i + 1; j < people.length; j++) {
      const [a, b] = [people[i], people[j]]
      if (has(a, b)) continue
      const via = people.filter((c) => c !== a && c !== b && has(a, c) && has(b, c))
      if (via.length) out.push({ key: pairKey(a, b), a, b, via })
    }
  return out
}

// ---------------------------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------------------------

export interface Board {
  loaded: PersonId[]
  /** Always empty: people are not shown until their own phone is examined. Kept for the API shape. */
  ghosts: PersonId[]
  graph: Graph
  ties: Tie[]
  mutuals: Mutual[]
  space: SpaceOutput
  presence: PresenceOutput
  segments: Segment[]
  incidents: Incident[]
  unlocked: ScenarioId[]
  rows: number
}

export function computeBoard(loaded: PersonId[]): Board {
  const order = ALL_PHONES.filter((p) => loaded.includes(p))
  // Only people whose phone has been examined are on the board, and only links between them: someone
  // who merely appears in an examined phone's contacts stays off the board until their own phone is added.
  const full = graphFor(order)
  const graph = { ...full, edges: full.edges.filter((e) => order.includes(e.source) && order.includes(e.target)) }
  const ties = tiesFor(graph, order).filter((t) => order.includes(t.a) && order.includes(t.b))
  const ghosts: PersonId[] = []
  const unlocked = unlockedFor(order)
  return {
    loaded: order,
    ghosts,
    graph,
    ties,
    mutuals: mutualsFor(ties, [...order, ...ghosts]),
    space: { ...SPACE, spaces: SPACE.spaces.filter((s) => order.includes(s.person)) },
    presence: { ...PRESENCE, phones: PRESENCE.phones.filter((p) => order.includes(p.person)) },
    segments: SEGMENTS.filter((s) => order.includes(s.person)),
    incidents: incidentsFor(unlocked),
    unlocked,
    rows: order.reduce((n, p) => n + sourceOf(p).rows, 0),
  }
}

// ---------------------------------------------------------------------------------------------
// What changed when a source was added (drives the drop-in animation and the summary toast)
// ---------------------------------------------------------------------------------------------

export interface BoardDiff {
  source: PersonId
  rows: number
  newGhosts: PersonId[]
  newTies: string[]
  /** Ties whose level, label or flags changed. */
  changedTies: string[]
  newIncidents: string[]
  /** Insights that gained findings. */
  strengthened: string[]
  newFindings: ScenarioId[]
}

export function diffBoard(prev: Board, next: Board, source: PersonId): BoardDiff {
  const prevTie = new Map(prev.ties.map((t) => [t.key, t]))
  const sig = (t: Tie) => `${t.level}|${t.label}|${t.flags.join(',')}`
  const prevInc = new Map(prev.incidents.map((i) => [i.incident_id, i.findings.length]))
  return {
    source,
    rows: next.rows - prev.rows,
    newGhosts: next.ghosts.filter((g) => !prev.ghosts.includes(g) && !prev.loaded.includes(g)),
    newTies: next.ties.filter((t) => !prevTie.has(t.key)).map((t) => t.key),
    changedTies: next.ties.filter((t) => prevTie.has(t.key) && sig(prevTie.get(t.key)!) !== sig(t)).map((t) => t.key),
    newIncidents: next.incidents.filter((i) => !prevInc.has(i.incident_id)).map((i) => i.incident_id),
    strengthened: next.incidents.filter((i) => prevInc.has(i.incident_id) && i.findings.length > prevInc.get(i.incident_id)!).map((i) => i.incident_id),
    newFindings: next.unlocked.filter((s) => !prev.unlocked.includes(s)),
  }
}
