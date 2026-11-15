import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Circle, CircleMarker, Marker, Polyline, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { PersonId } from '../../../api'
import { ALL_GAPS, HOME, NUMBERS, PLACES, ROWS, SCENE, TOD, findPlace, haversine, personColor, personName, personOf } from '../../../mock/data'
import { SEGMENTS } from '../../../mock/segments'
import { caseMinutes, fmtKm } from '../../../lib/format'
import PlainMap from '../../../components/evidence/PlainMap'
import Portrait from '../../../components/Portrait'
import { useCase } from '../../../state/caseStore'

/**
 * Map over time: one map, one time axis. Drag the axis (or press play) and every examined phone moves
 * to where its location fixes put it at that moment. A phone with no location data stays at its last
 * fix, greyed out. The moments the insights rest on are flagged on the axis and listed beside the map.
 * Everything is read from the evidence rows, the stays table and the insights; nothing is typed in.
 */

const DAY = 1440
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const at = (day: number, h: number, m = 0) => (day - 13) * DAY + h * 60 + m
const RANGES = [
  { id: 'night', label: 'Night of the 16th', a: at(16, 17), b: at(17, 2) },
  { id: 'after', label: 'Morning after', a: at(17, 6), b: at(17, 14) },
  ...[13, 14, 15, 16, 17].map((d) => ({ id: `d${d}`, label: `${DOW[d - 13]} ${d}`, a: at(d, 0), b: at(d + 1, 0) })),
  { id: 'week', label: 'Whole week', a: at(13, 0), b: at(20, 0) },
]
type Range = (typeof RANGES)[number]
const RUN_SECONDS = 40
const HATCH = 'repeating-linear-gradient(45deg, var(--line-strong) 0 1.5px, transparent 1.5px 6px)'
const LABEL_W = 96
const MAP_H = 480

