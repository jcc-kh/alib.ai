import { useEffect, useState } from 'react'
import { getEvidence, type EvidenceByPhone, type Finding } from '../api'
import { useCase } from '../state/caseStore'
import { Mono, PersonChip, Tabs, Title, VerdictBadge } from './ui'
import DerivationView from './DerivationView'
import VerifyView from './VerifyView'
import SourcesView from './SourcesView'
import MessagesDiff from './evidence/MessagesDiff'
import TrackMap from './evidence/TrackMap'
import MoneyChain from './evidence/MoneyChain'
import MeetingsList from './evidence/MeetingsList'
import SyncTimeline from './evidence/SyncTimeline'
import CoverageView from './evidence/CoverageView'
import GapView from './evidence/GapView'

type Tab = 'evidence' | 'how' | 'verify' | 'sources'

export default function FindingDetail({ finding }: { finding: Finding }) {
  const { caseInfo } = useCase()
  const [tab, setTab] = useState<Tab>('evidence')
  const [rows, setRows] = useState<EvidenceByPhone | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setRows(null)
    setErr(null)
    setTab('evidence')
    let live = true
    getEvidence(finding.evidence_ids)
      .then((r) => live && setRows(r))
      .catch((e) => live && setErr(String(e.message ?? e)))
    return () => {
      live = false
    }
  }, [finding])

  const phones = rows ? Object.keys(rows).length : 0
  const o = finding.check_output

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <VerdictBadge v={finding.section === 'unprompted' ? 'sweep' : finding.verdict} />
          <Mono>
            {finding.check} · {finding.agent}
          </Mono>
        </div>
        {finding.brief_item && <div className="text-sm italic text-faint">“{finding.brief_item}”</div>}
        <Title size="md">{finding.statement}</Title>
        <div className="flex flex-wrap items-center gap-2">
          {finding.people.map((p) => (
            <PersonChip key={p} id={p} />
          ))}
          <span className="ml-auto text-xs text-faint">
            {finding.evidence_ids.length} rows{rows ? ` from ${phones} phone${phones === 1 ? '' : 's'}` : ''}
          </span>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ['evidence', 'Evidence'],
          ['how', 'How we know'],
          ['verify', 'Verify'],
          ['sources', 'Sources'],
        ]}
      />

      {err && <div className="rounded-lg border border-terra/40 p-3 text-sm text-terra-soft">{err}</div>}

      <div className="rise" key={tab}>
        {tab === 'evidence' &&
          caseInfo &&
          (o.kind === 'missing' ? (
            <MessagesDiff out={o} />
          ) : o.kind === 'distance' ? (
            <TrackMap out={o} places={caseInfo.places} />
          ) : o.kind === 'chain' ? (
            <MoneyChain out={o} />
          ) : o.kind === 'meetings' ? (
            <MeetingsList out={o} places={caseInfo.places} />
          ) : o.kind === 'sync' ? (
            <SyncTimeline out={o} />
          ) : o.kind === 'gap' ? (
            <GapView out={o} />
          ) : (
            <CoverageView out={o} />
          ))}
        {tab === 'how' && <DerivationView finding={finding} />}
        {tab === 'verify' && (rows ? <VerifyView finding={finding} rows={rows} /> : <Loading />)}
        {tab === 'sources' && (rows ? <SourcesView rows={rows} /> : <Loading />)}
      </div>

      {tab === 'evidence' && (
        <div className="flex gap-3 border-t border-line pt-4 text-xs text-faint">
          <span>Want to check this yourself?</span>
          <button onClick={() => setTab('how')} className="text-muted underline-offset-4 hover:underline">
            See how we know
          </button>
          <span>·</span>
          <button onClick={() => setTab('verify')} className="text-muted underline-offset-4 hover:underline">
            Recompute from the raw rows
          </button>
        </div>
      )}
    </div>
  )
}

function Loading() {
  return <div className="pulse-dot text-sm text-faint">Loading source rows…</div>
}

