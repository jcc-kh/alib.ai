import { Fragment } from 'react'
import { Circle, CircleMarker, Polyline, Tooltip } from 'react-leaflet'
import type { PersonId, SpaceOutput } from '../api'
import { PLACES, ROWS, personColor, personName } from '../mock/data'
import PlainMap from './evidence/PlainMap'
import { fmtKm, fmtTime } from '../lib/format'

/**
 * Activity-space map: each phone's routine area as a circle around its anchor (home), the scene with a
 * marker, and optionally each phone's track through a time window. The circles are drawn from stays on
 * 2+ days (see activity_space), not guessed; the legend says so.
 */
export default function RadiusMap({
  space,
  show,
  tracks,
  height = 420,
  focus,
}: {
  space: SpaceOutput
  show: PersonId[]
  /** Location row ids per phone to draw as a path (e.g. the time-of-death window). */
  tracks?: Partial<Record<PersonId, string[]>>
  height?: number
  focus?: PersonId | null
}) {
  const spaces = space.spaces.filter((s) => show.includes(s.person))
  const bounds = spaces.flatMap((s) => {
    const dLat = s.radius_m / 111320
    const dLon = s.radius_m / 84000
    return [
      [s.anchor.lat - dLat, s.anchor.lon - dLon],
      [s.anchor.lat + dLat, s.anchor.lon + dLon],
    ] as [number, number][]
  })
  const labelled = [...new Set(spaces.map((s) => s.anchor.name))]
  return (
    <PlainMap
      places={PLACES}
      bounds={bounds.length ? bounds : [[space.scene.lat - 0.05, space.scene.lon - 0.05], [space.scene.lat + 0.05, space.scene.lon + 0.05]]}
      height={height}
      labelNear={PLACES.filter((p) => labelled.includes(p.name)).map((p) => [p.lat, p.lon])}
      labelTol={0.0008}
    >
      {spaces.map((s) => {
        const on = !focus || focus === s.person
        return (
          <Circle
            key={s.person}
            center={[s.anchor.lat, s.anchor.lon]}
            radius={s.radius_m}
            pathOptions={{ color: personColor(s.person), weight: on ? 2 : 1, opacity: on ? 0.95 : 0.35, fillColor: personColor(s.person), fillOpacity: on ? (s.person === space.victim ? 0.1 : 0.07) : 0.02, dashArray: s.person === space.victim ? '6 4' : undefined }}
          >
            <Tooltip sticky>
              {personName(s.person)}: routine area {fmtKm(s.radius_m)} from {s.anchor.name}. Scene {s.scene_inside ? 'inside' : 'outside'} ({fmtKm(s.scene_distance_m)}).
            </Tooltip>
          </Circle>
        )
      })}
      {spaces.map((s) => (
        <CircleMarker key={`a-${s.person}`} center={[s.anchor.lat, s.anchor.lon]} radius={5} pathOptions={{ color: 'var(--surface)', weight: 2, fillColor: personColor(s.person), fillOpacity: 1 }}>
          <Tooltip>{`${personName(s.person)}'s anchor: ${s.anchor.name}`}</Tooltip>
        </CircleMarker>
      ))}
      {tracks &&
        (Object.entries(tracks) as [PersonId, string[]][]).map(([p, ids]) => {
          const pts = ids.map((id) => ROWS.get(id)).filter(Boolean).map((r) => ({ t: r!.timestamp, ll: [Number(r!.fields.lat), Number(r!.fields.lon)] as [number, number] }))
          if (!pts.length) return null
          const last = pts[pts.length - 1]
          return (
            <Fragment key={`t-${p}`}>
              <Polyline positions={pts.map((x) => x.ll)} pathOptions={{ color: personColor(p), weight: 2.5, opacity: 0.9 }} />
              {pts.map((x, i) => (
                <CircleMarker key={i} center={x.ll} radius={2.5} pathOptions={{ color: personColor(p), weight: 1, fillColor: personColor(p), fillOpacity: 1 }}>
                  <Tooltip>{`${personName(p)} ${fmtTime(x.t)}`}</Tooltip>
                </CircleMarker>
              ))}
              <CircleMarker center={last.ll} radius={5} pathOptions={{ color: personColor(p), weight: 2, fillColor: 'var(--surface)', fillOpacity: 1 }}>
                <Tooltip>{`${personName(p)}: last fix in window ${fmtTime(last.t)}`}</Tooltip>
              </CircleMarker>
            </Fragment>
          )
        })}
      <Circle center={[space.scene.lat, space.scene.lon]} radius={150} pathOptions={{ color: 'var(--serious)', weight: 2, fillColor: 'var(--serious)', fillOpacity: 0.25 }} />
      <CircleMarker center={[space.scene.lat, space.scene.lon]} radius={6} pathOptions={{ color: 'var(--surface)', weight: 2, fillColor: 'var(--serious)', fillOpacity: 1 }}>
        <Tooltip permanent direction="left" offset={[-8, 0]} className="place-label">
          Scene · {space.scene.name}
        </Tooltip>
      </CircleMarker>
    </PlainMap>
  )
}
