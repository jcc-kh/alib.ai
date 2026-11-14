import { useState } from 'react'
import type { PersonId } from '../../../api'
import { SPACE } from '../../../mock/derived'
import { ALL_PHONES, personName } from '../../../mock/data'
import { fmtDate, fmtKm } from '../../../lib/format'
import RadiusMap from '../../../components/RadiusMap'
import Portrait from '../../../components/Portrait'
import { Panel } from '../kit'
import { DistanceToScene, PlaceTime } from '../charts'
import { InquiryHeader } from './meta'

export default function RadiusView() {
  const [show, setShow] = useState<PersonId[]>(ALL_PHONES)
  const [focus, setFocus] = useState<PersonId | null>(null)
  const toggle = (p: PersonId) => setShow((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]))
  const victim = SPACE.spaces.find((s) => s.person === SPACE.victim)!
  return (
    <div className="space-y-3 p-4">
      <InquiryHeader id="radius" />
      <div className="grid grid-cols-12 gap-3">
        <Panel title="Routine areas and the scene" className="col-span-8" sub={`circle = home + farthest place visited on ${SPACE.rule.min_days}+ days, plus ${SPACE.rule.buffer_m} m`}>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {ALL_PHONES.map((p) => (
              <button key={p} onClick={() => toggle(p)} onMouseEnter={() => setFocus(p)} onMouseLeave={() => setFocus(null)} className={`rounded-full border py-0.5 pl-0.5 pr-2.5 ${show.includes(p) ? 'border-line-strong' : 'border-line opacity-50'}`}>
                <Portrait id={p} size={22} label />
              </button>
            ))}
          </div>
          <RadiusMap space={SPACE} show={show} focus={focus} height={460} />
          <p className="mt-2 text-[11.5px] text-ink-3">
            A routine area is context, not evidence: it says whether being at Pier 9 would be ordinary for that phone. Circles are built from stays on {SPACE.rule.min_days}+ separate days, so a single trip (like Paul’s on the 16th) does not widen them.
          </p>
        </Panel>
        <div className="col-span-4 space-y-2">
          {SPACE.spaces.map((s) => (
            <button
              key={s.person}
              onMouseEnter={() => setFocus(s.person)}
              onMouseLeave={() => setFocus(null)}
              className={`block w-full rounded-lg border bg-surface px-3 py-2.5 text-left ${focus === s.person ? 'border-ink' : 'border-line'}`}
            >
              <div className="flex items-center gap-2">
                <Portrait id={s.person} size={30} label />
                <span className={`ml-auto rounded px-1.5 py-px text-[11px] font-medium ${s.scene_inside ? 'bg-serious/10 text-serious' : 'bg-sunken text-ink-2'}`}>
                  {s.scene_inside ? '● scene inside' : '○ scene outside'}
                </span>
              </div>
              <div className="tnum mt-1.5 grid grid-cols-3 gap-2 text-[11.5px]">
                <div>
                  <div className="text-ink-3">radius</div>
                  <div className="text-ink">{fmtKm(s.radius_m)}</div>
                </div>
                <div>
                  <div className="text-ink-3">home → scene</div>
                  <div className="text-ink">{fmtKm(s.scene_distance_m)}</div>
                </div>
                <div>
                  <div className="text-ink-3">{s.person === SPACE.victim ? 'days at scene' : 'overlap w/ victim'}</div>
                  <div className="text-ink">{s.person === SPACE.victim ? s.scene_visits.length : `${Math.round(s.overlap_with_victim * 100)}%`}</div>
                </div>
              </div>
              <div className="mt-1.5 text-[11px] text-ink-3">
                Routine: {s.routine.length ? s.routine.map((r) => `${r.name} (${r.days}d)`).join(', ') : 'home only'}
                {s.scene_visits.length > 0 && s.person !== SPACE.victim && <> · at Pier 9 on {s.scene_visits.map((v) => fmtDate(v.first)).join(', ')}</>}
              </div>
            </button>
          ))}
          <div className="px-1 text-[11px] text-ink-3">Overlap = share of the phone’s circle inside {personName(victim.person)}’s ({fmtKm(victim.radius_m)}).</div>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-3">
        <Panel title="Distance to the scene, evening of 16 April" className="col-span-8" sub="log scale">
          <DistanceToScene />
        </Panel>
        <Panel title="Time at places" className="col-span-4" sub="whole week, hours">
          <PlaceTime />
        </Panel>
      </div>
    </div>
  )
}
