import { ALL_GAPS, SYNC, TOD } from '../../../mock/data'
import { findingById } from '../../../mock/signals'
import { fmtDate, fmtTime } from '../../../lib/format'
import SyncTimeline from '../../../components/evidence/SyncTimeline'
import { GAP_STYLE } from '../../../components/LocationLanes'
import Portrait from '../../../components/Portrait'
import { useCase } from '../../../state/caseStore'
import { Panel } from '../kit'
import { ActivityChart, NightProfiles } from '../charts'
import { InquiryHeader } from './meta'

export default function ChangesView() {
  const c = useCase()
  const overlapsTod = (g: (typeof ALL_GAPS)[number]) => g.start <= TOD.end && g.end >= TOD.start
  return (
    <div className="space-y-3 p-4">
      <InquiryHeader id="changes" />
      <div className="grid grid-cols-12 gap-3">
        <Panel title="That night against a normal night" className="col-span-6" sub="activity per hour, 18:00–02:00 · shaded = time-of-death hours">
          <NightProfiles night={16} />
        </Panel>
        <Panel title="After the news" className="col-span-6" sub={`17 April · alert at ${fmtTime(SYNC.trigger!.t)} · ${SYNC.phones.length} phones within ${SYNC.window.minutes} min`}>
          <SyncTimeline out={SYNC} />
        </Panel>
      </div>
      <Panel title="The week" sub="hourly">
        <ActivityChart />
      </Panel>
      <Panel title="Location gaps ≥ 45 min" count={ALL_GAPS.length} pad={false} sub="raised only when the phone was in use, or the gap overlaps the window or another signal">
        <table className="w-full text-[12.5px]">
          <thead className="text-left text-[11px] text-ink-3">
            <tr className="border-b border-line">
              <th className="px-3 py-1.5 font-medium">Phone</th>
              <th className="py-1.5 font-medium">No location data</th>
              <th className="py-1.5 text-right font-medium">Minutes</th>
              <th className="px-3 py-1.5 font-medium">Type</th>
              <th className="py-1.5 font-medium">Why raised or not</th>
              <th className="px-3 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {[...ALL_GAPS]
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((g) => {
                const own = c.briefing?.incidents.flatMap((i) => i.findings).find((x) => x.check_output.kind === 'gap' && x.check_output.person === g.person && x.check_output.start === g.start)
                const f = g.raised ? (own ?? findingById('INC-2:f1')) : undefined
                return (
                  <tr key={g.start + g.person} className="border-b border-line last:border-0">
                    <td className="px-3 py-1.5">
                      <Portrait id={g.person} size={22} label />
                    </td>
                    <td className="tnum py-1.5 text-ink-2">
                      {fmtDate(g.start)} {fmtTime(g.start)}–{fmtTime(g.end)}
                    </td>
                    <td className="tnum py-1.5 text-right">{g.minutes}</td>
                    <td className="px-3 py-1.5">
                      <span style={{ color: GAP_STYLE[g.gap_type].color }}>{g.gap_type.replace('_', ' ')}</span>
                    </td>
                    <td className="py-1.5 text-ink-2">
                      {g.raised ? <span className="text-serious">▲ raised · </span> : <span className="text-ink-3">not raised · </span>}
                      {g.gap_type === 'location_off' ? `phone in use (${g.activity.length} rows inside)` : overlapsTod(g) ? 'overlaps the time-of-death window' : g.raised ? 'overlaps the post-news deletions' : g.gap_type === 'powered_off' ? 'switched off, nothing overlaps' : 'no activity, nothing overlaps'}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {f && (
                        <button onClick={() => c.openFinding(f)} className="rounded-md border border-line px-2 py-0.5 text-[11.5px] text-ink hover:bg-sunken">
                          Evidence
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
