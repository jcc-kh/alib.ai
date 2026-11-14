import { useEffect, useState } from 'react'
import { getEvidence, type CaseInfo, type EvidenceByPhone, type Finding } from '../api'
import EvidenceRows from './evidence/EvidenceRows'
import MessagesDiff from './evidence/MessagesDiff'
import TrackMap from './evidence/TrackMap'
import MoneyChain from './evidence/MoneyChain'
import MeetingsList from './evidence/MeetingsList'
import SyncTimeline from './evidence/SyncTimeline'
import CoverageView from './evidence/CoverageView'
import RelationsGraph from './evidence/RelationsGraph'

type Tab = 'evidence' | 'graph'

export default function EvidencePanel({ finding, caseInfo }: { finding: Finding | null; caseInfo: CaseInfo }) {
  const [tab, setTab] = useState<Tab>('evidence')
  const [rows, setRows] = useState<EvidenceByPhone | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setRows(null)
    setErr(null)
    if (!finding) return
    let live = true
    getEvidence(finding.evidence_ids)
      .then((r) => live && setRows(r))
      .catch((e) => live && setErr(String(e.message ?? e)))
    return () => {
      live = false
    }
  }, [finding])

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-slate-200 px-3 pt-2 text-sm">
        {(
          [
            ['evidence', 'Evidence'],
            ['graph', 'Relations graph'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px rounded-t-md border-b-2 px-3 py-1.5 font-medium ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'graph' ? (
          <RelationsGraph />
        ) : !finding ? (
          <div className="mt-20 text-center text-sm text-slate-500">Select a finding to see the evidence from each phone.</div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="font-mono text-[11px] text-slate-500">
                {finding.id} · {finding.check} · by {finding.agent}
              </div>
              <p className="mt-1 text-sm font-medium leading-snug">{finding.statement}</p>
            </div>
            <CheckView finding={finding} caseInfo={caseInfo} />
            {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
            {rows ? <EvidenceRows rows={rows} /> : !err && <div className="pulse-dot text-sm text-slate-500">Loading evidence rows…</div>}
          </div>
        )}
      </div>
    </div>
  )
}

function CheckView({ finding, caseInfo }: { finding: Finding; caseInfo: CaseInfo }) {
  const o = finding.check_output
  switch (o.kind) {
    case 'missing':
      return <MessagesDiff out={o} />
    case 'distance':
      return <TrackMap out={o} places={caseInfo.places} />
    case 'chain':
      return <MoneyChain out={o} />
    case 'meetings':
      return <MeetingsList out={o} places={caseInfo.places} />
    case 'sync':
      return <SyncTimeline out={o} />
    case 'coverage':
      return <CoverageView out={o} />
  }
}
