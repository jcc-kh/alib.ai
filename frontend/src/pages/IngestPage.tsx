import { useState } from 'react'
import { ingest, type IngestReport, type IngestStage } from '../api'
import { INGEST_STAGES } from '../mock/ingest'
import { personColor, personName } from '../mock/data'
import { fmtDate } from '../lib/format'
import { useApp } from '../state'
import { Eyebrow, Stat, Title } from '../components/ui'

const COLS: [string, string][] = [
  ['messages', 'Messages'],
  ['calls', 'Calls'],
  ['locations', 'Locations'],
  ['transactions', 'Transfers'],
  ['device_events', 'Device events'],
  ['social_interactions', 'Social'],
]

export default function IngestPage() {
  const { go } = useApp()
  const [stages, setStages] = useState<IngestStage[]>(INGEST_STAGES)
  const [report, setReport] = useState<IngestReport | null>(null)
  const [running, setRunning] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function run(file: File | null) {
    setRunning(true)
    setReport(null)
    setReport(await ingest(file, setStages))
    setRunning(false)
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <section className="frame glow px-6 pb-20 pt-28 text-center">
        <Eyebrow>Step 1 · Bring the phones</Eyebrow>
        <Title size="xl" className="mx-auto mt-4 max-w-3xl">
          Every alibi, checked against every phone.
        </Title>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
          Load the extractions from each phone in a case. Alib.ai lines them up, finds where the stories and the data disagree, and shows you exactly how it
          knows.
        </p>
        <div className="mx-auto mt-10 flex max-w-xl flex-col items-center gap-5">
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
            className={`flex w-full cursor-pointer flex-col items-center rounded-2xl border border-dashed px-8 py-10 transition ${
              dragOver ? 'border-azure-soft bg-azure/10' : 'border-line-strong hover:border-muted'
            }`}
          >
            <input type="file" accept=".zip" className="hidden" onChange={(e) => run(e.target.files?.[0] ?? null)} disabled={running} />
            <div className="font-serif text-2xl text-fg">Drop a case bundle</div>
            <div className="mt-1 text-sm text-faint">.zip in Case Bundle v1 format · one folder per phone</div>
          </label>
          <button onClick={() => run(null)} disabled={running} className="btn-primary px-6 py-2.5 text-sm font-medium">
            {running ? 'Ingesting…' : 'Load the sample case'}
          </button>
        </div>
      </section>

      <div className="dot-rule" />
      <section className="frame px-12 py-12">
        <Eyebrow className="mb-6">Ingest pipeline</Eyebrow>
        <ol className="grid grid-cols-6">
          {stages.map((s, i) => (
            <li key={s.id} className="relative pr-6">
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] ${
                    s.status === 'done' ? 'border-sage text-sage' : s.status === 'running' ? 'pulse-dot border-azure-soft text-azure-soft' : 'border-line-strong text-faint'
                  }`}
                >
                  {s.status === 'done' ? '✓' : i + 1}
                </span>
                {i < stages.length - 1 && <span className={`h-px flex-1 ${s.status === 'done' ? 'bg-sage/50' : 'bg-line'}`} />}
              </div>
              <div className={`mt-3 text-sm ${s.status === 'pending' ? 'text-faint' : 'text-fg'}`}>{s.label}</div>
              <div className="mt-1 text-xs leading-relaxed text-faint">{s.detail}</div>
            </li>
          ))}
        </ol>
      </section>

      {report && (
        <>
          <div className="dot-rule" />
          <section className="frame rise px-12 py-12">
            <div className="grid grid-cols-4 gap-6">
              <Stat label="Phones" value={String(report.devices.length)} />
              <Stat label="Rows checked" value={report.rows_checked.toLocaleString()} />
              <Stat label="Files read" value={String(report.files_read)} />
              <Stat label="Errors" value={String(report.errors)} />
            </div>

            <div className="mt-12 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-faint">
                    <th className="px-5 py-3 font-normal">Phone</th>
                    <th className="px-3 py-3 font-normal">Coverage</th>
                    {COLS.map(([k, l]) => (
                      <th key={k} className="px-3 py-3 text-right font-normal">
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.devices.map((d) => (
                    <tr key={d.device_id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: personColor(d.owner) }} />
                          <span className="text-fg">{personName(d.owner)}</span>
                          <span className="font-mono text-[11px] text-faint">{d.device_id}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-muted">
                        {fmtDate(d.coverage_start)} – {fmtDate(d.coverage_end)}
                      </td>
                      {COLS.map(([k]) => (
                        <td key={k} className="px-3 py-3.5 text-right tabular-nums text-muted">
                          {d.counts[k]?.toLocaleString() ?? '–'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <details className="mt-6 text-sm">
              <summary className="cursor-pointer text-muted hover:text-fg">
                {report.warnings.length} ingest notes ({report.warnings.filter((w) => w.level === 'warn').length} warnings)
              </summary>
              <ul className="mt-3 space-y-2">
                {report.warnings.map((w, i) => (
                  <li key={i} className="flex gap-3 text-muted">
                    <span className={`w-12 shrink-0 text-[11px] uppercase tracking-wider ${w.level === 'warn' ? 'text-amber' : 'text-faint'}`}>{w.level}</span>
                    {w.message}
                  </li>
                ))}
              </ul>
            </details>

            <div className="mt-10 flex items-center gap-5">
              <button onClick={() => go('briefing')} className="btn-primary px-6 py-2.5 text-sm font-medium">
                Read the briefing →
              </button>
              <span className="text-sm text-faint">Alib.ai has already swept the phones and prepared what stands out.</span>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
