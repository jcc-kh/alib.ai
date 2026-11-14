import { useMemo } from 'react'
import { HOSTILE, PEOPLE } from '../../../mock/data'
import { PRESENCE } from '../../../mock/derived'
import { socialByDay, socialItems } from '../../../lib/aggregates'
import { fmtDate, fmtKm, fmtTime } from '../../../lib/format'
import { HostilityList } from '../../../components/evidence/SocialEvidence'
import Portrait from '../../../components/Portrait'
import { DISMISSALS } from '../../../mock/signals'
import { Panel } from '../kit'
import { HostilityTimeline } from '../charts'
import { InquiryHeader } from './meta'

export default function MotiveView() {
  const byDay = useMemo(() => socialByDay(), [])
  const items = useMemo(() => socialItems(), [])
  const amyPost = DISMISSALS.find((d) => d.title.includes('Done being lied to'))
  return (
    <div className="space-y-3 p-4">
      <InquiryHeader id="motive" />
      <Panel title="Every post over the week" sub="one row per account · size and colour = hostility score · hover to read">
        <HostilityTimeline />
      </Panel>
      <div className="grid grid-cols-12 gap-3">
        <Panel title={`Flagged: ${PEOPLE.find((p) => p.person_id === HOSTILE.actor)!.handle} about ${PEOPLE.find((p) => p.person_id === HOSTILE.target)!.handle}`} className="col-span-7" sub={`${HOSTILE.flagged} of ${HOSTILE.items.length} ≥ ${HOSTILE.threshold}`}>
          <HostilityList out={HOSTILE} />
        </Panel>
        <div className="col-span-5 space-y-3">
          <Panel title="Each account" pad={false}>
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-[11px] text-ink-3">
                <tr className="border-b border-line">
                  <th className="px-3 py-1.5 font-medium">Account</th>
                  <th className="py-1.5 text-right font-medium">Posts</th>
                  <th className="py-1.5 text-right font-medium">Highest</th>
                  <th className="px-3 py-1.5 font-medium">In the window</th>
                </tr>
              </thead>
              <tbody>
                {byDay.map((b) => {
                  const posts = b.days.reduce((a, d) => a + d.posts, 0)
                  const max = Math.max(...b.days.map((d) => d.max))
                  const ph = PRESENCE.phones.find((x) => x.person === b.person)!
                  const minD = Math.min(...ph.slots.map((s) => s.distance_m ?? Infinity))
                  return (
                    <tr key={b.person} className="border-b border-line last:border-0">
                      <td className="px-3 py-1.5">
                        <Portrait id={b.person} size={22} label />
                      </td>
                      <td className="tnum py-1.5 text-right">{posts}</td>
                      <td className="tnum py-1.5 text-right" style={{ color: max >= HOSTILE.threshold ? 'var(--serious)' : undefined }}>
                        {max.toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-[11.5px] text-ink-2">
                        {ph.counts.scene ? 'at the scene' : ph.counts.no_data ? `no data ${ph.counts.no_data} slots` : `≥ ${fmtKm(minD)} away`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Panel>
          {amyPost && (
            <Panel title="Set aside" sub="below the threshold">
              <div className="text-[12.5px] text-ink">{amyPost.title}</div>
              <div className="mt-0.5 text-[12px] text-ink-2">{amyPost.reason}</div>
            </Panel>
          )}
          <Panel title="Latest posts" pad={false}>
            <ul className="max-h-[220px] divide-y divide-line overflow-y-auto">
              {items.slice(0, 14).map((i) => (
                <li key={i.id} className="flex items-start gap-2 px-3 py-1.5 text-[12px]">
                  <Portrait id={i.person} size={20} ring={false} />
                  <span className="min-w-0 flex-1">
                    <span className="text-ink-3">
                      {fmtDate(i.t)} {fmtTime(i.t)} ·{' '}
                    </span>
                    <span className="text-ink">{i.text}</span>
                  </span>
                  <span className="tnum shrink-0" style={{ color: i.score >= HOSTILE.threshold ? 'var(--serious)' : 'var(--ink-3)' }}>
                    {i.score.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
