import { useEffect, useState } from 'react'
import type { Board, BoardDiff, Channel, PersonId, Tie, TieLevel } from '../api'
import { PEOPLE, pairKey, personColor, personName } from '../mock/data'
import { TIE_RULE } from '../mock/sources'
import { fmtDate } from '../lib/format'

/**
 * Relationship chart: who is tied to whom, how strongly, and what kind of tie. One line per pair,
 * styled by tie strength (from calls and texts), labelled with the relationship, with the notable
 * channels (money, meetings without contact, deleted threads, hostility) as badges on the line.
 * People whose phone is not examined yet appear as unidentified nodes: a question mark and a first name.
 */
export const TIE_STYLE: Record<TieLevel, { stroke: string; width: number; dash?: string; label: string; rule: string }> = {
  close: { stroke: 'var(--ink-2)', width: 4.5, label: 'Close', rule: `${TIE_RULE.close}+ calls or texts in the week` },
  regular: { stroke: 'var(--ink-2)', width: 2.2, label: 'Regular', rule: `${TIE_RULE.regular}–${TIE_RULE.close - 1} calls or texts` },
  acquaintance: { stroke: 'var(--ink-3)', width: 1.6, dash: '2 5', label: 'Occasional', rule: 'a few contacts, or a saved number' },
  hidden: { stroke: 'var(--amber)', width: 3, dash: '9 6', label: 'Hidden', rule: 'meet in person, never call or text' },
}

export const FLAG_STYLE: Partial<Record<Channel, { glyph: string; color: string; label: string }>> = {
  transfer: { glyph: '$', color: 'var(--accent)', label: 'money' },
  colocation: { glyph: '◎', color: 'var(--amber)', label: 'met, no contact' },
  deleted_thread: { glyph: '✕', color: 'var(--serious)', label: 'thread deleted' },
  hostile: { glyph: '!', color: 'var(--serious)', label: 'hostile posts' },
}

// The victim on the left, everyone else on an arc, so no tie has to pass through a person.
const POS: Record<PersonId, [number, number]> = { ravi: [150, 232], amy: [420, 66], paul: [640, 150], cara: [640, 330], ken: [420, 392] }
const SHORT: Record<PersonId, string> = { ravi: 'Victim', paul: 'Bookkeeper', amy: 'Estranged partner', ken: 'Warehouse lead', cara: 'Supplier' }
const W = 760
const H = 470

/** Lines whose straight path would cross the victim's node bend around it. */
function curve(a: PersonId, b: PersonId) {
  const [x1, y1] = POS[a]
  const [x2, y2] = POS[b]
  const [vx, vy] = POS.ravi
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const dist = Math.abs(dy * vx - dx * vy + x2 * y1 - y2 * x1) / len
  const off = a !== 'ravi' && b !== 'ravi' && dist < 60 ? 95 : 0
  const cx = (x1 + x2) / 2 + (-dy / len) * off
  const cy = (y1 + y2) / 2 + (dx / len) * off
  return { d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, mx: (x1 + 2 * cx + x2) / 4, my: (y1 + 2 * cy + y2) / 4 }
}

