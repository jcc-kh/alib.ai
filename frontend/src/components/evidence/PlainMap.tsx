import type { ReactNode } from 'react'
import { CircleMarker, MapContainer, Tooltip } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import type { Place } from '../../api'

/** Leaflet map with no base tiles (the city is invented); draws the case's places as labelled dots. */
export default function PlainMap({
  places,
  bounds,
  children,
  height = 260,
  labelNear,
}: {
  places: Place[]
  bounds: LatLngBoundsExpression
  children?: ReactNode
  height?: number
  /** If given, only places within ~2 km of one of these points get a text label. */
  labelNear?: [number, number][]
}) {
  const labelled = (p: Place) => !labelNear || labelNear.some(([la, lo]) => Math.abs(la - p.lat) < 0.02 && Math.abs(lo - p.lon) < 0.025)
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200" style={{ height }}>
      <MapContainer bounds={bounds} boundsOptions={{ padding: [30, 30] }} style={{ height: '100%', width: '100%' }} attributionControl={false} scrollWheelZoom={false}>
        {places.map((p) => (
          <CircleMarker key={p.name} center={[p.lat, p.lon]} radius={4} pathOptions={{ color: '#64748b', fillColor: '#fff', fillOpacity: 1, weight: 1.5 }}>
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
