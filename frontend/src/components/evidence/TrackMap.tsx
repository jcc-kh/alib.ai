import { CircleMarker, Polyline, Tooltip } from 'react-leaflet'
import type { DistanceOutput, Place } from '../../api'
import { personColor, personName } from '../../mock/data'
import { fmtKm, fmtTime } from '../../lib/format'
import PlainMap from './PlainMap'

export default function TrackMap({ out, places }: { out: DistanceOutput; places: Place[] }) {
  const a = out.slots.map((s) => [s.a.lat, s.a.lon] as [number, number])
  const b = out.slots.map((s) => [s.b.lat, s.b.lon] as [number, number])
  const ca = personColor(out.person_a)
  const cb = personColor(out.person_b)
  const mid = Math.floor(a.length / 2)
  return (
    <div className="space-y-6">
      <PlainMap places={places} bounds={[...a, ...b]} labelNear={[a[0], b[0]]}>
        <Polyline positions={[a[mid], b[mid]]} pathOptions={{ color: '#e07a5f', weight: 1.2, dashArray: '5 7' }}>
          <Tooltip permanent direction="center" className="dist-label">
            {fmtKm(out.median_m)}
          </Tooltip>
        </Polyline>
        {a.map((p, i) => <CircleMarker key={`a${i}`} center={p} radius={3} pathOptions={{ color: ca, fillColor: ca, fillOpacity: 1, weight: 0 }} />)}
        {b.map((p, i) => <CircleMarker key={`b${i}`} center={p} radius={3} pathOptions={{ color: cb, fillColor: cb, fillOpacity: 1, weight: 0 }} />)}
      </PlainMap>
      <div className="grid grid-cols-4 divide-x divide-line rounded-xl border border-line">
        {[
          ['Label', out.label],
          ['Closest', fmtKm(out.min_m)],
          ['Median', fmtKm(out.median_m)],
          ['Furthest', fmtKm(out.max_m)],
        ].map(([k, v]) => (
          <div key={k} className="px-4 py-3">
            <div className="text-[11px] text-faint">{k}</div>
            <div className={`font-serif text-2xl ${k === 'Label' ? 'text-terra-soft' : 'text-fg'}`}>{v}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-2 flex gap-4 text-xs text-faint">
          <span>Distance at each 10-minute slot</span>
          <span className="ml-auto inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: ca }} />{personName(out.person_a)}'s phone</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: cb }} />{personName(out.person_b)}'s phone</span>
        </div>
        <div className="flex h-20 items-end gap-[3px]">
          {out.slots.map((s) => (
            <div key={s.t} className="group relative flex-1">
              <div className="rounded-sm bg-terra/70 transition group-hover:bg-terra-soft" style={{ height: `${(s.distance_m / out.max_m) * 72}px` }} />
              <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-raised px-2 py-0.5 text-[10px] text-fg group-hover:block">
                {fmtTime(s.t)} · {fmtKm(s.distance_m)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10.5px] text-faint">
          <span>{fmtTime(out.start)}</span>
          <span>together ≤ {out.thresholds.together_m} m · apart ≥ {out.thresholds.apart_m / 1000} km</span>
          <span>{fmtTime(out.end)}</span>
        </div>
      </div>
    </div>
  )
}
