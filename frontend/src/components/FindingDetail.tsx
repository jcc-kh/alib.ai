import { useEffect, useState } from 'react'
import { getEvidence, type EvidenceByPhone, type Finding } from '../api'
import { PLACES } from '../mock/data'
import { Mono, PersonChip, Tabs, Title, VerdictBadge } from './ui'
import SourcesView from './SourcesView'
import { ReadableRows } from './FindingDrawer'
import MessagesDiff from './evidence/MessagesDiff'
import TrackMap from './evidence/TrackMap'
import MoneyChain from './evidence/MoneyChain'
import MeetingsList from './evidence/MeetingsList'
import SyncTimeline from './evidence/SyncTimeline'
import CoverageView from './evidence/CoverageView'
import GapView from './evidence/GapView'
import { HostilityList, LastContactsList } from './evidence/SocialEvidence'
import PresenceGrid from './PresenceGrid'
import RadiusMap from './RadiusMap'

type Tab = 'evidence' | 'sources'

export default function FindingDetail({ finding }: { finding: Finding }) {
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
          <VerdictBadge v={finding.verdict === 'cannot_tell' ? 'cannot_tell' : 'sweep'} />
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
          ['sources', 'Sources (raw logs)'],
        ]}
      />

      {err && <div className="rounded-lg border border-terra/40 p-3 text-sm text-terra-soft">{err}</div>}

      <div className="rise" key={tab}>
        {tab === 'evidence' &&
          (o.kind === 'missing' ? (
            <MessagesDiff out={o} />
          ) : o.kind === 'distance' ? (
            <TrackMap out={o} places={PLACES} />
          ) : o.kind === 'chain' ? (
            <MoneyChain out={o} />
          ) : o.kind === 'meetings' ? (
            <MeetingsList out={o} places={PLACES} />
          ) : o.kind === 'sync' ? (
            <SyncTimeline out={o} />
          ) : o.kind === 'gap' ? (
            <GapView out={o} />
          ) : o.kind === 'presence' ? (
            <PresenceGrid out={o} compact />
          ) : o.kind === 'space' ? (
            <RadiusMap space={o} show={o.spaces.map((s) => s.person)} height={360} />
          ) : o.kind === 'hostility' ? (
            <HostilityList out={o} />
          ) : o.kind === 'last_contacts' ? (
            <LastContactsList out={o} />
          ) : (
            <CoverageView out={o} />
          ))}
        {tab === 'sources' && (rows ? <SourcesView rows={rows} /> : <Loading />)}
      </div>

      {tab === 'evidence' && rows && (
        <div className="border-t border-line pt-4">
          <ReadableRows rows={rows} />
        </div>
      )}
    </div>
  )
}

function Loading() {
  return <div className="pulse-dot text-sm text-faint">Loading source rows…</div>
}

