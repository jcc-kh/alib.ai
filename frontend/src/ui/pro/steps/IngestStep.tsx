import { useMemo, useState } from 'react'
import { useCase } from '../../../state/caseStore'
import { Btn, Kpi, Panel, PersonTag, Empty } from '../kit'
import { dataVolume, CASE_PEOPLE } from '../../../lib/aggregates'
import { SEGMENTS } from '../../../mock/segments'
import { personColor, personName } from '../../../mock/data'
import { caseMinutes, fmtDate, fmtTime } from '../../../lib/format'
import { GAP_STYLE } from '../../../components/LocationLanes'

export default function IngestStep({ next }: { next: () => void }) {
  const c = useCase()
  const [drag, setDrag] = useState(false)
  const r = c.ingestReport
  const running = c.stage === 'ingesting'

  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-12 gap-3">
        <Panel title="Case bundle" className="col-span-4" sub="Case Bundle v1 · one folder per phone">
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
            className={`flex h-[104px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed text-[12px] transition ${drag ? 'border-accent bg-sunken' : 'border-line-strong hover:bg-sunken'}`}
          >
            <input type="file" accept=".zip" className="hidden" disabled={running} onChange={(e) => c.startIngest(e.target.files?.[0] ?? null)} />
            <span className="font-medium text-ink">Drop a .zip or browse</span>
            <span className="text-ink-3">manifest.json · persons.jsonl · devices/&lt;id&gt;/*.jsonl</span>
          </label>
          <div className="mt-3 flex items-center gap-2">
            <Btn kind="primary" disabled={running} onClick={() => c.startIngest(null)}>
              {running ? 'Ingesting…' : 'Load sample bundle'}
            </Btn>
            <span className="text-[11px] text-ink-3">harbor-supply-case.zip · 36 files</span>
          </div>
        </Panel>

        <Panel title="Pipeline" className="col-span-8">
          <ol className="grid grid-cols-6 gap-2">
            {c.ingestStages.map((s, i) => (
              <li key={s.id} className={`rounded-md border px-2.5 py-2 ${s.status === 'done' ? 'border-line bg-sunken' : s.status === 'running' ? 'border-ink' : 'border-line'}`}>
                <div className="flex items-center gap-1.5 text-[12px] font-medium">
                  <span className={`text-[11px] ${s.status === 'done' ? 'text-good' : s.status === 'running' ? 'pulse-dot text-ink' : 'text-ink-3'}`}>{s.status === 'done' ? '✓' : s.status === 'running' ? '●' : i + 1}</span>
                  {s.label}
                </div>
                <div className="mt-1 text-[11px] leading-snug text-ink-3">{s.detail}</div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      {!r ? (
        <Panel title="Ingest report">
          <Empty>{running ? 'Validating and normalising rows…' : 'Load a bundle to see per-phone counts, coverage and warnings.'}</Empty>
        </Panel>
      ) : (
        <Report next={next} />
      )}
    </div>
  )
}

function Report({ next }: { next: () => void }) {
  const c = useCase()
  const r = c.ingestReport!
  const vol = useMemo(() => dataVolume(), [])
  const warn = r.warnings.filter((w) => w.level === 'warn').length
  const tables: { key: 'messages' | 'calls' | 'locations' | 'transactions'; label: string }[] = [
    { key: 'messages', label: 'Messages' },
    { key: 'calls', label: 'Calls' },
    { key: 'locations', label: 'Location fixes' },
    { key: 'transactions', label: 'Transactions' },
  ]
  return (
    <>
      <div className="grid grid-cols-5 gap-3">
        <Kpi label="Phones" value={r.devices.length} sub="iPhone 15 · Pixel 8 · Galaxy S24 · iPhone 14" />
        <Kpi label="Rows ingested" value={r.rows_checked.toLocaleString()} sub={`${r.files_read} JSONL files`} />
        <Kpi label="Coverage" value="7 days" sub="13 Apr 00:00 – 19 Apr 23:50 (UTC−4)" />
        <Kpi label="Schema errors" value={r.errors} tone="good" sub="case-bundle/1.0" />
        <Kpi label="Warnings" value={warn} tone={warn ? 'serious' : undefined} />
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Panel title="Rows by table" className="col-span-5" sub="per phone">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            {tables.map((t) => {
              const max = Math.max(...vol.map((v) => v[t.key]))
              return (
                <div key={t.key}>
                  <div className="mb-1.5 text-[11px] text-ink-2">{t.label}</div>
                  <div className="space-y-1">
                    {vol.map((v) => (
                      <div key={v.person} className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2 text-[11px]">
                        <span className="text-ink-2">{personName(v.person)}</span>
                        <span className="h-2.5 rounded-r-[3px] bg-sunken">
                          <span className="block h-full rounded-r-[3px]" style={{ width: `${(v[t.key] / max) * 100}%`, background: personColor(v.person) }} />
                        </span>
                        <span className="tnum text-right text-ink">{v[t.key].toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
        <Panel title="Location coverage" className="col-span-7" sub="data spans and gaps ≥ 45 min">
          <CoverageChart />
        </Panel>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <Panel title="Devices" className="col-span-7" pad={false}>
          <table className="w-full text-[12px]">
            <thead className="text-left text-[11px] text-ink-3">
              <tr className="border-b border-line">
                <th className="px-3 py-1.5 font-medium">Phone</th>
                <th className="px-2 py-1.5 font-medium">Device</th>
                <th className="px-2 py-1.5 font-medium">Extracted</th>
                {['Msgs', 'Calls', 'Locs', 'Txns', 'Contacts', 'Events'].map((h) => (
                  <th key={h} className="px-2 py-1.5 text-right font-medium">
                    {h}
                  </th>
                ))}
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
                  {['messages', 'calls', 'locations', 'transactions', 'contacts', 'device_events'].map((k) => (
                    <td key={k} className="tnum px-2 py-1.5 text-right">
                      {d.counts[k]?.toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Ingest log" count={r.warnings.length} className="col-span-5" pad={false}>
          <ul className="divide-y divide-line">
            {r.warnings.map((w, i) => (
              <li key={i} className="flex gap-2 px-3 py-1.5 text-[12px]">
                <span className={`mt-px w-14 shrink-0 whitespace-nowrap text-[10.5px] font-semibold uppercase ${w.level === 'warn' ? 'text-serious' : 'text-ink-3'}`}>{w.level === 'warn' ? '▲ warn' : 'info'}</span>
                <span className="text-ink-2">{w.message}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="flex items-center justify-end gap-3 rounded-lg border border-line bg-surface px-3 py-2">
        <Btn
          kind="primary"
          disabled={c.stage !== 'ingested'}
          onClick={() => {
            next()
            c.startAnalysis(1)
          }}
        >
          Run analysis →
        </Btn>
      </div>
    </>
  )
}

/** Per-phone location coverage across the week; gaps hatched by type. */
function CoverageChart() {
  const W = 760
  const L = 54
  const R = 8
  const row = 30
  const x = (m: number) => L + (m / (7 * 1440)) * (W - L - R)
  const H = CASE_PEOPLE.length * row + 22
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          {(Object.keys(GAP_STYLE) as (keyof typeof GAP_STYLE)[]).map((g) => (
            <pattern key={g} id={`cov-${g}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="var(--surface)" />
              <line x1="0" y1="0" x2="0" y2="5" stroke={GAP_STYLE[g].color} strokeWidth="2.2" />
            </pattern>
          ))}
        </defs>
        {Array.from({ length: 8 }, (_, d) => (
          <g key={d}>
            <line x1={x(d * 1440)} x2={x(d * 1440)} y1={0} y2={H - 18} stroke="var(--line)" />
            {d < 7 && (
              <text x={x(d * 1440) + 4} y={H - 5} fontSize={10.5} fill="var(--ink-3)">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]} {13 + d}
              </text>
            )}
          </g>
        ))}
        {CASE_PEOPLE.map((p, i) => {
          const y = i * row + 6
          const gaps = SEGMENTS.filter((s) => s.person === p && s.kind === 'gap')
          return (
            <g key={p}>
              <text x={0} y={y + 13} fontSize={11.5} fill="var(--ink)">
                {personName(p)}
              </text>
              <rect x={x(0)} y={y + 4} width={x(7 * 1440) - x(0)} height={12} rx={2} fill={personColor(p)} opacity={0.85} />
              {gaps.map((g) => (
                <g key={g.segment_id}>
                  <title>{`${personName(p)}: no location data ${fmtDate(g.start)} ${fmtTime(g.start)}–${fmtTime(g.end)} · ${g.gap_type}${g.raised ? ' · raised' : ''}`}</title>
                  <rect
                    x={x(caseMinutes(g.start))}
                    y={y + 1}
                    width={Math.max(3, x(caseMinutes(g.end)) - x(caseMinutes(g.start)))}
                    height={18}
                    rx={2}
                    fill={`url(#cov-${g.gap_type})`}
                    stroke={GAP_STYLE[g.gap_type!].color}
                    strokeWidth={1}
                  />
                </g>
              ))}
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-ink-3" /> location data present
        </span>
        {(Object.keys(GAP_STYLE) as (keyof typeof GAP_STYLE)[]).map((g) => (
          <span key={g} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm border" style={{ borderColor: GAP_STYLE[g].color, background: `repeating-linear-gradient(45deg, ${GAP_STYLE[g].color} 0 1.5px, transparent 1.5px 4px)` }} />
            {g}
          </span>
        ))}
      </div>
    </div>
  )
}
