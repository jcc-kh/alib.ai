import type { InquiryId, PersonId } from '../../../api'
import { useCase } from '../../../state/caseStore'
import { PRESENCE } from '../../../mock/derived'
import { FOUND_AT, POI, RAVI_END, SCENE, TOD, VICTIM, personOf } from '../../../mock/data'
import { fmtDate, fmtKm, fmtTime } from '../../../lib/format'
import Portrait from '../../../components/Portrait'
import PresenceGrid from '../../../components/PresenceGrid'
import { Panel } from '../kit'
import Scorecard from '../Scorecard'
import { INQUIRIES, InsightCard } from '../inquiries/meta'

export default function ReviewStep({ open }: { open: (v: InquiryId) => void }) {
  const c = useCase()
  const b = c.briefing
  if (!b) return null
  const v = personOf(VICTIM)
  const status = (p: PersonId) => {
    const ph = PRESENCE.phones.find((x) => x.person === p)!
    if (ph.counts.scene) return { text: 'at the scene', tone: 'text-serious' }
    if (ph.counts.no_data) return { text: `no location ${ph.counts.no_data} of ${ph.slots.length} slots`, tone: 'text-serious' }
    const min = Math.min(...ph.slots.map((s) => s.distance_m ?? Infinity))
    return { text: `≥ ${fmtKm(min)} away all window`, tone: 'text-ink-2' }
  }
  return (
    <div className="space-y-3 p-4">
      {/* case header */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-5 flex gap-4 rounded-lg border border-line bg-surface px-4 py-3">
          <Portrait id={VICTIM} size={64} />
          <div className="min-w-0 text-[12.5px]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Victim</div>
            <div className="text-[17px] font-semibold text-ink">{v.name}</div>
            <div className="text-ink-2">{v.role.replace('Victim. ', '')}</div>
            <div className="tnum mt-1.5 space-y-0.5 text-ink-2">
              <div>
                Found <span className="text-ink">{fmtDate(FOUND_AT)} {fmtTime(FOUND_AT)}</span> at <span className="text-ink">{SCENE.name}</span>
              </div>
              <div>
                Time of death <span className="text-ink">{fmtDate(TOD.start)} {fmtTime(TOD.start)}–{fmtTime(TOD.end)}</span> (medical examiner)
              </div>
              <div className="text-ink-3">Phone recovered at the scene · data ends {fmtDate(RAVI_END)} {fmtTime(RAVI_END)}</div>
            </div>
          </div>
        </div>
        <div className="col-span-7 rounded-lg border border-line bg-surface px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Persons of interest · their phones</div>
          <div className="mt-2 grid grid-cols-4 gap-3">
            {POI.map((p) => {
              const s = status(p)
              const n = b.incidents.filter((i) => i.people.includes(p)).length
              return (
                <div key={p} className="flex flex-col items-start">
                  <Portrait id={p} size={44} />
                  <div className="mt-1.5 text-[13px] font-semibold text-ink">{personOf(p).name}</div>
                  <div className="text-[11.5px] leading-snug text-ink-2">{personOf(p).role}</div>
                  <div className={`tnum mt-1 text-[11.5px] ${s.tone}`}>{s.text}</div>
                  <div className="tnum text-[11px] text-ink-3">in {n} insight{n === 1 ? '' : 's'}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-8 space-y-3">
          <Panel title="Insights" count={b.incidents.length} sub={`from ${b.signals_total} signals · ranked by checks agreeing, then phones`} pad={false}>
            <div className="grid grid-cols-2 gap-3 p-3">
              {b.incidents.map((i) => (
                <InsightCard key={i.incident_id} i={i} showInquiry onInquiry={open} />
              ))}
            </div>
          </Panel>
          <Panel
            title="The window at a glance"
            sub={`${fmtTime(TOD.start)}–${fmtTime(TOD.end)}, 16 April`}
            actions={
              <button onClick={() => open('window')} className="rounded-md px-2 py-1 text-[12px] text-ink-2 hover:bg-sunken">
                Open →
              </button>
            }
          >
            <PresenceGrid out={PRESENCE} compact />
          </Panel>
        </div>
        <div className="col-span-4 space-y-3">
          <Panel title="Lines of inquiry" pad={false}>
            <ul className="divide-y divide-line">
              {INQUIRIES.map((q) => {
                const n = b.incidents.filter((i) => i.inquiry === q.id).length
                return (
                  <li key={q.id}>
                    <button onClick={() => open(q.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-sunken">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-ink">{q.question}</span>
                        <span className="block truncate text-[11.5px] text-ink-3">{q.method}</span>
                      </span>
                      <span className="tnum rounded bg-sunken px-1.5 text-[11px] text-ink-2">{n}</span>
                      <span className="text-ink-3">→</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>
          <Scorecard />
          <Panel title="Set aside" count={b.dismissed.length} pad={false}>
            <ul className="divide-y divide-line">
              {b.dismissed.map((d) => (
                <li key={d.title} className="px-3 py-2">
                  <div className="text-[12.5px] text-ink">{d.title}</div>
                  <div className="text-[11.5px] text-ink-3">{d.rule}</div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
