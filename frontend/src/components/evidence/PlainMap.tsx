import type { ReactNode } from 'react'
import { CircleMarker, MapContainer, Tooltip } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import type { Place } from '../../api'

/** Leaflet map with no base tiles (the city is invented); draws the case's places as dots. */
export default function PlainMap({
  places,
  bounds,
  children,
  height = 300,
  labelNear,
  labelTol = 0.02,
}: {
  places: Place[]
  bounds: LatLngBoundsExpression
  children?: ReactNode
  height?: number
  /** If given, only places within ~2 km of one of these points get a text label. */
  labelNear?: [number, number][]
  /** Degrees around each labelNear point within which a place gets a label. */
  labelTol?: number
}) {
  const labelled = (p: Place) => !labelNear || labelNear.some(([la, lo]) => Math.abs(la - p.lat) < labelTol && Math.abs(lo - p.lon) < labelTol * 1.25)
  return (
    <div className="overflow-hidden rounded-xl border border-line" style={{ height }}>
      <MapContainer bounds={bounds} boundsOptions={{ padding: [40, 40] }} style={{ height: '100%', width: '100%' }} attributionControl={false} scrollWheelZoom={false}>
        {places.map((p) => (
          <CircleMarker key={p.name} center={[p.lat, p.lon]} radius={3.5} pathOptions={{ color: 'var(--ink-3)', fillColor: 'var(--surface)', fillOpacity: 1, weight: 1.2 }}>
            {labelled(p) ? (
              <Tooltip permanent direction="right" offset={[6, 0]} className="place-label">
                {p.name}
              </Tooltip>
            ) : (
              <Tooltip>{p.name}</Tooltip>
            )}
          </CircleMarker>
        ))}
        {children}
      </MapContainer>
    </div>
  )
}
