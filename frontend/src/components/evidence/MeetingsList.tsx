import { CircleMarker, Tooltip } from 'react-leaflet'
import type { MeetingsOutput, Place } from '../../api'
import { personColor, personName } from '../../mock/data'
import { fmtTime } from '../../lib/format'
import PlainMap from './PlainMap'

export default function MeetingsList({ out, places }: { out: MeetingsOutput; places: Place[] }) {
  const pts = out.occasions.map((o) => [o.lat, o.lon] as [number, number])
  const nearby = places.filter((p) => Math.abs(p.lat - pts[0][0]) < 0.04 && Math.abs(p.lon - pts[0][1]) < 0.06)
  const max = Math.max(...out.occasions.map((o) => o.duration_min))
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[1fr_1fr] gap-4">
        <PlainMap places={nearby} bounds={[...pts, ...nearby.map((p) => [p.lat, p.lon] as [number, number])]} height={230}>
          {out.occasions.map((o, i) => (
            <CircleMarker key={i} center={[o.lat, o.lon]} radius={9 + i * 4} pathOptions={{ color: '#e8a33d', fillColor: '#e8a33d', fillOpacity: 0.08, weight: 1 }}>
              <Tooltip>{o.date}</Tooltip>
            </CircleMarker>
          ))}
        </PlainMap>
        <div className="flex flex-col justify-center rounded-xl border border-line p-5">
          <div className="font-serif text-6xl text-fg">{out.contact_rows_found}</div>
          <div className="mt-2 text-sm text-muted">
            messages or calls between {personName(out.person_a)} and {personName(out.person_b)} on any of the four phones.
          </div>
          <div className="mt-3 text-xs text-faint">Checked: {out.channels_checked.join(', ')}</div>
        </div>
      </div>
      <div className="space-y-3">
        {out.occasions.map((o) => (
          <div key={o.start} className="grid grid-cols-[4.5rem_1fr_7rem] items-center gap-4 text-sm">
            <span className="text-fg">{o.date}</span>
            <div className="relative h-6 rounded bg-panel">
              <div className="absolute inset-y-0 left-0 flex items-center rounded bg-amber/80 px-2 text-[11px] text-canvas" style={{ width: `${(o.duration_min / max) * 100}%` }}>
                {o.duration_min} min
              </div>
            </div>
            <span className="text-right text-xs text-faint">
              {fmtTime(o.start)}–{fmtTime(o.end)} · {o.min_distance_m} m
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 text-xs text-faint">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: personColor(out.person_a) }} />{personName(out.person_a)}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: personColor(out.person_b) }} />{personName(out.person_b)}</span>
        <span className="ml-auto">Rule: ≤ {out.thresholds.within_m} m for ≥ {out.thresholds.min_minutes} min on ≥ {out.thresholds.min_occasions} occasions, no contact</span>
      </div>
    </div>
  )
}
