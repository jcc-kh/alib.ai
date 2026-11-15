import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { PersonId } from '../../../api'
import { ALL_GAPS, HOME, NUMBERS, ROWS, SCENE, TOD, findPlace, haversine, personColor, personName, personOf } from '../../../mock/data'
import { SEGMENTS } from '../../../mock/segments'
import { caseMinutes, fmtKm } from '../../../lib/format'
import Portrait from '../../../components/Portrait'
import { useCase } from '../../../state/caseStore'

/**
 * Map over time: one map, one time axis. Drag the axis (or press play) and every examined phone moves
 * to where its location fixes put it at that moment. A phone with no location data stays at its last
 * fix, greyed out. The moments the insights rest on are marked on the axis, captioned on the map as
 * they pass, and listed beside it. Everything is read from the evidence rows, the stays table and the
 * insights; nothing is typed in.
 */

const DAY = 1440
const WEEK = 7 * DAY
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const at = (day: number, h: number, m = 0) => (day - 13) * DAY + h * 60 + m
const PRESETS = [
  { label: 'Night of the 16th', a: at(16, 17), b: at(17, 2) },
  { label: 'Morning after', a: at(17, 6), b: at(17, 14) },
  { label: 'Whole week', a: 0, b: WEEK },
]
const RUN_SECONDS = 28
/** Playback stops for this long on each moment an insight rests on, so it can be read. */
const HOLD_SECONDS = 1.7
const LANE_H = 26
const HEAD_H = 34
const MIN_SPAN = 120
const LABEL_W = 104
const STAGE_H = 520
const HATCH = 'repeating-linear-gradient(135deg, var(--ink-3) 0 1px, transparent 1px 5px)'

/**
 * The town in this case is invented, and its coordinates fall in open sea. For display only, every
 * point is shifted by one fixed offset so the town sits on a real harbour coastline, drawn without
 * street names. Distances and times are always computed from the case's own coordinates.
 */
const SHIFT = { lat: 0.3525, lon: -0.9385 }
const G = (lat: number, lon: number): [number, number] => [lat + SHIFT.lat, lon + SHIFT.lon]

const clock = (m: number) => {
  const r = ((Math.floor(m) % DAY) + DAY) % DAY
  return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`
}
const dayOf = (m: number) => 13 + Math.floor(m / DAY)
const dow = (m: number) => DOW[(dayOf(m) - 13) % 7]
const sceneM = (lat: number, lon: number) => haversine(lat, lon, SCENE.lat, SCENE.lon)

interface Fix { t: number; lat: number; lon: number; place: string | null; id: string }
interface Dark { from: number; to: number; why: string; short: string; ids: string[] }
interface Moment { t: number; label: string; people: PersonId[]; ids: string[]; serious: boolean }
interface Exchange { t: number; from: PersonId; to: PersonId }
interface Where { lat: number; lon: number; place: string | null; dark: Dark | null; last: Fix; ids: string[] }

const byNumber = new Map(Object.entries(NUMBERS).map(([p, n]) => [n, p as PersonId]))

function useCaseData(loaded: PersonId[], evidenceIds: Set<string>) {
  return useMemo(() => {
    const tracks = {} as Record<PersonId, Fix[]>
    const dark = {} as Record<PersonId, Dark[]>
    for (const p of loaded) {
      tracks[p] = []
      dark[p] = []
    }
    const moments = new Map<string, Moment>()
    const exchanges = new Map<string, Exchange>()
    for (const r of ROWS.values()) {
      const p = r.device_owner
      if (!loaded.includes(p)) continue
      const t = caseMinutes(r.timestamp)
      if (r.table === 'locations') {
        tracks[p].push({ t, lat: Number(r.fields.lat), lon: Number(r.fields.lon), place: r.fields.place_name ? String(r.fields.place_name) : null, id: r.id })
        continue
      }
      const from = byNumber.get(String(r.fields.from))
      const to = byNumber.get(String(r.fields.to))
      const between = from && to && from !== to && loaded.includes(from) && loaded.includes(to)
      const key = `${r.table}|${r.timestamp.slice(0, 19)}|${r.fields.body ?? r.fields.amount ?? r.fields.duration_s ?? r.fields.event_type}`
      if (between && (r.table === 'messages' || r.table === 'calls' || r.table === 'transactions')) exchanges.set(key, { t, from, to })
      if (!evidenceIds.has(r.id)) continue
      // A moment an insight rests on. The same call or text on two phones is one moment.
      const prev = moments.get(key)
      if (prev) {
        prev.ids.push(r.id)
        continue
      }
      const f = r.fields
      let label = r.summary
      let people: PersonId[] = [p]
      let serious = false
      if (r.table === 'device_events') {
        const type = String(f.event_type)
        const detail = String(f.detail ?? '')
        const who = detail.match(/\((\w+)\)/)?.[1]
        label = type === 'thread_deleted' ? `${personName(p)} deletes the ${detail.split(' ')[0]} thread${who ? ` with ${who}` : ''}` : type === 'power_off' ? `${personName(p)}'s phone is switched off` : type === 'power_on' ? `${personName(p)}'s phone is back on` : `${personName(p)}'s phone: ${detail}`
        serious = type !== 'power_on'
      } else if (between) {
        people = [from, to]
        if (r.table === 'messages') label = `${personName(from)} texts ${personName(to)}: “${f.body}”`
        else if (r.table === 'calls') label = `${personName(from)} calls ${personName(to)}, ${f.duration_s ? `${f.duration_s} seconds` : 'no answer'}`
        else if (r.table === 'transactions') label = `${personName(from)} pays ${personName(to)} $${Number(f.amount).toLocaleString()}${f.memo ? ` “${f.memo}”` : ''}`
      } else if (r.table !== 'messages' && r.table !== 'calls' && r.table !== 'transactions') continue
      moments.set(key, { t, label, people, ids: [r.id], serious })
    }
    for (const p of loaded) tracks[p].sort((a, b) => a.t - b.t)
    for (const g of ALL_GAPS) {
      if (!loaded.includes(g.person)) continue
      const power = g.power_event_ids.map((id) => ROWS.get(id)).filter(Boolean)
      const off = power.find((r) => r!.fields.event_type === 'power_off')
      const on = power.find((r) => r!.fields.event_type === 'power_on')
      const from = off ? caseMinutes(off.timestamp) : caseMinutes(g.start)
      const to = caseMinutes(g.bounding.after.t)
      const [why, short] = g.gap_type === 'powered_off' ? ['Switched off', 'off'] : g.gap_type === 'location_off' ? ['Location off, phone still in use', 'location off'] : ['No location data', 'no location']
      dark[g.person].push({ from, to: on ? Math.max(caseMinutes(on.timestamp), to) : to, why, short, ids: [g.bounding.before.id, ...g.power_event_ids, ...g.activity.map((a) => a.id), g.bounding.after.id] })
      // Location switched off leaves no log entry, so the gap itself is the moment.
      if (g.raised && g.gap_type === 'location_off') moments.set(`gap|${g.person}|${g.start}`, { t: from, label: `${personName(g.person)}'s phone stops reporting its location while still in use`, people: [g.person], ids: [g.bounding.before.id, ...g.activity.map((a) => a.id)], serious: true })
    }
    return { tracks, dark, moments: [...moments.values()].sort((a, b) => a.t - b.t), exchanges: [...exchanges.values()].sort((a, b) => a.t - b.t) }
  }, [loaded, evidenceIds])
}

