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
  return (
    <div className="space-y-3">
      <PlainMap places={places} bounds={[...a, ...b]} labelNear={[a[0], b[0]]}>
        <Polyline positions={[a[Math.floor(a.length / 2)], b[Math.floor(b.length / 2)]]} pathOptions={{ color: '#ef4444', weight: 1.5, dashArray: '6 6' }}>
          <Tooltip permanent direction="center" className="dist-label">
            median {fmtKm(out.median_m)}
          </Tooltip>
        </Polyline>
        <Polyline positions={a} pathOptions={{ color: ca, weight: 3 }} />
        <Polyline positions={b} pathOptions={{ color: cb, weight: 3 }} />
        {a.map((p, i) => (
          <CircleMarker key={`a${i}`} center={p} radius={3} pathOptions={{ color: ca, fillOpacity: 1 }} />
        ))}
        {b.map((p, i) => (
          <CircleMarker key={`b${i}`} center={p} radius={3} pathOptions={{ color: cb, fillOpacity: 1 }} />
        ))}
      </PlainMap>
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        {[
          ['Label', out.label],
          ['Min', fmtKm(out.min_m)],
          ['Median', fmtKm(out.median_m)],
          ['Max', fmtKm(out.max_m)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-50 py-1.5">
            <div className="text-slate-500">{k}</div>
            <div className={`font-semibold ${k === 'Label' ? 'uppercase text-red-700' : ''}`}>{v}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-1 flex gap-3 text-xs text-slate-500">
          <span>Distance per 10-minute slot</span>
          <span className="ml-auto inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: ca }} />{personName(out.person_a)}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: cb }} />{personName(out.person_b)}</span>
        </div>
        <div className="flex h-16 items-end gap-px">
          {out.slots.map((s) => (
            <div key={s.t} className="group relative flex-1">
              <div className="rounded-t bg-red-400" style={{ height: `${(s.distance_m / out.max_m) * 56}px` }} />
              <div className="absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                {fmtTime(s.t)} · {fmtKm(s.distance_m)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>{fmtTime(out.start)}</span>
          <span>together ≤ {out.thresholds.together_m} m · apart ≥ {out.thresholds.apart_m / 1000} km</span>
          <span>{fmtTime(out.end)}</span>
        </div>
      </div>
    </div>
  )
}
