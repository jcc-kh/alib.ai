import { useMemo, useState } from 'react'
import type { PersonId, Segment } from '../../../api'
import { LAST, PRESENCE, SPACE } from '../../../mock/derived'
import { ALL_PHONES, ROWS, TOD } from '../../../mock/data'
import { SEGMENTS, GAP_OF } from '../../../mock/segments'
import { findingById } from '../../../mock/signals'
import { caseMinutes, fmtTime } from '../../../lib/format'
import PresenceGrid from '../../../components/PresenceGrid'
import RadiusMap from '../../../components/RadiusMap'
import LocationLanes from '../../../components/LocationLanes'
import { LastContactsList } from '../../../components/evidence/SocialEvidence'
import { useCase } from '../../../state/caseStore'
import { Panel } from '../kit'
import { InquiryHeader } from './meta'

export default function WindowView() {
  const c = useCase()
  const [sel, setSel] = useState<Segment | null>(null)
  // Each phone's fixes from 20:30 to 23:40: the journey through the window.
  const tracks = useMemo(() => {
    const lo = '2026-04-16T20:30'
    const hi = '2026-04-16T23:40'
    const out: Partial<Record<PersonId, string[]>> = {}
    for (const r of ROWS.values()) if (r.table === 'locations' && r.timestamp.slice(0, 16) >= lo && r.timestamp.slice(0, 16) <= hi) (out[r.device_owner] ??= []).push(r.id)
    for (const k of Object.keys(out)) out[k]!.sort((a, b) => ROWS.get(a)!.timestamp.localeCompare(ROWS.get(b)!.timestamp))
    return out
  }, [])
  const gap = sel?.kind === 'gap' ? GAP_OF.get(sel.segment_id) : undefined
  return (
    <div className="space-y-3 p-4">
      <InquiryHeader id="window" />
      <Panel title="Alibi grid" sub={`${fmtTime(TOD.start)}–${fmtTime(TOD.end)} on 16 April · from the medical examiner · scene = ${PRESENCE.scene.name}`}>
        <PresenceGrid out={PRESENCE} />
      </Panel>
      <div className="grid grid-cols-12 gap-3">
        <Panel title="Journeys through the window" className="col-span-7" sub="fixes 20:30–23:40 · ○ = last fix · circles = routine areas">
          <RadiusMap space={SPACE} show={ALL_PHONES} tracks={tracks} height={420} />
        </Panel>
        <Panel title="Ravi's last contacts" className="col-span-5" sub="from his phone, recovered at the scene" pad={false}>
          <div className="max-h-[440px] overflow-y-auto p-3">
            <LastContactsList out={LAST} />
          </div>
        </Panel>
      </div>
      <Panel title="Location timeline, 16 April 18:00 to 02:00" sub="stays · travel · gaps · click a gap">
        <LocationLanes
          segments={SEGMENTS}
          people={ALL_PHONES}
          t0={caseMinutes('2026-04-16T18:00:00-04:00')}
          t1={caseMinutes('2026-04-17T02:00:00-04:00')}
          rowH={44}
          width={1400}
          selected={sel?.segment_id}
          onSelect={setSel}
          markers={[{ person: 'ravi', t: LAST.last_active.t, label: `${fmtTime(LAST.last_active.t)} last outgoing text`, color: 'var(--serious)' }]}
        />
        {gap && (
          <div className="mt-2 flex items-center gap-3 rounded-md bg-sunken px-3 py-2 text-[12.5px]">
            <span className="text-ink">
              No location data {fmtTime(gap.start)}–{fmtTime(gap.end)} · {gap.gap_type.replace('_', ' ')} · {gap.activity.length} activity rows inside
            </span>
            {sel?.finding_id && findingById(sel.finding_id) && (
              <button onClick={() => c.openFinding(findingById(sel.finding_id!)!)} className="ml-auto rounded-md border border-line bg-surface px-2 py-1 text-[11.5px] text-ink">
                Open finding
              </button>
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}
