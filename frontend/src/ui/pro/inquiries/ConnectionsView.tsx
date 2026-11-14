import { useMemo, useState } from 'react'
import type { Channel } from '../../../api'
import { GRAPH } from '../../../mock/derived'
import { ROWS, personName } from '../../../mock/data'
import { fmtDate, fmtTime } from '../../../lib/format'
import RelationshipGraph, { CHANNEL_STYLE, edgesInWindow, type EdgeView } from '../../../components/RelationshipGraph'
import Portrait from '../../../components/Portrait'
import { Btn, Mono, Panel } from '../kit'
import { InquiryHeader } from './meta'

const DAYS = [13, 14, 15, 16, 17, 18, 19]
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const iso = (d: number, end = false) => `2026-04-${d}T${end ? '23:59:59' : '00:00:00'}-04:00`
const ALL: Channel[] = ['call', 'message', 'transfer', 'colocation', 'deleted_thread', 'hostile', 'social']

export default function ConnectionsView() {
  const [range, setRange] = useState<[number, number]>([13, 19])
  const [anchor, setAnchor] = useState<number | null>(null)
  const [channels, setChannels] = useState<Set<Channel>>(new Set(ALL.filter((c) => c !== 'social')))
  const [sel, setSel] = useState<EdgeView | null>(null)
  const from = iso(range[0])
  const to = iso(range[1], true)

  // Interactions per day, all ties between case phones (drives the timeline strip under the graph).
  const perDay = useMemo(
    () =>
      DAYS.map((d) => {
        const es = edgesInWindow(GRAPH, iso(d), iso(d, true)).filter((e) => channels.has(e.channel))
        return { d, n: es.reduce((a, e) => a + e.n, 0), alarm: es.filter((e) => e.channel === 'deleted_thread' || e.channel === 'hostile').reduce((a, e) => a + e.n, 0) }
      }),
    [channels],
  )
  const max = Math.max(1, ...perDay.map((p) => p.n))
  const notable = useMemo(() => edgesInWindow(GRAPH, from, to).filter((e) => ['colocation', 'deleted_thread', 'transfer', 'hostile'].includes(e.channel) && !e.weak), [from, to])
  const pick = (d: number) => {
    if (anchor === null) {
      setAnchor(d)
      setRange([d, d])
    } else {
      setRange([Math.min(anchor, d), Math.max(anchor, d)])
      setAnchor(null)
    }
    setSel(null)
  }
  const toggle = (c: Channel) => setChannels((s) => (s.has(c) ? new Set([...s].filter((x) => x !== c)) : new Set([...s, c])))

  return (
    <div className="space-y-3 p-4">
      <InquiryHeader id="connections" />
      <div className="grid grid-cols-12 gap-3">
        <Panel
          title="Link chart"
          className="col-span-8"
          sub="click a line for every interaction behind it"
          actions={
            range[0] !== 13 || range[1] !== 19 ? (
              <Btn kind="ghost" onClick={() => setRange([13, 19])}>
                Whole week
              </Btn>
            ) : undefined
          }
        >
          <div className="mb-2 flex flex-wrap gap-1.5">
            {ALL.map((c) => {
              const s = CHANNEL_STYLE[c]
              const on = channels.has(c)
              return (
                <button key={c} onClick={() => toggle(c)} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11.5px] ${on ? 'border-line-strong text-ink' : 'border-line text-ink-3 line-through'}`}>
                  <svg width="22" height="6">
                    <line x1="0" x2="22" y1="3" y2="3" stroke={s.stroke} strokeWidth="2.5" strokeDasharray={s.dash} />
                  </svg>
                  {s.label}
                </button>
              )
            })}
          </div>
          <RelationshipGraph graph={GRAPH} from={from} to={to} channels={channels} selected={sel} onSelect={setSel} />
          {/* timeline strip: drives the graph's time window */}
          <div className="mt-2 border-t border-line pt-2">
            <div className="mb-1 flex items-center justify-between text-[11px] text-ink-3">
              <span>Interactions per day · click a day, then another, to set the window</span>
              <span>{anchor !== null ? 'now click the last day' : ''}</span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {perDay.map(({ d, n, alarm }, i) => {
                const on = d >= range[0] && d <= range[1]
                return (
                  <button key={d} onClick={() => pick(d)} className={`rounded-md border px-2 pb-1 pt-1.5 text-left ${on ? 'border-ink' : 'border-line opacity-50 hover:opacity-80'} ${anchor === d ? 'ring-2 ring-accent' : ''}`}>
                    <div className="flex h-10 items-end gap-0.5">
                      <span className="flex-1 rounded-t-[3px] bg-ink-2" style={{ height: `${(n / max) * 100}%` }} />
                      {alarm > 0 && <span className="w-1.5 rounded-t-[2px] bg-serious" style={{ height: `${Math.max(12, (alarm / max) * 100)}%` }} />}
                    </div>
                    <div className="mt-1 flex justify-between text-[11px]">
                      <span className={on ? 'text-ink' : 'text-ink-2'}>
                        {DOW[i]} {d}
                      </span>
                      <span className="tnum text-ink-3">{n}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </Panel>

        <div className="col-span-4 space-y-3">
          {sel ? <EdgePanel e={sel} onClose={() => setSel(null)} /> : null}
          <Panel title="Ties worth a look" count={notable.length} pad={false} sub={`${fmtDate(from)}–${fmtDate(to)}`}>
            <ul className="divide-y divide-line">
              {notable.map((e) => (
                <li key={`${e.source}${e.target}${e.channel}`}>
                  <button onClick={() => setSel(e)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-sunken">
                    <span className="flex -space-x-2">
                      <Portrait id={e.source} size={24} ring={false} />
                      <Portrait id={e.target} size={24} ring={false} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] text-ink">
                        {personName(e.source)} – {personName(e.target)}
                      </span>
                      <span className="block text-[11.5px] text-ink-2">{e.channel === 'colocation' ? e.label : `${e.n} × ${CHANNEL_STYLE[e.channel].label.toLowerCase()}`}</span>
                    </span>
                    <svg width="22" height="6" className="shrink-0">
                      <line x1="0" x2="22" y1="3" y2="3" stroke={CHANNEL_STYLE[e.channel].stroke} strokeWidth="2.5" strokeDasharray={CHANNEL_STYLE[e.channel].dash} />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function EdgePanel({ e, onClose }: { e: EdgeView; onClose: () => void }) {
  const rows = e.ids.map((id) => ROWS.get(id)!).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  // Group copies of the same interaction held on both phones.
  const groups = new Map<string, typeof rows>()
  for (const r of rows) {
    const k = e.channel === 'colocation' ? r.timestamp : `${r.timestamp}|${r.fields.body ?? r.fields.amount ?? r.fields.duration_s ?? r.id}`
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  const list = [...groups.values()]
  return (
    <Panel title={CHANNEL_STYLE[e.channel].label} sub={`${personName(e.source)} – ${personName(e.target)}`} actions={<Btn kind="ghost" onClick={onClose}>Close</Btn>} pad={false}>
      <div className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <Portrait id={e.source} size={34} />
        <svg width="40" height="8">
          <line x1="0" x2="40" y1="4" y2="4" stroke={CHANNEL_STYLE[e.channel].stroke} strokeWidth="3" strokeDasharray={CHANNEL_STYLE[e.channel].dash} />
        </svg>
        <Portrait id={e.target} size={34} />
        <div className="ml-auto text-right text-[12px]">
          <div className="tnum font-semibold text-ink">{e.n}</div>
          <div className="text-ink-3">{e.channel === 'colocation' ? 'occasions' : 'interactions'}</div>
        </div>
      </div>
      <ul className="max-h-[360px] divide-y divide-line overflow-y-auto">
        {list.slice(0, 40).map((g) => {
          const r = g[0]
          return (
            <li key={r.id} className="px-3 py-2 text-[12px]">
              <div className="flex items-baseline gap-2">
                <span className="tnum text-ink-3">
                  {fmtDate(r.timestamp)} {fmtTime(r.timestamp)}
                </span>
                <span className="ml-auto text-[10.5px] text-ink-3">{g.length > 1 ? 'on both phones' : `on ${personName(r.device_owner)}'s phone only`}</span>
              </div>
              <div className="text-ink">{r.summary}</div>
              <Mono className="text-ink-3">{g.map((x) => x.id).join(' · ')}</Mono>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
