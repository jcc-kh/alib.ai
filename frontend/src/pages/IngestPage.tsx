import { useState } from 'react'
import { ingest, type IngestReport, type IngestStage } from '../api'
import { INGEST_STAGES } from '../mock/ingest'
import { personColor, personName } from '../mock/data'
import { fmtDate } from '../lib/format'

const TREE = `harbor-supply-case/
├─ manifest.json        case id, timezone, devices
├─ persons.jsonl        people + identifiers
└─ devices/<device_id>/
   ├─ device.json       owner, model, extraction
   ├─ contacts.jsonl
   ├─ messages.jsonl    SMS, WhatsApp, DMs
   ├─ calls.jsonl
   ├─ locations.jsonl
   ├─ transactions.jsonl
   ├─ device_events.jsonl
   ├─ social_accounts.jsonl
   └─ social_interactions.jsonl`

const COLS = ['contacts', 'messages', 'calls', 'locations', 'transactions', 'device_events', 'social_interactions']

export default function IngestPage({ onOpenCase }: { onOpenCase: () => void }) {
  const [stages, setStages] = useState<IngestStage[]>(INGEST_STAGES)
  const [report, setReport] = useState<IngestReport | null>(null)
  const [running, setRunning] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function run(file: File | null) {
    setRunning(true)
    setReport(null)
    const r = await ingest(file, setStages)
    setReport(r)
    setRunning(false)
  }

  return (
    <div className="mx-auto grid h-full max-w-7xl grid-cols-[380px_1fr] gap-5 overflow-auto p-5">
      <section className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Ingest a case bundle</h1>
          <p className="mt-1 text-sm text-slate-600">
            Alib.ai reads any phone extraction once it is converted to the <b>Case Bundle v1</b> format. One folder per device, one JSONL
            file per record type. People are referenced by identifiers (phone, email, handle), not by name.
          </p>
        </div>
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            run(e.dataTransfer.files[0] ?? null)
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center text-sm transition ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-slate-400'
          }`}
        >
          <input type="file" accept=".zip" className="hidden" onChange={(e) => run(e.target.files?.[0] ?? null)} disabled={running} />
          <div className="text-3xl">⇪</div>
          <div className="mt-2 font-medium">Drop a bundle .zip here</div>
          <div className="text-slate-500">or click to choose a file</div>
        </label>
        <button
          onClick={() => run(null)}
          disabled={running}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {running ? 'Ingesting…' : 'Load sample bundle (Harbor Supply case)'}
        </button>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Expected layout</div>
          <pre className="overflow-x-auto text-[11px] leading-relaxed text-slate-700">{TREE}</pre>
          <p className="mt-2 text-xs text-slate-500">
            Full field spec: <code>schema/case-bundle-v1/README.md</code>
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Pipeline</div>
          <ol className="grid grid-cols-6 gap-2">
            {stages.map((s, i) => (
              <li
                key={s.id}
                className={`rounded-lg border p-2.5 text-xs ${
                  s.status === 'done' ? 'border-emerald-300 bg-emerald-50' : s.status === 'running' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <span>{s.status === 'done' ? '✓' : s.status === 'running' ? <span className="pulse-dot">●</span> : i + 1}</span>
                  {s.label}
                </div>
                <div className="mt-1 text-slate-600">{s.detail}</div>
              </li>
            ))}
          </ol>
        </div>

        {report ? (
          <>
            <div className="grid grid-cols-4 gap-3">
              {[
                ['Bundle', report.bundle_name],
                ['Schema', report.schema_version],
                ['Rows checked', report.rows_checked.toLocaleString()],
                ['Errors', String(report.errors)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">{k}</div>
                  <div className={`truncate text-lg font-semibold ${k === 'Errors' && v === '0' ? 'text-emerald-600' : ''}`}>{v}</div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Device</th>
                    <th className="px-3 py-2">Owner</th>
                    <th className="px-3 py-2">Coverage</th>
                    {COLS.map((c) => (
                      <th key={c} className="px-2 py-2 text-right">
                        {c.replace('_', ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.devices.map((d) => (
                    <tr key={d.device_id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <div className="font-mono text-xs">{d.device_id}</div>
                        <div className="text-xs text-slate-500">{d.model}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: personColor(d.owner) }} />
                          {personName(d.owner)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {fmtDate(d.coverage_start)}–{fmtDate(d.coverage_end)}
                      </td>
                      {COLS.map((c) => (
                        <td key={c} className="px-2 py-2 text-right tabular-nums">
                          {d.counts[c]?.toLocaleString() ?? '–'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ingest notes</div>
              <ul className="space-y-1.5 text-sm">
                {report.warnings.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span className={`mt-0.5 shrink-0 rounded px-1.5 text-[10px] font-semibold uppercase ${w.level === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                      {w.level}
                    </span>
                    {w.message}
                  </li>
                ))}
              </ul>
            </div>

            <button onClick={onOpenCase} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
              Open case →
            </button>
          </>
        ) : (
          <div className="grid h-64 place-items-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500">
            {running ? 'Running the ingest pipeline…' : 'Load the sample bundle to see the ingest report.'}
          </div>
        )}
      </section>
    </div>
  )
}
