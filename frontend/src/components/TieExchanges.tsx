import { useMemo, useState } from 'react'
import type { Channel, EvidenceRow, PersonId, Tie } from '../api'
import { NUMBERS, ROWS, personName } from '../mock/data'
import { fmtDate, fmtTime } from '../lib/format'
import Portrait from './Portrait'

const KIND: Record<Channel, { label: string; color: string }> = {
  call: { label: 'Call', color: 'var(--ink-2)' },
  message: { label: 'Text', color: 'var(--ink-2)' },
  transfer: { label: 'Money', color: 'var(--accent)' },
  colocation: { label: 'Together', color: 'var(--amber)' },
  deleted_thread: { label: 'Deleted', color: 'var(--serious)' },
  hostile: { label: 'Hostile post', color: 'var(--serious)' },
  social: { label: 'Social', color: 'var(--ink-3)' },
}

const byNumber = new Map(Object.entries(NUMBERS).map(([p, n]) => [n, p as PersonId]))
const who = (n: unknown) => (n ? (byNumber.get(String(n)) ?? null) : null)

interface Item {
  key: string
  channel: Channel
  t: string
  /** For meetings: the end of the occasion. */
  end?: string
  head: string
  body?: string
  /** Which examined phones hold a copy. */
  on: PersonId[]
  ids: string[]
}

/** One line of the exchange list for a group of rows that are the same interaction. */
function describe(channel: Channel, rows: EvidenceRow[]): Omit<Item, 'key' | 'on' | 'ids' | 't' | 'end' | 'channel'> {
  const r = rows[0]
  const f = r.fields
  const from = who(f.from)
  const to = who(f.to)
  const arrow = from && to ? `${personName(from)} → ${personName(to)}` : r.summary
  if (channel === 'message') return { head: arrow, body: f.body ? `“${f.body}”` : undefined }
  if (channel === 'call') return { head: arrow, body: f.duration_s ? `call, ${f.duration_s} s` : 'call, not answered' }
  if (channel === 'transfer') return { head: arrow, body: `$${Number(f.amount).toLocaleString()} via ${f.app}${f.memo ? `, “${f.memo}”` : ''}` }
  if (channel === 'deleted_thread') return { head: `${personName(r.device_owner)}'s phone deleted a thread`, body: String(f.detail ?? '').split(' (')[0] }
  if (channel === 'hostile') return { head: `${personName(r.device_owner)} posted`, body: f.text ? `“${f.text}”` : r.summary }
  return { head: r.summary }
}

/**
 * Every exchange between two people, newest last: calls, texts, payments, times together, deletions and
 * posts. Copies of the same interaction on both phones are shown once, with which phones hold it.
 */
export default function TieExchanges({ tie, onClose }: { tie: Tie; onClose: () => void }) {
  const items = useMemo(() => {
    const out: Item[] = []
    for (const e of tie.edges) {
      const rows = e.evidence_ids.map((id) => ROWS.get(id)!).filter(Boolean)
      if (e.channel === 'colocation') {
        // Location rows from both phones: one item per day and place.
        const g = new Map<string, EvidenceRow[]>()
        for (const r of rows) {
          const k = `${r.timestamp.slice(0, 10)}|${r.fields.place_name ?? ''}`
          g.set(k, [...(g.get(k) ?? []), r])
        }
        for (const [k, rs] of g) {
          rs.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          out.push({ key: `col${k}`, channel: 'colocation', t: rs[0].timestamp, end: rs[rs.length - 1].timestamp, head: `Both phones at ${rs[0].fields.place_name ?? 'the same place'}`, body: 'no call or text around it', on: [...new Set(rs.map((r) => r.device_owner))], ids: rs.map((r) => r.id) })
        }
        continue
      }
      const g = new Map<string, EvidenceRow[]>()
      for (const r of rows) {
        const k = `${r.table}|${r.timestamp.slice(0, 19)}|${r.fields.body ?? r.fields.amount ?? r.fields.duration_s ?? r.fields.text ?? r.id}`
        g.set(k, [...(g.get(k) ?? []), r])
      }
      for (const [k, rs] of g) out.push({ key: `${e.channel}${k}`, channel: e.channel, t: rs[0].timestamp, ...describe(e.channel, rs), on: [...new Set(rs.map((r) => r.device_owner))], ids: rs.map((r) => r.id) })
    }
    return out.sort((a, b) => a.t.localeCompare(b.t))
  }, [tie])
  const kinds = [...new Set(items.map((i) => i.channel))]
  const [off, setOff] = useState<Set<Channel>>(new Set())
  const shown = items.filter((i) => !off.has(i.channel))
  const toggle = (k: Channel) => setOff((s) => (s.has(k) ? new Set([...s].filter((x) => x !== k)) : new Set([...s, k])))
  let lastDay = ''
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <Portrait id={tie.a} size={28} />
        <Portrait id={tie.b} size={28} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-ink">
            {personName(tie.a)} – {personName(tie.b)}
          </div>
          <div className="truncate text-[11.5px] text-ink-2">
            {tie.label} · {items.length} exchange{items.length === 1 ? '' : 's'}
          </div>
        </div>
        <button onClick={onClose} title="Close" className="rounded px-1.5 text-[13px] text-ink-3 hover:bg-sunken hover:text-ink">
          ✕
        </button>
      </div>
      {kinds.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2">
          {kinds.map((k) => {
            const n = items.filter((i) => i.channel === k).length
            return (
              <button key={k} onClick={() => toggle(k)} className={`tnum inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${off.has(k) ? 'border-line text-ink-3 line-through' : 'border-line-strong text-ink'}`}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND[k].color }} />
                {KIND[k].label} {n}
              </button>
            )
          })}
        </div>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        {shown.map((i) => {
          const day = fmtDate(i.t)
          const head = day !== lastDay
          lastDay = day
          return (
            <li key={i.key}>
              {head && <div className="sticky top-0 bg-surface pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{day}</div>}
              <div className="flex gap-2.5 border-l-2 py-1.5 pl-2.5" style={{ borderColor: KIND[i.channel].color }}>
                <span className="tnum w-[4.6rem] shrink-0 pt-px text-[11.5px] text-ink-3">
                  {fmtTime(i.t)}
                  {i.end && i.end !== i.t ? `–${fmtTime(i.end)}` : ''}
                </span>
                <div className="min-w-0 flex-1 text-[12px] leading-snug">
                  <div className="flex items-baseline gap-1.5">
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.04em]" style={{ color: KIND[i.channel].color }}>
                      {KIND[i.channel].label}
                    </span>
                    <span className="truncate text-ink-2">{i.head}</span>
                  </div>
                  {i.body && <div className="text-ink">{i.body}</div>}
                  <div className="text-[10.5px] text-ink-3" title={i.ids.join(' · ')}>
                    {i.channel === 'colocation' ? `${i.ids.length} location fixes` : i.on.length > 1 ? 'on both phones' : `on ${personName(i.on[0])}'s phone only`}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
        {!shown.length && <li className="py-6 text-center text-[12px] text-ink-3">{items.length ? 'Nothing to show with these filters.' : 'No exchanges: only a saved number in the contacts.'}</li>}
      </ul>
    </div>
  )
}
