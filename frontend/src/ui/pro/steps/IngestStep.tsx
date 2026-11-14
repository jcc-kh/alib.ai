import { useMemo, useState } from 'react'
import type { PersonId } from '../../../api'
import { atLeast, useCase } from '../../../state/caseStore'
import { Btn, Kpi, Panel, PersonTag } from '../kit'
import { ROWS, personColor, personName } from '../../../mock/data'
import { SEGMENTS } from '../../../mock/segments'
import { CASE_PEOPLE } from '../../../lib/aggregates'
import { fmtDate, fmtTime } from '../../../lib/format'

const DAYS = [13, 14, 15, 16, 17, 18, 19]
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TABLES = ['messages', 'calls', 'locations', 'transactions', 'contacts', 'device_events'] as const
const HEAD = ['Msgs', 'Calls', 'Locs', 'Txns', 'Contacts', 'Events']

const dayOf = (ts: string) => Number(ts?.slice(8, 10))
const inRange = (ts: string, r: [number, number]) => {
  const d = dayOf(ts)
  return !d || (d >= r[0] && d <= r[1]) // undated rows (e.g. contacts) always count
}

export default function IngestStep({ next }: { next: () => void }) {
  const c = useCase()
  const [drag, setDrag] = useState(false)
  const running = c.stage === 'ingesting'
  const loaded = !!c.ingestReport

  return (
    <div className="space-y-3 p-4">
      <Panel title="New case">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6">
          <div className="space-y-3">
            <label className="block">
              <div className="mb-1 text-[11px] font-medium text-ink-2">Case name</div>
              <input
                value={c.caseName}
                onChange={(e) => c.setCaseName(e.target.value)}
                placeholder="e.g. Death at Pier 9"
                className="h-8 w-full rounded-md border border-line bg-page px-2.5 text-[13px] text-ink placeholder:text-ink-3 focus:border-line-strong focus:outline-none"
              />
            </label>
            <div>
              <div className="mb-1 text-[11px] font-medium text-ink-2">Phone data</div>
              <div className="flex items-center gap-2">
                <Btn kind="primary" disabled={running} onClick={() => c.startIngest(null)}>
                  {running ? 'Loading…' : loaded ? 'Reload sample bundle' : 'Load sample bundle'}
                </Btn>
                <span className="text-[11px] text-ink-3">pier9-case.zip · 5 phones</span>
              </div>
            </div>
          </div>
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              c.startIngest(e.dataTransfer.files[0] ?? null)
            }}
            className={`flex min-h-[104px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed text-[12px] transition ${drag ? 'border-accent bg-sunken' : 'border-line-strong hover:bg-sunken'}`}
          >
            <input type="file" accept=".zip" className="hidden" disabled={running} onChange={(e) => c.startIngest(e.target.files?.[0] ?? null)} />
            <span className="font-medium text-ink">Or drop a case bundle (.zip)</span>
            <span className="text-ink-3">one folder per phone · Case Bundle v1</span>
          </label>
        </div>
      </Panel>

      {(running || loaded) && <PipelineStrip />}

      {loaded && <Report next={next} />}
    </div>
  )
}

/** Compact progress strip; the step details live in the tooltip. */
function PipelineStrip() {
  const c = useCase()
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-2">
      <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">Loading</span>
      {c.ingestStages.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1" title={s.detail}>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] ${s.status === 'done' ? 'text-ink-2' : s.status === 'running' ? 'bg-sunken text-ink' : 'text-ink-3'}`}>
            <span className={`text-[11px] ${s.status === 'done' ? 'text-good' : s.status === 'running' ? 'pulse-dot' : ''}`}>{s.status === 'done' ? '✓' : s.status === 'running' ? '●' : '○'}</span>
            {s.label}
          </span>
          {i < c.ingestStages.length - 1 && <span className="h-px w-5 bg-line-strong" />}
        </div>
      ))}
    </div>
  )
}