/** Where a phone is at minute t: between two fixes, or held at its last fix while it has no data. */
function whereAt(track: Fix[], dark: Dark[], t: number): Where | null {
  if (!track.length) return null
  let lo = 0
  let hi = track.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (track[mid].t <= t) lo = mid
    else hi = mid - 1
  }
  const a = track[lo]
  const b = track[lo + 1]
  const gap = dark.find((g) => t >= g.from && t < g.to)
  if (gap) return { lat: a.lat, lon: a.lon, place: a.place, dark: gap, last: a, ids: gap.ids }
  if (!b && t - a.t > 15) return { lat: a.lat, lon: a.lon, place: a.place, dark: { from: a.t, to: Infinity, why: 'No data after this', short: 'data ends', ids: [a.id] }, last: a, ids: [a.id] }
  if (!b || t < a.t || b.t - a.t > 15) return { lat: a.lat, lon: a.lon, place: a.place, dark: null, last: a, ids: [a.id] }
  const f = (t - a.t) / (b.t - a.t)
  return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f, place: f < 0.5 ? a.place : b.place, dark: null, last: a, ids: [a.id, b.id] }
}

const pins = new Map<string, L.DivIcon>()
/** A phone on the map: its owner's portrait. With no location data it turns grey and says since when. */
function pin(p: PersonId, dark: Dark | null, ping = '') {
  const key = `${p}|${dark ? dark.from : ''}|${ping}`
  if (!pins.has(key)) {
    const ring = dark ? `outline:1.5px dashed var(--ink-2);outline-offset:2px;filter:grayscale(1);opacity:.85;` : `box-shadow:0 0 0 2px var(--surface),0 0 0 4px ${personColor(p)},0 3px 8px rgb(0 0 0 / .28);`
    const tag = dark ? `<div style="position:absolute;bottom:37px;left:50%;transform:translateX(-50%);white-space:nowrap;font:600 10.5px/1.5 system-ui;color:var(--serious);background:var(--surface);border-radius:3px;padding:0 5px;box-shadow:0 1px 3px rgb(0 0 0 / .2)">${personName(p)}, ${dark.short} since ${clock(dark.from)}</div>` : ''
    pins.set(key, L.divIcon({ className: '', iconSize: [30, 30], iconAnchor: [15, 15], html: `<div style="position:relative;width:30px;height:30px"><div style="width:30px;height:30px;border-radius:50%;overflow:hidden;background:var(--sunken);${ring}"><img src="${personOf(p).portrait}" alt="" style="width:100%;height:100%;object-fit:cover"/></div>${ping ? `<div class="map-ping" style="border-color:${ping}"></div>` : ''}${tag}</div>` }))
  }
  return pins.get(key)!
}
const scenePin = L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: `<div style="width:22px;height:22px;border-radius:50%;border:2px solid var(--serious);display:grid;place-items:center;background:color-mix(in srgb, var(--serious) 18%, transparent)"><div style="width:6px;height:6px;border-radius:50%;background:var(--serious)"></div></div>` })
const dotPin = L.divIcon({ className: '', iconSize: [7, 7], iconAnchor: [3.5, 3.5], html: `<div style="width:7px;height:7px;border-radius:50%;background:var(--surface);border:1.5px solid var(--ink-2)"></div>` })

