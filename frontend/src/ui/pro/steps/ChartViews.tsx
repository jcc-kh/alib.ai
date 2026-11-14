import { useMemo, useState } from 'react'
import { Btn, Panel, PersonTag } from '../kit'
import { ActivityChart, PAIRS, PairDistance, PlaceTime } from '../charts'
import { personName } from '../../../mock/data'
import { CASE_PEOPLE, hourlyActivity } from '../../../lib/aggregates'

const DAYS = [13, 14, 15, 16, 17, 18, 19]
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function ActivityView() {
  const rows = useMemo(
    () =>
      CASE_PEOPLE.map((p) => {
        const msg = hourlyActivity(p, ['messages'])
        const call = hourlyActivity(p, ['calls'])
        const both = msg.map((v, i) => v + call[i])
        const days = DAYS.map((_, d) => both.slice(d * 24, d * 24 + 24).reduce((a, b) => a + b, 0))
        const peak = both.indexOf(Math.max(...both))
        return { p, msgs: msg.reduce((a, b) => a + b, 0), calls: call.reduce((a, b) => a + b, 0), days, peak }
      }),
    [],
  )
  const max = Math.max(...rows.flatMap((r) => r.days), 1)
  return (
    <div className="space-y-3 p-4">
      <Panel title="Activity by phone" sub="hourly · drag the bar below to zoom">
        <ActivityChart height={360} />
      </Panel>
      <Panel title="Per day" pad={false}>
        <table className="w-full text-[12px]">
          <thead className="text-left text-[11px] text-ink-3">
            <tr className="border-b border-line">
              <th className="px-3 py-1.5 font-medium">Phone</th>
              {DAYS.map((d, i) => (
                <th key={d} className="py-1.5 text-right font-medium">
                  {DOW[i]} {d}
                </th>
              ))}
              <th className="py-1.5 text-right font-medium">Messages</th>
              <th className="py-1.5 text-right font-medium">Calls</th>
              <th className="px-3 py-1.5 text-right font-medium">Busiest hour</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p} className="border-b border-line last:border-0">
                <td className="px-3 py-1.5">
                  <PersonTag id={r.p} />
                </td>
                {r.days.map((v, i) => (
                  <td key={i} className="tnum py-1.5 text-right">
                    <span className="inline-block min-w-[2.5rem] rounded px-1.5" style={{ background: `color-mix(in srgb, var(--ink) ${Math.round((v / max) * 18)}%, transparent)` }}>
                      {v}
                    </span>
                  </td>
                ))}
                <td className="tnum py-1.5 text-right">{r.msgs.toLocaleString()}</td>
                <td className="tnum py-1.5 text-right">{r.calls}</td>
                <td className="tnum px-3 py-1.5 text-right text-ink-2">
                  {DOW[Math.floor(r.peak / 24)]} {String(r.peak % 24).padStart(2, '0')}:00
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

export function DistanceView() {
  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {PAIRS.map((p) => (
        <Panel key={p.join()} title={`${personName(p[0])} – ${personName(p[1])}`} sub="log scale · red ≤ 100 m">
          <PairDistance fixed={p} height={180} />
        </Panel>
      ))}
    </div>
  )
}

export function PlacesView() {
  const [day, setDay] = useState<number | 'week'>('week')
  const win: [number, number] | null = day === 'week' ? null : [(day - 13) * 1440, (day - 12) * 1440]
  const picker = (
    <div className="flex gap-1">
      <Btn kind={day === 'week' ? 'default' : 'ghost'} onClick={() => setDay('week')}>
        Week
      </Btn>
      {DAYS.map((d, i) => (
        <Btn key={d} kind={day === d ? 'default' : 'ghost'} onClick={() => setDay(d)}>
          {DOW[i]} {d}
        </Btn>
      ))}
    </div>
  )
  return (
    <div className="space-y-3 p-4">
      <Panel title="Time at places" sub="hours per phone" actions={picker}>
        <PlaceTime window={win} />
      </Panel>
    </div>
  )
}