function Report({ next }: { next: () => void }) {
  const c = useCase()
  const r = c.ingestReport!
  const range = c.range
  // Per phone × table × day, computed from the rows themselves.
  const counts = useMemo(() => {
    const out = new Map<string, number>()
    for (const row of ROWS.values()) {
      // Contacts are an address book, not events: they count whatever the range.
      const k = `${row.device_owner}|${row.table}|${row.table === 'contacts' ? 0 : dayOf(row.timestamp) || 0}`
      out.set(k, (out.get(k) ?? 0) + 1)
    }
    return out
  }, [])
  const count = (p: PersonId, t: string, r: [number, number]) => {
    let n = counts.get(`${p}|${t}|0`) ?? 0
    for (let d = r[0]; d <= r[1]; d++) n += counts.get(`${p}|${t}|${d}`) ?? 0
    return n
  }
  const rowsInRange = useMemo(() => [...ROWS.values()].filter((x) => x.table === 'contacts' || inRange(x.timestamp, range)).length, [range])
  const gapsIn = (p: PersonId) => SEGMENTS.filter((g) => g.person === p && g.kind === 'gap' && dayOf(g.end) >= range[0] && dayOf(g.start) <= range[1]).length
  const days = range[1] - range[0] + 1
  const analysed = atLeast(c.stage, 'analysed')

  return (
    <>
      <Panel title="Date range to analyse" sub="rows per day, all phones" actions={days < 7 ? <Btn kind="ghost" onClick={() => c.setRange([13, 19])}>Whole week</Btn> : undefined}>
        <RangePicker counts={counts} />
      </Panel>

      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Phones" value={r.devices.length} />
        <Kpi label="Rows in range" value={rowsInRange.toLocaleString()} sub={`of ${r.rows_checked.toLocaleString()} loaded`} />
        <Kpi label="Days" value={days} sub={days === 1 ? `${range[0]} Apr` : `${range[0]}–${range[1]} Apr 2026`} />
        <Kpi label="Schema errors" value={r.errors} tone="good" />
      </div>

      <Panel title="Phones" pad={false} sub="counts within the chosen range">
        <table className="w-full text-[12px]">
          <thead className="text-left text-[11px] text-ink-3">
            <tr className="border-b border-line">
              <th className="px-3 py-1.5 font-medium">Owner</th>
              <th className="px-2 py-1.5 font-medium">Device</th>
              <th className="px-2 py-1.5 font-medium">Extracted</th>
              {HEAD.map((h) => (
                <th key={h} className="px-2 py-1.5 text-right font-medium">
                  {h}
                </th>
              ))}
              <th className="px-3 py-1.5 text-right font-medium">Location gaps ≥ 45 min</th>
            </tr>
          </thead>
          <tbody>
            {r.devices.map((d) => (
              <tr key={d.device_id} className="border-b border-line last:border-0">
                <td className="px-3 py-1.5">
                  <PersonTag id={d.owner} />
                </td>
                <td className="px-2 py-1.5 text-ink-2">
                  {d.model} <span className="font-mono text-[10.5px] text-ink-3">{d.device_id}</span>
                </td>
                <td className="tnum px-2 py-1.5 text-ink-2">
                  {fmtDate(d.extracted_at)} {fmtTime(d.extracted_at)}
                </td>
                {TABLES.map((t) => (
                  <td key={t} className="tnum px-2 py-1.5 text-right">
                    {count(d.owner, t, range).toLocaleString()}
                  </td>
                ))}
                <td className="tnum px-3 py-1.5 text-right">{gapsIn(d.owner)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="flex items-center justify-end gap-3 rounded-lg border border-line bg-surface px-3 py-2">
        {analysed && <span className="text-[12px] text-ink-3">Changed the range? Run the analysis again.</span>}
        <Btn
          kind="primary"
          disabled={c.stage === 'ingesting' || c.stage === 'analysing'}
          onClick={() => {
            next()
            c.startAnalysis(1)
          }}
        >
          {analysed ? 'Run analysis again →' : 'Run analysis →'}
        </Btn>
      </div>
    </>
  )
}

/** Seven day columns; click one day to start a range and another to end it. */
function RangePicker({ counts }: { counts: Map<string, number> }) {
  const c = useCase()
  const [anchor, setAnchor] = useState<number | null>(null)
  const perDay = DAYS.map((d) => CASE_PEOPLE.map((p) => ({ p, n: (['messages', 'calls', 'locations', 'transactions', 'device_events'] as const).reduce((k, t) => k + (counts.get(`${p}|${t}|${d}`) ?? 0), 0) })))
  const max = Math.max(...perDay.map((ps) => ps.reduce((k, x) => k + x.n, 0)))
  const [a, b] = c.range
  const pick = (d: number) => {
    if (anchor === null) {
      setAnchor(d)
      c.setRange([d, d])
    } else {
      c.setRange([Math.min(anchor, d), Math.max(anchor, d)])
      setAnchor(null)
    }
  }
  return (
    <div>
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((d, i) => {
          const on = d >= a && d <= b
          const total = perDay[i].reduce((k, x) => k + x.n, 0)
          return (
            <button
              key={d}
              onClick={() => pick(d)}
              className={`rounded-md border px-2 pb-1.5 pt-2 text-left transition ${on ? 'border-ink bg-surface' : 'border-line bg-sunken opacity-55 hover:opacity-80'} ${anchor === d ? 'ring-2 ring-accent' : ''}`}
            >
              <div className="flex h-16 items-end gap-[2px]">
                {perDay[i].map(({ p, n }) => (
                  <span key={p} title={`${p}: ${n} rows`} className="flex-1 rounded-t-[3px]" style={{ height: `${(n / max) * 100}%`, background: personColor(p) }} />
                ))}
              </div>
              <div className="mt-1.5 flex items-baseline justify-between text-[12px]">
                <span className={on ? 'font-medium text-ink' : 'text-ink-2'}>
                  {DOW[i]} {d}
                </span>
                <span className="tnum text-[11px] text-ink-3">{total.toLocaleString()}</span>
              </div>
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-ink-3">
        {CASE_PEOPLE.map((p) => (
          <span key={p} className="inline-flex items-center gap-1.5 text-ink-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: personColor(p) }} />
            {personName(p)}
          </span>
        ))}
        <span className="ml-auto">{anchor !== null ? 'Now click the last day.' : 'Click a first day, then a last day.'}</span>
      </div>
    </div>
  )
}