function useTheme() {
  const read = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  const [theme, setTheme] = useState<'light' | 'dark'>(read)
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme(read()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])
  return theme
}

/** Hands the map object to the parent and tells it when the zoom changes. */
function Bridge({ onMap, onZoom }: { onMap: (m: L.Map) => void; onZoom: () => void }) {
  const map = useMap()
  useEffect(() => onMap(map), [map, onMap])
  useMapEvents({ zoomend: onZoom, resize: onZoom })
  return null
}

function Fit({ bounds }: { bounds: [number, number][] }) {
  const map = useMap()
  const key = JSON.stringify(bounds)
  useEffect(() => {
    const fit = () => {
      map.invalidateSize()
      map.fitBounds(bounds, { padding: [56, 56] })
    }
    const timer = setTimeout(fit, 60)
    const ro = new ResizeObserver(fit)
    ro.observe(map.getContainer())
    return () => {
      clearTimeout(timer)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

export default function MapTimeline() {
  const c = useCase()
  const theme = useTheme()
  const loaded = c.board.loaded
  const evidenceIds = useMemo(() => new Set(c.board.incidents.flatMap((i) => i.findings.flatMap((f) => f.evidence_ids))), [c.board.incidents])
  const { tracks, dark, moments, exchanges } = useCaseData(loaded, evidenceIds)
  const [range, setRange] = useState({ a: PRESETS[0].a, b: PRESETS[0].b })
  const [t, setT] = useState(at(16, 21, 16))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [close, setClose] = useState(false)
  const span = range.b - range.a
  const pct = (m: number) => ((m - range.a) / span) * 100
  const clamp = (m: number) => Math.min(range.b, Math.max(range.a, m))

  const tRef = useRef(t)
  const glide = useRef(0)
  const [map, setMap] = useState<L.Map | null>(null)
  const [zoomTick, setZoomTick] = useState(0)
  const bumpZoom = useCallback(() => setZoomTick((n) => n + 1), [])
  const put = (m: number) => {
    tRef.current = m
    setT(m)
  }

  // Playback runs through the quiet stretches and stops for a moment on each thing an insight rests on.
  useEffect(() => {
    if (!playing) return
    cancelAnimationFrame(glide.current)
    const stops = moments.map((m) => m.t)
    let raf = 0
    let last = performance.now()
    let hold = 0
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (hold > 0) hold -= dt
      else {
        const prev = tRef.current
        let next = prev + (dt * span * speed) / RUN_SECONDS
        const hit = stops.find((m) => m > prev + 1e-6 && m <= next)
        if (hit !== undefined) {
          next = hit
          hold = HOLD_SECONDS / speed
        }
        if (next >= range.b) {
          put(range.b)
          setPlaying(false)
          return
        }
        put(next)
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, range.b, span, speed, moments])
  useEffect(() => () => cancelAnimationFrame(glide.current), [])

  const pickRange = (a: number, b: number) => {
    cancelAnimationFrame(glide.current)
    setRange({ a, b })
    setPlaying(false)
    const prev = tRef.current
    put(prev >= a && prev <= b ? prev : (moments.find((m) => m.t >= a && m.t <= b)?.t ?? a))
  }
  /** Dragging: the time follows the pointer exactly. */
  const seekTo = (m: number) => {
    cancelAnimationFrame(glide.current)
    setPlaying(false)
    put(clamp(m))
  }
  /** Jumping to a moment: the time runs there quickly, so the phones are seen to move rather than teleport. */
  const glideTo = (m: number) => {
    cancelAnimationFrame(glide.current)
    setPlaying(false)
    const from = tRef.current
    const to = clamp(m)
    if (Math.abs(to - from) < 0.01 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return put(to)
    const t0 = performance.now()
    const run = (now: number) => {
      const k = Math.min(1, (now - t0) / 700)
      put(k >= 1 ? to : from + (to - from) * (1 - Math.pow(1 - k, 3)))
      if (k < 1) glide.current = requestAnimationFrame(run)
    }
    glide.current = requestAnimationFrame(run)
  }

  // ---- dragging: the time axis moves the playhead; the week bar moves or resizes the period
  const axis = useRef<HTMLDivElement>(null)
  const seekFromPointer = (e: ReactPointerEvent) => {
    const r = axis.current!.getBoundingClientRect()
    seekTo(range.a + ((e.clientX - r.left) / r.width) * span)
  }
  const week = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: 'move' | 'a' | 'b'; x: number; a: number; b: number } | null>(null)
  const weekMinute = (e: ReactPointerEvent) => {
    const r = week.current!.getBoundingClientRect()
    return ((e.clientX - r.left) / r.width) * WEEK
  }
  const weekDown = (e: ReactPointerEvent, mode: 'move' | 'a' | 'b' | 'jump') => {
    e.stopPropagation()
    week.current!.setPointerCapture(e.pointerId)
    let { a, b } = range
    if (mode === 'jump') {
      const mid = weekMinute(e)
      a = Math.min(WEEK - span, Math.max(0, mid - span / 2))
      b = a + span
      pickRange(a, b)
    }
    drag.current = { mode: mode === 'jump' ? 'move' : mode, x: weekMinute(e), a, b }
  }
  const weekMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || e.buttons !== 1) return
    const dx = weekMinute(e) - d.x
    const snap = (m: number) => Math.round(m / 30) * 30
    if (d.mode === 'move') {
      const a = snap(Math.min(WEEK - (d.b - d.a), Math.max(0, d.a + dx)))
      pickRange(a, a + (d.b - d.a))
    } else if (d.mode === 'a') pickRange(snap(Math.min(d.b - MIN_SPAN, Math.max(0, d.a + dx))), d.b)
    else pickRange(d.a, snap(Math.max(d.a + MIN_SPAN, Math.min(WEEK, d.b + dx))))
  }

  const here = useMemo(() => Object.fromEntries(loaded.map((p) => [p, whereAt(tracks[p], dark[p], t)])) as Record<PersonId, Where | null>, [loaded, tracks, dark, t])
  const inRange = moments.filter((m) => m.t >= range.a && m.t <= range.b)
  const current = [...inRange].reverse().find((m) => m.t <= t)
  const prevMoment = [...inRange].reverse().find((m) => m.t < t - 0.5)
  const nextMoment = inRange.find((m) => m.t > t + 0.5)
  const captioned = current && t - current.t <= Math.max(10, span * 0.09) ? current : null
  const struck = current && t - current.t < 0.5 ? current : null
  // Phones standing on the same spot are nudged apart on screen so every portrait can be seen.
  const spots = useMemo(() => {
    const out = {} as Record<PersonId, [number, number]>
    const placed: L.Point[] = []
    for (const p of loaded) {
      const w = here[p]
      if (!w) continue
      const ll = G(w.lat, w.lon)
      out[p] = ll
      if (!map) continue
      let pt = map.latLngToLayerPoint(ll)
      for (const q of placed) {
        const d = pt.distanceTo(q)
        if (d >= 30) continue
        const dir = d < 0.5 ? L.point(1, 0) : pt.subtract(q).divideBy(d)
        pt = pt.add(dir.multiplyBy(30 - d))
      }
      placed.push(pt)
      out[p] = [map.layerPointToLatLng(pt).lat, map.layerPointToLatLng(pt).lng]
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, here, map, zoomTick])
  const linkWindow = Math.max(4, span / 90)
  const links = exchanges.filter((x) => x.t <= t && x.t > t - linkWindow && here[x.from] && here[x.to])
  const tod = { a: caseMinutes(TOD.start), b: caseMinutes(TOD.end) }
  const inTod = t >= tod.a && t < tod.b
  // The map frames wherever the examined phones went during the chosen period, plus the scene. It does not move while you drag.
  const bounds = useMemo(() => {
    if (close) return [G(SCENE.lat + 0.02, SCENE.lon - 0.028), G(SCENE.lat - 0.008, SCENE.lon + 0.028)]
    const pts = loaded.flatMap((p) => tracks[p].filter((f) => f.t >= range.a && f.t <= range.b).map((f) => G(f.lat, f.lon)))
    return [...pts, G(SCENE.lat + 0.01, SCENE.lon - 0.014), G(SCENE.lat - 0.006, SCENE.lon + 0.014)]
  }, [loaded, tracks, range.a, range.b, close])
  const notes = useMemo(
    () => [
      ...['Harbor Rd lot', 'Harbor Supply Co.', 'Dock Cafe'].map((n) => ({ place: findPlace(n), text: n })),
      ...loaded.map((p) => ({ place: findPlace(HOME[p]), text: `${personName(p)}'s home` })),
    ]
      .filter((n) => n.place)
      // a label goes to the left of its dot when another place sits just east of it
      .map((n, _, all) => ({ ...n, left: all.some((o) => o !== n && o.place!.lon > n.place!.lon && o.place!.lon - n.place!.lon < 0.08 && Math.abs(o.place!.lat - n.place!.lat) < 0.006) })),
    [loaded],
  )
  const step = span <= 6 * 60 ? 30 : span <= 14 * 60 ? 60 : span <= 30 * 60 ? 180 : span <= 3 * DAY ? 360 : DAY
  const ticks: number[] = []
  for (let m = Math.ceil(range.a / step) * step; m <= range.b; m += step) ticks.push(m)

  const status = (p: PersonId, w: Where | null) => {
    if (!w) return { text: 'No location data in this case', far: '', bad: true }
    const d = sceneM(w.dark ? w.last.lat : w.lat, w.dark ? w.last.lon : w.lon)
    if (w.dark) return { text: `${w.dark.why} since ${clock(w.dark.from)}. Last seen ${w.last.place ? (w.last.place === HOME[p] ? 'at home' : `at ${w.last.place}`) : 'on the move'}, ${clock(w.last.t)}`, far: fmtKm(d), bad: true }
    return { text: d < 150 ? 'At Pier 9, the scene' : !w.place ? 'On the move' : w.place === HOME[p] ? 'At home' : `At ${w.place}`, far: d < 150 ? '' : fmtKm(d), bad: false, scene: d < 150 }
  }
  const list = useRef<HTMLOListElement>(null)
  const currentKey = current?.ids[0]
  useEffect(() => {
    const box = list.current
    const row = box?.querySelector<HTMLElement>('[data-on]')
    if (!box || !row) return
    const top = row.offsetTop - box.offsetTop
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTo({ top: top - box.clientHeight / 2 + row.offsetHeight / 2, behavior: 'smooth' })
  }, [currentKey])
  const openMoment = (m: Moment) => c.openEvidence({ title: `${clock(m.t)}, ${dow(m.t)} ${dayOf(m.t)} April`, people: m.people, points: [m.label, m.ids.length > 1 ? 'The same record is on both phones.' : 'This record is on one phone.'], ids: m.ids })

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ---------------- the map ---------------- */}
        <div className="relative" style={{ height: STAGE_H }}>
          <MapContainer bounds={bounds} zoomSnap={0.25} zoomDelta={0.5} attributionControl={false} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
            <TileLayer key={theme} url={`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${theme === 'dark' ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base'}/MapServer/tile/{z}/{y}/{x}`} maxNativeZoom={16} maxZoom={19} />
            <Circle center={G(SCENE.lat, SCENE.lon)} radius={1000} interactive={false} pathOptions={{ color: 'var(--serious)', weight: 1.25, dashArray: '2 6', fill: false, opacity: 0.85 }} />
            {notes.map((n) => (
              <Marker key={n.text + n.left} position={G(n.place!.lat, n.place!.lon)} icon={dotPin} interactive={false}>
                <Tooltip permanent direction={n.left ? 'left' : 'right'} offset={[n.left ? -5 : 5, 0]} className="map-note">
                  {n.text}
                </Tooltip>
              </Marker>
            ))}
            <Marker position={G(SCENE.lat, SCENE.lon)} icon={scenePin} interactive={false}>
              <Tooltip permanent direction="bottom" offset={[0, 10]} className="map-note">
                <span className="font-semibold text-serious">Pier 9, the scene</span>
              </Tooltip>
            </Marker>
            {loaded.map((p) => {
              const w = here[p]
              if (!w) return null
              const trail = tracks[p].filter((f) => f.t <= t && f.t >= t - Math.max(50, span / 10) && !dark[p].some((g) => f.t > g.from && f.t < g.to)).map((f) => G(f.lat, f.lon))
              if (!w.dark) trail.push(G(w.lat, w.lon))
              return <Polyline key={`trail-${p}`} positions={trail} interactive={false} pathOptions={{ color: personColor(p), weight: 3.5, opacity: 0.7, lineCap: 'round', lineJoin: 'round' }} />
            })}
            {links.map((x, k) => (
              <Polyline key={`link-${k}`} positions={[G(here[x.from]!.lat, here[x.from]!.lon), G(here[x.to]!.lat, here[x.to]!.lon)]} interactive={false} pathOptions={{ color: 'var(--ink)', weight: 1.5, dashArray: '1 6', lineCap: 'round', opacity: Math.max(0.2, 1 - (t - x.t) / linkWindow) }} />
            ))}
            {loaded.map((p) => {
              const w = here[p]
              if (!w) return null
              return <Marker key={p} position={spots[p] ?? G(w.lat, w.lon)} icon={pin(p, w.dark, struck?.people.includes(p) ? (struck.serious ? 'var(--serious)' : 'var(--ink)') : '')} zIndexOffset={w.dark ? 0 : 500} title={personName(p)} eventHandlers={{ click: () => c.openEvidence({ title: `${personName(p)}'s phone at ${clock(t)}, ${dow(t)} ${dayOf(t)} April`, people: [p], points: [`${status(p, w).text}.`], ids: w.ids }) }} />
            })}
            <Fit bounds={bounds} />
            <Bridge onMap={setMap} onZoom={bumpZoom} />
          </MapContainer>

          {/* the moment that has just passed, captioned on the map */}
          {captioned && (
            <button onClick={() => openMoment(captioned)} className="absolute bottom-4 left-4 z-[500] max-w-[min(34rem,72%)] rounded-md px-3.5 py-2.5 text-left shadow-lg transition hover:opacity-95" style={{ background: 'var(--ink)', color: 'var(--surface)' }} title="Open the evidence for this moment">
              <div className="flex items-baseline gap-2.5">
                <span className="tnum text-[13px] font-semibold" style={{ color: captioned.serious ? 'color-mix(in srgb, var(--serious) 55%, var(--surface))' : undefined }}>
                  {clock(captioned.t)}
                </span>
                <span className="text-[14px] leading-snug">{captioned.label}</span>
              </div>
            </button>
          )}
          <div className="absolute bottom-4 right-3 z-[500] flex flex-col items-end gap-1.5">
            <button onClick={() => setClose((v) => !v)} aria-pressed={close} className="rounded-md bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink shadow hover:bg-sunken">
              {close ? 'Show everywhere they went' : 'Zoom to Pier 9'}
            </button>
            <span className="rounded bg-surface/80 px-1.5 text-[10px] text-ink-3">Invented town on a real coastline. Base map: Esri, HERE, Garmin, © OpenStreetMap contributors</span>
          </div>
        </div>

        {/* ---------------- the moment in words ---------------- */}
        <aside className="flex min-h-0 flex-col border-t border-line lg:border-l lg:border-t-0" style={{ maxHeight: STAGE_H }}>
          <div className="px-4 pb-3 pt-3.5">
            <div className="flex items-end gap-2.5">
              <span className="tnum text-[44px] font-semibold leading-[0.9] tracking-tight text-ink">{clock(t)}</span>
              <span className="pb-0.5 text-[12px] leading-tight text-ink-2">
                {dow(t)} {dayOf(t)}
                <br />
                April
              </span>
            </div>
            <div className={`mt-2 h-4 text-[11.5px] font-medium ${inTod ? 'text-serious' : 'text-ink-3'}`}>{inTod ? 'Inside the time-of-death window' : t < tod.a ? `${fmtGap(tod.a - t)} before the time-of-death window` : `${fmtGap(t - tod.b)} after the time-of-death window`}</div>
          </div>
          <ul className="border-y border-line">
            {loaded.map((p, k) => {
              const s = status(p, here[p])
              return (
                <li key={p} className={`flex items-center gap-2.5 px-4 py-[7px] ${k ? 'border-t border-line/70' : ''}`}>
                  <Portrait id={p} size={26} dim={s.bad} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium leading-tight text-ink">{personName(p)}</div>
                    <div className={`text-[11.5px] leading-snug ${s.bad || s.scene ? 'text-serious' : 'text-ink-2'}`}>{s.text}</div>
                  </div>
                  {s.far && (
                    <div className="shrink-0 text-right">
                      <div className={`tnum text-[12.5px] font-medium ${s.bad ? 'text-serious' : 'text-ink'}`}>{s.far}</div>
                      <div className="text-[10px] text-ink-3">{s.bad ? 'last, from pier' : 'from pier'}</div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="flex min-h-0 flex-1 flex-col pt-2.5">
            <div className="px-4 pb-1 text-[11.5px] text-ink-3">{inRange.length ? `${inRange.length} moments the insights rest on` : 'No insight rests on anything in this period'}</div>
            <ol ref={list} className="min-h-0 flex-1 overflow-auto pb-2">
              {inRange.map((m) => {
                const on = current === m
                return (
                  <li key={m.ids[0]}>
                    <button data-on={on || undefined} onClick={() => glideTo(m.t)} className={`flex w-full items-baseline gap-2.5 border-l-2 py-1 pl-3.5 pr-4 text-left text-[12px] leading-snug transition hover:bg-sunken ${on ? 'border-ink bg-sunken' : 'border-transparent'} ${m.t > t ? 'opacity-55' : ''}`}>
                      <span className={`tnum w-9 shrink-0 text-[11.5px] ${m.serious ? 'font-semibold text-serious' : 'text-ink-3'}`}>{clock(m.t)}</span>
                      <span className="text-ink">{m.label}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        </aside>
      </div>

      {/* ---------------- time ---------------- */}
      <div className="border-t border-line px-4 pb-3 pt-3">
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => (t >= range.b ? (put(range.a), setPlaying(true)) : setPlaying((v) => !v))} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play this period. It stops briefly on each key moment'} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-surface hover:opacity-90">
            {playing ? (
              <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden>
                <rect width="3.6" height="12" fill="currentColor" />
                <rect x="7.4" width="3.6" height="12" fill="currentColor" />
              </svg>
            ) : (
              <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden>
                <path d="M1 0l10 6-10 6z" fill="currentColor" />
              </svg>
            )}
          </button>
          <button disabled={!prevMoment} onClick={() => prevMoment && glideTo(prevMoment.t)} className="rounded-md px-2 py-1 text-[12px] text-ink-2 hover:bg-sunken disabled:opacity-35">
            Previous moment
          </button>
          <button disabled={!nextMoment} onClick={() => nextMoment && glideTo(nextMoment.t)} className="rounded-md px-2 py-1 text-[12px] text-ink-2 hover:bg-sunken disabled:opacity-35">
            Next moment
          </button>
          <button onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 0.5 : 1))} className="tnum rounded-md px-2 py-1 text-[12px] text-ink-2 hover:bg-sunken" title="Playback speed">
            {speed}× speed
          </button>
          <div className="ml-auto flex items-center gap-1">
            {PRESETS.map((r) => {
              const on = range.a === r.a && range.b === r.b
              return (
                <button key={r.label} onClick={() => pickRange(r.a, r.b)} aria-pressed={on} className={`rounded-md px-2 py-1 text-[12px] transition ${on ? 'bg-sunken font-medium text-ink' : 'text-ink-2 hover:bg-sunken'}`}>
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* the week: drag the window to choose the period shown below */}
        <div className="flex items-center">
          <div className="shrink-0 text-[11.5px] text-ink-3" style={{ width: LABEL_W }}>
            Period shown
          </div>
          <div ref={week} onPointerDown={(e) => weekDown(e, 'jump')} onPointerMove={weekMove} onPointerUp={() => (drag.current = null)} className="relative h-7 min-w-0 flex-1 cursor-pointer touch-none select-none rounded-sm bg-sunken">
            {DOW.map((d, i) => (
              <div key={d} className={`absolute inset-y-0 flex items-center pl-1.5 text-[10.5px] text-ink-3 ${i ? 'border-l border-line-strong/60' : ''}`} style={{ left: `${(i / 7) * 100}%`, width: `${100 / 7}%` }}>
                {d} {13 + i}
              </div>
            ))}
            <div className="absolute inset-y-0" style={{ left: `${(tod.a / WEEK) * 100}%`, width: `${Math.max(0.35, ((tod.b - tod.a) / WEEK) * 100)}%`, background: 'var(--serious)' }} title="Time-of-death window" />
            {moments.map((m) => (
              <div key={m.ids[0]} className="absolute bottom-0.5 h-1 w-px" style={{ left: `${(m.t / WEEK) * 100}%`, background: m.serious ? 'var(--serious)' : 'var(--ink-2)' }} />
            ))}
            <div onPointerDown={(e) => weekDown(e, 'move')} className="absolute -inset-y-0.5 cursor-grab rounded-[3px] border-[1.5px] border-ink active:cursor-grabbing" style={{ left: `${(range.a / WEEK) * 100}%`, width: `${(span / WEEK) * 100}%`, background: 'color-mix(in srgb, var(--ink) 9%, transparent)' }} title="Drag to move the period; drag an edge to widen or narrow it">
              <div onPointerDown={(e) => weekDown(e, 'a')} className="absolute inset-y-0 -left-1 w-2 cursor-ew-resize" />
              <div onPointerDown={(e) => weekDown(e, 'b')} className="absolute inset-y-0 -right-1 w-2 cursor-ew-resize" />
            </div>
          </div>
        </div>

        {/* the period, one lane per phone */}
        <svg aria-hidden viewBox="0 0 100 12" preserveAspectRatio="none" className="block h-3" style={{ marginLeft: LABEL_W, width: `calc(100% - ${LABEL_W}px)` }}>
          <polygon points={`${(range.a / WEEK) * 100},0 ${(range.b / WEEK) * 100},0 100,12 0,12`} fill="var(--ink)" opacity="0.1" />
        </svg>
        <div className="relative select-none">
          <div className="flex items-end" style={{ height: HEAD_H }}>
            <div className="shrink-0 pb-1 text-[11.5px] text-ink-3" style={{ width: LABEL_W }}>
              Moments
            </div>
            <div className="relative h-full min-w-0 flex-1">
              {tod.b > range.a && tod.a < range.b && (
                <span className="absolute top-0 whitespace-nowrap pl-1 text-[10.5px] font-medium text-serious" style={{ left: `${Math.max(0, pct(tod.a))}%` }}>
                  time of death, {clock(tod.a)}–{clock(tod.b)}
                </span>
              )}
            </div>
          </div>
          {loaded.map((p) => (
            <div key={p} className="flex h-[26px] items-center">
              <div className="shrink-0" style={{ width: LABEL_W }}>
                <Portrait id={p} size={18} label />
              </div>
              <div className="relative h-[18px] min-w-0 flex-1 overflow-hidden rounded-[3px]" style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}>
                {SEGMENTS.filter((s) => s.person === p && caseMinutes(s.end) > range.a && caseMinutes(s.start) < range.b).map((s) => {
                  const a = Math.max(range.a, caseMinutes(s.start))
                  const b = Math.min(range.b, caseMinutes(s.end))
                  const w = pct(b) - pct(a)
                  const pl = findPlace(s.place)
                  const d = pl ? sceneM(pl.lat, pl.lon) : Infinity
                  const home = s.place === HOME[p]
                  const gap = s.kind === 'gap' ? dark[p].find((g) => g.from < b && g.to > a) : null
                  let style: CSSProperties
                  let text = ''
                  let ink = 'var(--ink-2)'
                  if (s.kind === 'gap') {
                    style = { background: HATCH, boxShadow: 'inset 0 0 0 1px var(--ink-3)' }
                    text = gap?.short ?? 'no location'
                    ink = 'var(--ink)'
                  } else if (s.kind === 'travel') style = { top: 8, bottom: 8, background: 'var(--ink-3)', opacity: 0.6 }
                  else if (d < 150) {
                    style = { background: 'var(--serious)' }
                    text = 'at Pier 9'
                    ink = 'var(--surface)'
                  } else if (d < 2000) {
                    style = { background: 'color-mix(in srgb, var(--warning) 55%, var(--surface))' }
                    text = `${s.place}, ${fmtKm(d)} away`
                    ink = 'var(--ink)'
                  } else {
                    style = { background: home ? 'color-mix(in srgb, var(--ink) 9%, transparent)' : 'color-mix(in srgb, var(--ink) 26%, transparent)' }
                    text = home ? 'home' : s.place?.startsWith('Unnamed') ? 'unnamed spot' : (s.place ?? '')
                  }
                  const what = s.kind === 'gap' ? (gap?.why ?? 'No location data') : s.kind === 'travel' ? 'On the move' : home ? 'Home' : s.place
                  return (
                    <div key={s.segment_id} title={`${personName(p)}: ${what}, ${clock(a)}–${clock(b)}`} className="absolute inset-y-0 overflow-hidden whitespace-nowrap" style={{ left: `${pct(a)}%`, width: `${w}%`, ...style }}>
                      {text && w > (s.kind === 'gap' ? 4 : 7) && (
                        <span className="absolute inset-y-0 left-1.5 flex items-center text-[10.5px] font-medium" style={{ color: ink }}>
                          {s.kind === 'gap' ? <span className="rounded-sm bg-surface px-1">{text}</span> : text}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {/* one layer over the lanes: the time-of-death band, the moments, the playhead, and dragging */}
          <div
            ref={axis}
            role="slider"
            tabIndex={0}
            aria-label="Time"
            aria-valuemin={range.a}
            aria-valuemax={range.b}
            aria-valuenow={Math.round(t)}
            aria-valuetext={`${clock(t)}, ${dow(t)} ${dayOf(t)} April`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              seekFromPointer(e)
            }}
            onPointerMove={(e) => e.buttons === 1 && seekFromPointer(e)}
            onKeyDown={(e) => {
              const d = e.shiftKey ? step : Math.max(1, span / 120)
              if (e.key === 'ArrowRight') seekTo(t + d)
              if (e.key === 'ArrowLeft') seekTo(t - d)
              if (e.key === ' ') {
                e.preventDefault()
                setPlaying((v) => !v)
              }
            }}
            className="absolute inset-y-0 right-0 cursor-ew-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{ left: LABEL_W }}
          >
            {tod.b > range.a && tod.a < range.b && (
              <div className="absolute bottom-0 border-x border-serious" style={{ top: 15, left: `${Math.max(0, pct(tod.a))}%`, width: `${Math.min(100, pct(tod.b)) - Math.max(0, pct(tod.a))}%`, background: 'color-mix(in srgb, var(--serious) 7%, transparent)' }} />
            )}
            {/* what has not happened yet is faded */}
            <div className="pointer-events-none absolute bottom-0 right-0" style={{ top: HEAD_H, left: `${Math.min(100, Math.max(0, pct(t)))}%`, background: 'color-mix(in srgb, var(--surface) 58%, transparent)' }} />
            {inRange.map((m) => {
              // a moment is marked on the lanes of the phones it involves; two phones are joined
              const rows = m.people.map((p) => loaded.indexOf(p)).filter((k) => k >= 0)
              const ys = rows.map((k) => HEAD_H + k * LANE_H + LANE_H / 2)
              const tone = m.serious ? 'var(--serious)' : 'var(--ink)'
              const on = current === m
              const ahead = m.t > t
              return (
                <button key={m.ids[0]} onPointerDown={(e) => e.stopPropagation()} onClick={() => glideTo(m.t)} title={`${clock(m.t)} ${m.label}`} aria-label={`${clock(m.t)} ${m.label}`} className="group absolute inset-y-0 w-3 -translate-x-1/2 cursor-pointer" style={{ left: `${pct(m.t)}%`, opacity: ahead ? 0.5 : 1 }}>
                  <span className="absolute left-1/2 w-px -translate-x-1/2" style={{ top: 26, height: Math.max(...ys, 26) - 26, background: tone, opacity: on ? 0.9 : 0.4 }} />
                  <span className="absolute left-1/2 h-[7px] w-[7px] -translate-x-1/2 rotate-45 transition-transform group-hover:scale-125" style={{ top: 20, background: tone, transform: on ? 'translateX(-50%) rotate(45deg) scale(1.35)' : undefined }} />
                  {ys.map((y) => (
                    <span key={y} className="absolute left-1/2 h-[7px] w-[7px] -translate-x-1/2 rounded-full" style={{ top: y - 3.5, background: tone, boxShadow: '0 0 0 1.5px var(--surface)' }} />
                  ))}
                </button>
              )
            })}
            <div className="pointer-events-none absolute inset-y-0 w-px bg-ink" style={{ left: `${Math.min(100, Math.max(0, pct(t)))}%` }}>
              <div className="tnum absolute -bottom-[19px] left-1/2 z-10 -translate-x-1/2 rounded-sm bg-ink px-1 text-[10.5px] font-semibold leading-[15px] text-surface">{clock(t)}</div>
            </div>
          </div>
        </div>
        <div className="relative mt-1 h-4" style={{ marginLeft: LABEL_W }}>
          {ticks.map((m) => (
            <span key={m} className="tnum absolute whitespace-nowrap text-[10.5px] text-ink-3" style={{ left: `${pct(m)}%`, transform: `translateX(${pct(m) < 2 ? 0 : pct(m) > 98 ? -100 : -50}%)` }}>
              {m % DAY === 0 ? `${dow(m)} ${dayOf(m)}` : clock(m)}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function fmtGap(min: number) {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  if (m < DAY) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`
  return `${Math.floor(m / DAY)} d ${Math.floor((m % DAY) / 60)} h`
}