export default function RelationshipChart({ board, fresh, onTie, height = H, selectedKey }: { board: Board; fresh?: BoardDiff | null; onTie?: (t: Tie | null) => void; height?: number; selectedKey?: string | null }) {
  const [focus, setFocus] = useState<PersonId | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  // Follow a selection cleared from outside (the exchange list's close button).
  useEffect(() => {
    if (selectedKey === null) setSel(null)
  }, [selectedKey])
  const people = PEOPLE.filter((p) => board.loaded.includes(p.person_id) || board.ghosts.includes(p.person_id))
  const touches = (t: { a: PersonId; b: PersonId }, p: PersonId) => t.a === p || t.b === p
  const lit = (t: { a: PersonId; b: PersonId; key: string }) => (sel ? sel === t.key : focus ? touches(t, focus) : true)
  const changed = new Set([...(fresh?.newTies ?? []), ...(fresh?.changedTies ?? [])])
  const mutuals = focus ? board.mutuals.filter((m) => touches(m, focus)) : []
  const pick = (t: Tie | null) => {
    setSel(t?.key ?? null)
    onTie?.(t)
  }
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full select-none"
      style={{ height }}
      onClick={() => {
        setFocus(null)
        pick(null)
      }}
    >
      <defs>
        {people.map((p) => (
          <clipPath key={p.person_id} id={`rc-clip-${p.person_id}`}>
            <circle cx={POS[p.person_id][0]} cy={POS[p.person_id][1]} r={p.is_victim ? 38 : 32} />
          </clipPath>
        ))}
      </defs>

      {/* Mutual connections of the focused person: pairs with no direct tie */}
      {mutuals.map((m) => {
        const c = curve(m.a, m.b)
        return (
          <g key={`m-${m.key}`} className="rise pointer-events-none">
            <path d={c.d} fill="none" stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="1 4" />
            <text x={c.mx} y={c.my} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)" stroke="var(--board-card)" strokeWidth={4} paintOrder="stroke">
              no direct tie · {m.via.length} mutual: {m.via.map(personName).join(', ')}
            </text>
          </g>
        )
      })}

      {/* Ties */}
      {board.ties.map((t) => {
        const s = TIE_STYLE[t.level]
        const c = curve(t.a, t.b)
        const on = lit(t)
        const ghostTie = !board.loaded.includes(t.a) || !board.loaded.includes(t.b)
        const flags = t.flags.filter((f) => FLAG_STYLE[f])
        return (
          <g key={t.key} opacity={on ? 1 : 0.15} style={{ transition: 'opacity .2s' }}>
            {changed.has(t.key) && <path d={c.d} fill="none" stroke="var(--accent)" strokeWidth={s.width + 10} strokeLinecap="round" className="tie-glow" />}
            <path d={c.d} fill="none" stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinecap="round" opacity={ghostTie ? 0.75 : 1} />
            <path
              d={c.d}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                pick(sel === t.key ? null : t)
              }}
            >
              <title>{`${personName(t.a)} – ${personName(t.b)}: ${t.label} · ${t.contacts} calls or texts`}</title>
            </path>
            <g className="pointer-events-none">
              <text x={c.mx} y={c.my - 3} textAnchor="middle" fontSize={11.5} fontWeight={t.declared ? 600 : 500} fill={t.level === 'hidden' ? 'var(--amber)' : 'var(--ink)'} stroke="var(--board-card)" strokeWidth={5} paintOrder="stroke" strokeLinejoin="round">
                {t.label}
              </text>
              {flags.length > 0 && (
                <g transform={`translate(${c.mx - (flags.length * 18) / 2 + 9}, ${c.my + 11})`}>
                  {flags.map((f, i) => (
                    <g key={f} transform={`translate(${i * 18}, 0)`}>
                      <circle r={7.5} fill="var(--board-card)" stroke={FLAG_STYLE[f]!.color} strokeWidth={1.4} />
                      <text y={3.6} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={FLAG_STYLE[f]!.color}>
                        {FLAG_STYLE[f]!.glyph}
                      </text>
                    </g>
                  ))}
                </g>
              )}
            </g>
          </g>
        )
      })}

      {/* People */}
      {people.map((p) => {
        const id = p.person_id
        const [x, y] = POS[id]
        const r = p.is_victim ? 38 : 32
        const ghost = !board.loaded.includes(id)
        const isNew = fresh?.source === id
        const on = !focus || focus === id || board.ties.some((t) => touches(t, focus) && touches(t, id)) || mutuals.some((m) => touches(m, id))
        const n = board.ties.filter((t) => touches(t, id)).length
        return (
          <g
            key={id}
            opacity={on ? 1 : 0.3}
            className={`cursor-pointer ${isNew ? 'node-pop' : ''}`}
            style={{ transformOrigin: `${x}px ${y}px`, transition: 'opacity .2s' }}
            onClick={(e) => {
              e.stopPropagation()
              pick(null)
              setFocus(focus === id ? null : id)
            }}
          >
            {isNew && <circle cx={x} cy={y} r={r + 4} fill="none" stroke="var(--accent)" strokeWidth={3} className="node-ring" />}
            <circle cx={x} cy={y} r={r + 4} fill="var(--board-card)" stroke={ghost ? 'var(--line-strong)' : personColor(id)} strokeWidth={ghost ? 1.6 : 3} strokeDasharray={ghost ? '4 3' : undefined} />
            {ghost ? (
              <text x={x} y={y + r * 0.36} textAnchor="middle" fontSize={r} fontWeight={600} fill="var(--ink-3)">
                ?
              </text>
            ) : (
              <image
                href={p.portrait}
                x={x - r}
                y={y - r}
                width={r * 2}
                height={r * 2}
                clipPath={`url(#rc-clip-${id})`}
                preserveAspectRatio="xMidYMid slice"
                style={{ filter: p.is_victim ? 'grayscale(0.85)' : undefined }}
              />
            )}
            <text x={x} y={y + r + 20} textAnchor="middle" fontSize={13} fontWeight={600} fill={ghost ? 'var(--ink-3)' : 'var(--ink)'} stroke="var(--board-card)" strokeWidth={5} paintOrder="stroke" strokeLinejoin="round">
              {ghost ? personName(id) : p.name}
            </text>
            <text x={x} y={y + r + 34} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)" stroke="var(--board-card)" strokeWidth={5} paintOrder="stroke" strokeLinejoin="round">
              {ghost ? 'named on examined phones' : `${SHORT[id]} · ${n} tie${n === 1 ? '' : 's'}`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** One line describing a tie, for the strip under the chart. */
export function tieSummary(t: Tie) {
  const parts = [`${t.contacts} call${t.contacts === 1 ? '' : 's'} or texts`, t.saved ? 'saved contact' : 'not in each other’s contacts']
  for (const e of t.edges) {
    if (e.channel === 'transfer') parts.push(`${e.count} transfer${e.count === 1 ? '' : 's'}`)
    if (e.channel === 'colocation') parts.push(`met ${e.count} times`)
    if (e.channel === 'deleted_thread') parts.push('thread deleted')
    if (e.channel === 'hostile') parts.push(`${e.count} hostile posts`)
  }
  const times = t.edges.flatMap((e) => [e.first, e.last]).filter((x): x is string => !!x).sort()
  if (times.length) parts.push(times[0].slice(0, 10) === times[times.length - 1].slice(0, 10) ? fmtDate(times[0]) : `${fmtDate(times[0])}–${fmtDate(times[times.length - 1])}`)
  return parts.join(' · ')
}

export const tieOf = (board: Board, a: PersonId, b: PersonId) => board.ties.find((t) => t.key === pairKey(a, b))
