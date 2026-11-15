import { useEffect, useRef, useState } from 'react'
import { useCase } from '../../../state/caseStore'
import { exhibitOf, sourceOf } from '../../../mock/sources'
import { personOf } from '../../../mock/data'
import { fmtDate } from '../../../lib/format'
import Portrait, { Unknown } from '../../../components/Portrait'

/** Large action button on the board, shared by the three actions under the relationship chart. */
export const ACTION_CLASS =
  'group flex h-full w-full items-center gap-3 rounded-xl bg-ink px-4 py-4 text-left text-surface shadow-sm transition hover:-translate-y-px hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none'

const ICONS = {
  add: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M12 8.5v6M9 11.5h6" />
    </>
  ),
  verify: (
    <>
      <path d="M8 3.5h8M8 3.5a1.5 1.5 0 0 0-1.5 1.5H5.5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1A1.5 1.5 0 0 0 16 3.5" />
      <path d="M8.5 13.5l2.5 2.5 4.5-5" />
    </>
  ),
  ask: (
    <>
      <path d="M4 5.5h16v10H10l-4 3.5v-3.5H4z" />
      <path d="M9.5 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.7-.9 1.3M12 14.2v.1" />
    </>
  ),
}

export function ActionLabel({ icon, title, sub }: { icon: keyof typeof ICONS; title: string; sub: string }) {
  return (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface/15">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {ICONS[icon]}
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold leading-tight">{title}</span>
        <span className="mt-0.5 block truncate text-[11.5px] text-surface/70">{sub}</span>
      </span>
      <span className="text-[17px] transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0" aria-hidden>
        →
      </span>
    </>
  )
}

/** "Add new device data": the phones not yet examined, plus a drop zone for a Case Bundle. */
export function AddSourceMenu() {
  const c = useCase()
  const [open, setOpen] = useState(false)
  const [over, setOver] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', key)
    }
  }, [open])
  const add = (id = c.queue[0]) => {
    if (!id) return
    setOpen(false)
    void c.addSource(id)
  }
  const busy = !!c.ingesting
  return (
    <div ref={ref} className="relative h-full">
      <button disabled={busy || c.queue.length === 0} onClick={() => setOpen((o) => !o)} className={ACTION_CLASS}>
        <ActionLabel
          icon="add"
          title="Add new device data"
          sub={busy ? `Adding ${exhibitOf(c.ingesting!.source)}…` : c.queue.length ? `${c.queue.length} phone${c.queue.length === 1 ? '' : 's'} not yet examined` : 'All phones added'}
        />
      </button>
      {open && (
        <div className="rise absolute bottom-full left-0 z-40 mb-2 w-[380px] rounded-lg border border-line bg-surface p-2 shadow-xl">
          <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Seized, not yet examined</div>
          {c.queue.map((id, k) => {
            const s = sourceOf(id)
            return (
              <button key={id} onClick={() => add(id)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-sunken">
                <Unknown size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ink">
                    {exhibitOf(id)} <span className="font-normal text-ink-3">· owner not confirmed</span> {k === 0 && <span className="ml-1 rounded bg-sunken px-1 text-[10px] font-normal text-ink-3">next</span>}
                  </span>
                  <span className="tnum block text-[11.5px] text-ink-3">
                    {s.model} · extracted {fmtDate(s.extracted_at)} · {s.rows.toLocaleString()} rows
                  </span>
                </span>
                <span className="text-[12px] text-ink-2">Add</span>
              </button>
            )
          })}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              add()
            }}
            onClick={() => file.current?.click()}
            className={`mt-1.5 cursor-pointer rounded-md border border-dashed px-3 py-3 text-center text-[12px] ${over ? 'border-accent bg-accent/5 text-ink' : 'border-line-strong text-ink-2'}`}
          >
            Drop a Case Bundle (.zip) or click to choose
            <div className="mt-0.5 text-[11px] text-ink-3">In this mock any file loads {c.queue[0] ? exhibitOf(c.queue[0]) : 'the next phone'}.</div>
            <input ref={file} type="file" accept=".zip,.json,.jsonl" className="hidden" onChange={() => add()} />
          </div>
        </div>
      )}
    </div>
  )
}

/** Ingestion progress for the source being added: one bar, the stages, rows read, checks re-run. */
export function IngestPanel() {
  const c = useCase()
  const g = c.ingesting
  if (!g) return null
  const s = sourceOf(g.source)
  const running = g.stages.find((x) => x.status === 'running')
  return (
    <div className="board-card rise rounded-lg border border-accent/60 px-4 py-3">
      <div className="flex items-center gap-3">
        <Unknown size={30} />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-ink">Adding {exhibitOf(g.source)}</div>
          <div className="tnum text-[11.5px] text-ink-3">
            {s.model} · {g.rows.toLocaleString()} of {s.rows.toLocaleString()} rows
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {g.stages.map((st) => (
            <span
              key={st.id}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${st.status === 'done' ? 'border-line text-ink-2' : st.status === 'running' ? 'border-accent text-ink' : 'border-line text-ink-3/70'}`}
            >
              {st.status === 'done' ? <span className="text-good">✓</span> : st.status === 'running' ? <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" /> : null}
              {st.label}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-sunken">
        <div className="bar-live h-full rounded-full bg-accent transition-[width] duration-150 ease-linear" style={{ width: `${Math.round(g.pct * 100)}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-ink-3">
        <span className="truncate">{running ? `${running.label}: ${running.detail}` : 'Done'}</span>
        <span className="tnum shrink-0 pl-3">{Math.round(g.pct * 100)}%</span>
      </div>
    </div>
  )
}

/** What the last source changed, shown for a few seconds after it lands. */
/** `lift`: height of the subagents sheet, so the toast sits just above it. */
export function ChangeToast({ lift }: { lift?: string | null }) {
  const c = useCase()
  const f = c.fresh
  if (!f) return null
  const ties = f.newTies.length + f.changedTies.length
  const parts = [
    `+${f.rows.toLocaleString()} rows`,
    f.newIncidents.length ? `${f.newIncidents.length} new insight${f.newIncidents.length > 1 ? 's' : ''}` : null,
    f.strengthened.length ? `${f.strengthened.length} strengthened` : null,
    ties ? `${ties} relationship${ties > 1 ? 's' : ''} updated` : null,
  ].filter(Boolean)
  return (
    <div style={lift ? { bottom: `calc(${lift} + 12px)` } : undefined} className="toast-in fixed bottom-5 left-1/2 z-40 flex items-center gap-3 rounded-lg border border-line bg-surface py-2 pl-2.5 pr-2 shadow-xl">
      <Portrait id={f.source} size={26} />
      <span className="text-[12.5px] text-ink">
        <span className="font-semibold">
          {exhibitOf(f.source)} identified as {personOf(f.source).name}
        </span>
        <span className="text-ink-2"> · {parts.join(' · ')}</span>
      </span>
      <button onClick={c.dismissFresh} className="rounded px-1.5 text-[13px] text-ink-3 hover:bg-sunken hover:text-ink" title="Dismiss">
        ✕
      </button>
    </div>
  )
}
