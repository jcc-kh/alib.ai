import { CircleMarker, Tooltip } from 'react-leaflet'
import type { MeetingsOutput, Place } from '../../api'
import { personColor, personName } from '../../mock/data'
import { fmtTime } from '../../lib/format'
import PlainMap from './PlainMap'

export default function MeetingsList({ out, places }: { out: MeetingsOutput; places: Place[] }) {
  const pts = out.occasions.map((o) => [o.lat, o.lon] as [number, number])
  const nearby = places.filter((p) => Math.abs(p.lat - pts[0][0]) < 0.04 && Math.abs(p.lon - pts[0][1]) < 0.06)
  return (
    <div className="space-y-3">
      <PlainMap places={nearby} bounds={[...pts, ...nearby.map((p) => [p.lat, p.lon] as [number, number])]} height={200}>
        {out.occasions.map((o, i) => (
          <CircleMarker key={i} center={[o.lat, o.lon]} radius={10 + i * 3} pathOptions={{ color: personColor(out.person_b), fillColor: personColor(out.person_a), fillOpacity: 0.15, weight: 1.5 }}>
            <Tooltip>{o.date}</Tooltip>
          </CircleMarker>
        ))}
      </PlainMap>
      <table className="w-full text-xs">
        <thead className="text-left text-slate-500">
          <tr>
            <th className="py-1">Date</th>
            <th>Place</th>
            <th>Time</th>
            <th className="text-right">Duration</th>
            <th className="text-right">Closest</th>
          </tr>
        </thead>
        <tbody>
          {out.occasions.map((o) => (
            <tr key={o.start} className="border-t border-slate-100">
              <td className="py-1.5 font-medium">{o.date}</td>
              <td>{o.place}</td>
              <td className="tabular-nums">
                {fmtTime(o.start)}–{fmtTime(o.end)}
              </td>
              <td className="text-right tabular-nums">{o.duration_min} min</td>
              <td className="text-right tabular-nums">{o.min_distance_m} m</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
        <b>{out.contact_rows_found}</b> messages or calls between {personName(out.person_a)} and {personName(out.person_b)} exist on any of the four phones (checked:{' '}
        {out.channels_checked.join(', ')}).
      </div>
      <div className="text-[10px] text-slate-500">
        Rule: within {out.thresholds.within_m} m for ≥{out.thresholds.min_minutes} min on ≥{out.thresholds.min_occasions} occasions, with no recorded contact.
      </div>
    </div>
  )
}