const clock = (m: number) => {
  const r = ((Math.floor(m) % DAY) + DAY) % DAY
  return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`
}
const dayOf = (m: number) => 13 + Math.floor(m / DAY)
const dayLabel = (m: number) => `${DOW[(dayOf(m) - 13) % 7]} ${dayOf(m)} April`

interface Fix { t: number; lat: number; lon: number; place: string | null; id: string }
interface Dark { from: number; to: number; why: string; ids: string[] }
interface Moment { t: number; label: string; people: PersonId[]; ids: string[]; serious: boolean }
interface Exchange { t: number; from: PersonId; to: PersonId }
interface Where { lat: number; lon: number; place: string | null; dark: Dark | null; last: Fix; ids: string[] }

const byNumber = new Map(Object.entries(NUMBERS).map(([p, n]) => [n, p as PersonId]))
const sceneM = (lat: number, lon: number) => haversine(lat, lon, SCENE.lat, SCENE.lon)

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
      const why = g.gap_type === 'powered_off' ? 'switched off' : g.gap_type === 'location_off' ? 'location off, phone still in use' : 'no location data'
      dark[g.person].push({ from, to: on ? Math.max(caseMinutes(on.timestamp), to) : to, why, ids: [g.bounding.before.id, ...g.power_event_ids, ...g.activity.map((a) => a.id), g.bounding.after.id] })
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
  if (!b) return t - a.t > 15 ? { lat: a.lat, lon: a.lon, place: a.place, dark: { from: a.t, to: Infinity, why: 'no data after this', ids: [a.id] }, last: a, ids: [a.id] } : { lat: a.lat, lon: a.lon, place: a.place, dark: null, last: a, ids: [a.id] }
  if (t < a.t || b.t - a.t > 15) return { lat: a.lat, lon: a.lon, place: a.place, dark: null, last: a, ids: [a.id] }
  const f = (t - a.t) / (b.t - a.t)
  return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f, place: f < 0.5 ? a.place : b.place, dark: null, last: a, ids: [a.id, b.id] }
}

const pinCache = new Map<string, L.DivIcon>()
function pin(p: PersonId, dark: boolean) {
  const key = `${p}|${dark}`
  if (!pinCache.has(key)) {
    const ring = dark ? `outline:2px dashed ${personColor(p)};outline-offset:2px;filter:grayscale(1);opacity:.8;` : `box-shadow:0 0 0 2px var(--surface),0 0 0 4.5px ${personColor(p)};`
    pinCache.set(key, L.divIcon({ className: '', iconSize: [28, 28], iconAnchor: [14, 14], html: `<div style="width:28px;height:28px;border-radius:50%;overflow:hidden;background:var(--sunken);${ring}"><img src="${personOf(p).portrait}" alt="" style="width:100%;height:100%;object-fit:cover"/></div>` }))
  }
  return pinCache.get(key)!
}

export default function MapTimeline() {
  const c = useCase()
  const loaded = c.board.loaded
  const evidenceIds = useMemo(() => new Set(c.board.incidents.flatMap((i) => i.findings.flatMap((f) => f.evidence_ids))), [c.board.incidents])
  const { tracks, dark, moments, exchanges } = useCaseData(loaded, evidenceIds)
  const [range, setRange] = useState<Range>(RANGES[0])
  const [t, setT] = useState(at(16, 21, 16))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [close, setClose] = useState(false)
  const span = range.b - range.a
  const pct = (m: number) => ((m - range.a) / span) * 100

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setT((prev) => {
        const next = prev + (dt * span * speed) / RUN_SECONDS
        if (next >= range.b) {
          setPlaying(false)
          return range.b
        }
        return next
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, range, span, speed])

  const pickRange = (r: Range) => {
    setRange(r)
    setPlaying(false)
    setT((prev) => (prev >= r.a && prev <= r.b ? prev : (moments.find((m) => m.t >= r.a && m.t <= r.b)?.t ?? r.a)))
  }
  const seekTo = (m: number) => {
    setPlaying(false)
    setT(Math.min(range.b, Math.max(range.a, m)))
  }
  const strip = useRef<HTMLDivElement>(null)
  const seekFromPointer = (e: ReactPointerEvent) => {
    const r = strip.current!.getBoundingClientRect()
    seekTo(range.a + ((e.clientX - r.left) / r.width) * span)
  }

  const here = useMemo(() => Object.fromEntries(loaded.map((p) => [p, whereAt(tracks[p], dark[p], t)])) as Record<PersonId, Where | null>, [loaded, tracks, dark, t])
  const inRange = moments.filter((m) => m.t >= range.a && m.t <= range.b)
  const current = [...inRange].reverse().find((m) => m.t <= t)
  const prevMoment = [...inRange].reverse().find((m) => m.t < t - 0.5)
  const nextMoment = inRange.find((m) => m.t > t + 0.5)
  const linkWindow = Math.max(4, span / 90)
  const links = exchanges.filter((x) => x.t <= t && x.t > t - linkWindow && here[x.from] && here[x.to])
  const tod = { a: caseMinutes(TOD.start), b: caseMinutes(TOD.end) }
  const inTod = t >= tod.a && t < tod.b
  // The map frames wherever the examined phones went during the chosen period, plus the scene. It does not move while you drag.
  const bounds = useMemo(() => {
    if (close) return [[SCENE.lat + 0.022, SCENE.lon - 0.03], [SCENE.lat - 0.012, SCENE.lon + 0.03]] as [number, number][]
    const pts = loaded.flatMap((p) => tracks[p].filter((f) => f.t >= range.a && f.t <= range.b).map((f) => [f.lat, f.lon] as [number, number]))
    return [...pts, [SCENE.lat + 0.012, SCENE.lon] as [number, number], [SCENE.lat - 0.012, SCENE.lon - 0.016] as [number, number], [SCENE.lat, SCENE.lon + 0.016] as [number, number]]
  }, [loaded, tracks, range, close])
  // Named on the map: the places the story turns on, and each examined person's home.
  const notes = useMemo(
    () => [
      ...['Harbor Rd lot', 'Harbor Supply Co.', 'Dock Cafe'].map((n) => ({ place: findPlace(n), text: n, dir: 'right' as const })),
      ...loaded.map((p) => ({ place: findPlace(HOME[p]), text: `${personName(p)}'s home`, dir: 'left' as const })),
    ].filter((n) => n.place),
    [loaded],
  )
  const step = span <= 12 * 60 ? 60 : span <= 36 * 60 ? 180 : DAY
  const ticks: number[] = []
  for (let m = Math.ceil(range.a / step) * step; m <= range.b; m += step) ticks.push(m)

  const status = (p: PersonId, w: Where | null) => {
    if (!w) return { text: 'No location data', bad: true }
    if (w.dark) return { text: `${w.dark.why[0].toUpperCase()}${w.dark.why.slice(1)}. Last fix ${clock(w.last.t)}${w.last.place ? ` at ${w.last.place === HOME[p] ? 'home' : w.last.place}` : ''}, ${fmtKm(sceneM(w.last.lat, w.last.lon))} from Pier 9`, bad: true }
    const d = sceneM(w.lat, w.lon)
    const where = !w.place ? 'On the move' : w.place === HOME[p] ? 'At home' : `At ${w.place}`
    return { text: `${where}${d < 150 ? ', the scene' : `, ${fmtKm(d)} from Pier 9`}`, bad: false, scene: d < 150 }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5">
        <h2 className="text-[13.5px] font-semibold text-ink">Map over time</h2>
        <span className="text-[12px] text-ink-2">Drag the time axis below the map, or press play. Each portrait is a phone, placed by its location fixes.</span>
        <div className="ml-auto flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => pickRange(r)} aria-pressed={range.id === r.id} className={`rounded-md px-2 py-1 text-[11.5px] transition ${range.id === r.id ? 'bg-ink font-medium text-surface' : 'text-ink-2 hover:bg-sunken'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="relative border-b border-line lg:border-b-0 lg:border-r" style={{ height: MAP_H }}>
          <PlainMap places={PLACES.filter((p) => p.name !== SCENE.name)} bounds={bounds} height={MAP_H} labelNear={[]}>
            {notes.map((n) => (
              <CircleMarker key={n.text} center={[n.place!.lat, n.place!.lon]} radius={1} pathOptions={{ opacity: 0, fillOpacity: 0 }} interactive={false}>
                <Tooltip permanent direction={n.dir} offset={[n.dir === 'right' ? 7 : -7, 0]} className="map-note">
                  {n.text}
                </Tooltip>
              </CircleMarker>
            ))}
            <Circle center={[SCENE.lat, SCENE.lon]} radius={1000} pathOptions={{ color: 'var(--serious)', weight: 1, dashArray: '3 6', fill: false, opacity: 0.7 }} />
            <Circle center={[SCENE.lat, SCENE.lon]} radius={150} pathOptions={{ color: 'var(--serious)', weight: 2, fillColor: 'var(--serious)', fillOpacity: 0.25 }} />
            <CircleMarker center={[SCENE.lat, SCENE.lon]} radius={5} pathOptions={{ color: 'var(--surface)', weight: 2, fillColor: 'var(--serious)', fillOpacity: 1 }}>
              <Tooltip permanent direction="bottom" offset={[0, 8]} className="map-note">
                <span className="font-semibold text-serious">Scene · {SCENE.name}</span>
              </Tooltip>
            </CircleMarker>
            {loaded.map((p) => {
              const w = here[p]
              if (!w) return null
              const trail = tracks[p].filter((f) => f.t <= t && f.t >= t - Math.max(45, span / 12) && !dark[p].some((g) => f.t > g.from && f.t < g.to)).map((f) => [f.lat, f.lon] as [number, number])
              if (!w.dark) trail.push([w.lat, w.lon])
              return <Polyline key={`trail-${p}`} positions={trail} pathOptions={{ color: personColor(p), weight: 3, opacity: 0.55 }} />
            })}
            {links.map((x, k) => (
              <Polyline key={`link-${k}`} positions={[[here[x.from]!.lat, here[x.from]!.lon], [here[x.to]!.lat, here[x.to]!.lon]]} pathOptions={{ color: 'var(--ink)', weight: 1.5, dashArray: '2 6', opacity: Math.max(0.15, 1 - (t - x.t) / linkWindow) }} />
            ))}
            {loaded.map((p) => {
              const w = here[p]
              if (!w) return null
              return (
                <Marker key={p} position={[w.lat, w.lon]} icon={pin(p, !!w.dark)} zIndexOffset={w.dark ? 0 : 500} eventHandlers={{ click: () => c.openEvidence({ title: `${personName(p)}'s phone at ${clock(t)}, ${dayLabel(t)}`, people: [p], points: [status(p, w).text + '.'], ids: w.ids }) }}>
                  {w.dark && (
                    <Tooltip permanent direction="top" offset={[0, -18]} className="map-note">
                      <span className="font-semibold text-serious">
                        {personName(p)}: {w.dark.why}, since {clock(w.dark.from)}
                      </span>
                    </Tooltip>
                  )}
                </Marker>
              )
            })}
          </PlainMap>
          <button onClick={() => setClose((v) => !v)} aria-pressed={close} className="absolute bottom-3 left-3 z-[500] rounded-md border border-line bg-surface px-2.5 py-1 text-[11.5px] text-ink shadow-sm hover:bg-sunken">
            {close ? 'Show the whole area' : 'Zoom to the scene'}
          </button>
          <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-md border border-line bg-surface/95 px-3 py-1.5 text-right shadow-sm">
            <div className="tnum text-[26px] font-semibold leading-none text-ink">{clock(t)}</div>
            <div className="mt-1 text-[11.5px] text-ink-2">{dayLabel(t)}</div>
            {inTod && <div className="mt-1 text-[11.5px] font-medium text-serious">Inside the time-of-death window</div>}
          </div>
        </div>

        <aside className="flex min-h-0 flex-col lg:overflow-hidden" style={{ maxHeight: MAP_H }}>
          <div className="border-b border-line px-3.5 py-3">
            <div className="mb-2 text-[12px] font-semibold text-ink">Where each phone is at {clock(t)}</div>
            <ul className="space-y-2">
              {loaded.map((p) => {
                const s = status(p, here[p])
                return (
                  <li key={p} className="flex items-start gap-2.5">
                    <Portrait id={p} size={24} dim={s.bad} />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium text-ink">{personName(p)}</div>
                      <div className={`text-[11.5px] leading-snug ${s.bad || s.scene ? 'font-medium text-serious' : 'text-ink-2'}`}>{s.text}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-3.5 py-3">
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="text-[12px] font-semibold text-ink">Key moments</span>
              <span className="text-[11px] text-ink-3">{inRange.length} in this period, from the insights</span>
            </div>
            {inRange.length === 0 ? (
              <p className="text-[12px] text-ink-2">No insight rests on anything in this period. Pick another period above, or add another phone.</p>
            ) : (
              <ol className="-mx-1.5 min-h-0 flex-1 space-y-px overflow-auto">
                {inRange.map((m) => {
                  const on = current === m
                  return (
                    <li key={m.ids[0]}>
                      <button onClick={() => seekTo(m.t)} className={`flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left text-[12px] leading-snug transition ${on ? 'bg-sunken' : 'hover:bg-sunken'} ${m.t > t ? 'opacity-60' : ''}`}>
                        <span className={`tnum w-10 shrink-0 text-[11.5px] ${m.serious ? 'font-semibold text-serious' : 'text-ink-3'}`}>{clock(m.t)}</span>
                        <span className={on ? 'font-medium text-ink' : 'text-ink'}>{m.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </aside>
      </div>

      <div className="border-t border-line px-4 pb-3 pt-2.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button onClick={() => (t >= range.b ? (setT(range.a), setPlaying(true)) : setPlaying((v) => !v))} className="w-16 rounded-md bg-ink px-2.5 py-1 text-[12px] font-medium text-surface hover:opacity-90">
            {playing ? 'Pause' : 'Play'}
          </button>
          <button onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 0.5 : 1))} className="rounded-md border border-line px-2 py-1 text-[11.5px] text-ink-2 hover:bg-sunken">
            Speed {speed}×
          </button>
          <button disabled={!prevMoment} onClick={() => prevMoment && seekTo(prevMoment.t)} className="rounded-md border border-line px-2 py-1 text-[11.5px] text-ink-2 hover:bg-sunken disabled:opacity-40">
            Previous key moment
          </button>
          <button disabled={!nextMoment} onClick={() => nextMoment && seekTo(nextMoment.t)} className="rounded-md border border-line px-2 py-1 text-[11.5px] text-ink-2 hover:bg-sunken disabled:opacity-40">
            Next key moment
          </button>
          {current && (
            <button onClick={() => c.openEvidence({ title: `${clock(current.t)}, ${dayLabel(current.t)}`, people: current.people, points: [current.label, current.ids.length > 1 ? 'The same record is on both phones.' : 'This record is on one phone.'], ids: current.ids })} className="ml-1 min-w-0 truncate text-left text-[12px] text-ink hover:underline" title="Open the evidence for this moment">
              <span className={`tnum mr-1.5 ${current.serious ? 'font-semibold text-serious' : 'text-ink-3'}`}>{clock(current.t)}</span>
              {current.label}
            </button>
          )}
        </div>

        <div className="relative select-none">
          {/* key moments, flagged on the same axis */}
          <div className="relative h-4" style={{ marginLeft: LABEL_W }}>
            {inRange.map((m) => (
              <button key={m.ids[0]} onClick={() => seekTo(m.t)} title={`${clock(m.t)} ${m.label}`} aria-label={`${clock(m.t)} ${m.label}`} className="absolute top-0.5 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] transition hover:scale-125" style={{ left: `${pct(m.t)}%`, background: m.serious ? 'var(--serious)' : 'var(--ink-2)', outline: current === m ? '2px solid var(--ink)' : undefined, outlineOffset: 1 }} />
            ))}
          </div>
          {loaded.map((p) => (
            <div key={p} className="flex h-7 items-center">
              <div className="shrink-0" style={{ width: LABEL_W }}>
                <Portrait id={p} size={18} label />
              </div>
              <div className="relative h-4 min-w-0 flex-1 overflow-hidden rounded-sm bg-sunken">
                {SEGMENTS.filter((s) => s.person === p && caseMinutes(s.end) > range.a && caseMinutes(s.start) < range.b).map((s) => {
                  const a = Math.max(range.a, caseMinutes(s.start))
                  const b = Math.min(range.b, caseMinutes(s.end))
                  const pl = findPlace(s.place)
                  const d = pl ? sceneM(pl.lat, pl.lon) : Infinity
                  const style = s.kind === 'gap' ? { background: HATCH } : s.kind === 'travel' ? { background: personColor(p), opacity: 0.25 } : d < 150 ? { background: 'var(--serious)' } : d < 2000 ? { background: 'var(--warning)', opacity: 0.75 } : { background: personColor(p), opacity: s.place === HOME[p] ? 0.35 : 0.8 }
                  const what = s.kind === 'gap' ? 'No location data' : s.kind === 'travel' ? 'On the move' : s.place === HOME[p] ? 'Home' : s.place
                  return <div key={s.segment_id} title={`${personName(p)}: ${what}, ${clock(a)}–${clock(b)}`} className="absolute inset-y-0" style={{ left: `${pct(a)}%`, width: `${pct(b) - pct(a)}%`, ...style }} />
                })}
              </div>
            </div>
          ))}
          {/* one layer for the time-of-death band, the playhead and dragging */}
          <div
            ref={strip}
            role="slider"
            tabIndex={0}
            aria-label="Time"
            aria-valuemin={range.a}
            aria-valuemax={range.b}
            aria-valuenow={Math.round(t)}
            aria-valuetext={`${clock(t)}, ${dayLabel(t)}`}
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
            className="absolute bottom-0 right-0 top-4 cursor-ew-resize touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{ left: LABEL_W }}
          >
            {tod.b > range.a && tod.a < range.b && (
              <div className="absolute inset-y-0 border-x border-serious/70" style={{ left: `${Math.max(0, pct(tod.a))}%`, width: `${Math.min(100, pct(tod.b)) - Math.max(0, pct(tod.a))}%`, background: 'color-mix(in srgb, var(--serious) 9%, transparent)' }} />
            )}
            <div className="absolute -top-4 bottom-0 w-px bg-ink" style={{ left: `${Math.min(100, Math.max(0, pct(t)))}%` }}>
              <div className="absolute -left-[5px] -top-0.5 h-[11px] w-[11px] rounded-full border-2 border-surface bg-ink" />
            </div>
          </div>
        </div>
        <div className="relative mt-1 h-4" style={{ marginLeft: LABEL_W }}>
          {ticks.map((m) => (
            <span key={m} className="tnum absolute -translate-x-1/2 whitespace-nowrap text-[10.5px] text-ink-3" style={{ left: `${pct(m)}%` }}>
              {step === DAY ? `${DOW[(dayOf(m) - 13) % 7]} ${dayOf(m)}` : m % DAY === 0 ? `${DOW[(dayOf(m) - 13) % 7]} ${dayOf(m)}` : clock(m)}
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-2">
          <Key swatch={{ background: 'var(--serious)' }} text="at the scene" />
          <Key swatch={{ background: 'var(--warning)', opacity: 0.75 }} text="within 2 km of it" />
          <Key swatch={{ background: 'var(--ink-3)', opacity: 0.8 }} text="somewhere else" />
          <Key swatch={{ background: 'var(--ink-3)', opacity: 0.35 }} text="at home" />
          <Key swatch={{ background: HATCH, border: '1px solid var(--line-strong)' }} text="no location data" />
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rotate-45 rounded-[1px] bg-serious" /> a moment an insight rests on
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 border-x border-serious/70" style={{ background: 'color-mix(in srgb, var(--serious) 9%, transparent)' }} /> time-of-death window, 21:00–23:30
          </span>
        </div>
      </div>
    </section>
  )
}

function Key({ swatch, text }: { swatch: React.CSSProperties; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-4 rounded-[2px]" style={swatch} />
      {text}
    </span>
  )
}
