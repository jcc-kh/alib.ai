import { useState } from 'react'
import type { EvidenceByPhone, EvidenceRow } from '../api'
import { BUNDLE, PEOPLE, personColor, personName } from '../mock/data'
import { fmtDate, fmtTimeSec } from '../lib/format'
import { Eyebrow, Mono } from './ui'

export default function SourcesView({ rows }: { rows: EvidenceByPhone }) {
  const owners = PEOPLE.map((p) => p.person_id).filter((id) => rows[id]?.length)
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-line bg-panel p-4 text-xs">
        <div className="grid grid-cols-[7rem_1fr] gap-y-1.5">
          <span className="text-faint">Bundle</span>
          <span className="text-fg">{BUNDLE.name}</span>
          <span className="text-faint">SHA-256</span>
          <span className="break-all font-mono text-muted">{BUNDLE.sha256}</span>
          <span className="text-faint">Extracted by</span>
          <span className="text-muted">{BUNDLE.tool}</span>
        </div>
      </div>
      {owners.map((owner) => (
        <section key={owner}>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: personColor(owner) }} />
            <Eyebrow>{personName(owner)}'s phone · {rows[owner].length} rows</Eyebrow>
          </div>
          <div className="overflow-hidden rounded-lg border border-line">
            {rows[owner].map((r) => (
              <SourceRow key={r.id} r={r} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function SourceRow({ r }: { r: EvidenceRow }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-line last:border-0">
      <button onClick={() => setOpen(!open)} className="grid w-full grid-cols-[7.5rem_7.5rem_1fr_auto] items-start gap-3 px-3 py-2 text-left text-xs hover:bg-panel">
        <Mono className="text-muted">{r.id}</Mono>
        <span className="tabular-nums text-faint">
          {fmtDate(r.timestamp)} {fmtTimeSec(r.timestamp)}
        </span>
        <span className="text-fg/90">{r.summary}</span>
        <span className="text-faint">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="space-y-2 bg-panel px-3 pb-3 pt-1 text-xs">
          <div className="text-faint">
            <span className="font-mono text-azure-soft">{r.provenance.file}</span> line {r.provenance.line} · record_id{' '}
            <span className="font-mono">{r.provenance.record_id}</span> · extracted {fmtDate(r.provenance.extracted_at)}
          </div>
          <pre className="overflow-x-auto rounded-md border border-line bg-canvas p-2 font-mono text-[11px] text-muted">{r.provenance.raw}</pre>
        </div>
      )}
    </div>
  )
}
