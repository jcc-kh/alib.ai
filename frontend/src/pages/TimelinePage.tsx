import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, Tooltip } from 'react-leaflet'
import { getTimeline, type CaseInfo, type Segment } from '../api'
import { useApp } from '../state'
import { Eyebrow, Title } from '../components/ui'
import LocationLanes, { GAP_STYLE } from '../components/LocationLanes'
import PlainMap from '../components/evidence/PlainMap'
import { GAP_OF, placeCoords } from '../mock/segments'
import { findingById } from '../mock/signals'
import { PEOPLE, personColor, personName } from '../mock/data'
import { caseMinutes, fmtDate, fmtDateTime, fmtTime } from '../lib/format'

const DAYS = [13, 14, 15, 16, 17, 18, 19]
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function TimelinePage({ caseInfo }: { caseInfo: CaseInfo }) {
  const { openFinding } = useApp()
  const [segs, setSegs] = useState<Segment[] | null>(null)
  const [range, setRange] = useState<number | 'week'>(15)
  const [sel, setSel] = useState<Segment | null>(null)

  useEffect(() => {
    getTimeline().then((s) => {
      setSegs(s)
      // Start on Ken's location_off gap, the one gap raised by default.
      setSel(s.find((x) => x.kind === 'gap' && x.gap_type === 'location_off') ?? null)
    })
  }, [])

  const [t0, t1] = range === 'week' ? [0, 7 * 1440] : [(range - 13) * 1440, (range - 12) * 1440]
  const people = PEOPLE.map((p) => p.person_id)
  const gaps = useMemo(() => (segs ?? []).filter((s) => s.kind === 'gap'), [segs])

  // Window for the map: the selected segment, else the visible range.
  const [w0, w1] = sel ? [caseMinutes(sel.start), caseMinutes(sel.end)] : [t0, t1]
  const inWindow = (segs ?? []).filter((s) => caseMinutes(s.end) > w0 && caseMinutes(s.start) < w1)

  if (!segs) return <div className="pulse-dot py-40 text-center text-faint">Loading stays…</div>

  return (
    <div className="mx-auto max-w-[1280px]">
      <section className="frame px-12 pb-10 pt-16">
        <Eyebrow>Location timeline · location_timeline() → stays</Eyebrow>
        <Title size="xl" className="mt-3 max-w-3xl">
          Where each phone was, and where it went quiet.
        </Title>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
          Location rows are turned into stays (the phone stayed within 150 m for at least 10 minutes), travel between them, and gaps of 45 minutes or more.
          Every gap is classified, and only gaps where the phone was clearly in use, or that overlap another signal, are raised.
        </p>
      </section>
      <div className="dot-rule" />

      <section className="frame px-12 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <RangeButton active={range === 'week'} onClick={() => setRange('week')}>
            Whole week
          </RangeButton>
          {DAYS.map((d) => (
            <RangeButton key={d} active={range === d} onClick={() => setRange(d)}>
              {DOW[d - 13]} {d}
            </RangeButton>
          ))}
          <div className="ml-auto flex gap-5 text-xs text-faint">
            <span className="inline-flex items-center gap-2"><span className="h-3 w-5 rounded-sm bg-muted/40" /> stay</span>
            <span className="inline-flex items-center gap-2"><span className="w-5 border-t border-dashed border-muted" /> travel</span>
            {(Object.keys(GAP_STYLE) as (keyof typeof GAP_STYLE)[]).map((g) => (
              <span key={g} className="inline-flex items-center gap-2">
                <span className="h-3 w-5 rounded-sm" style={{ background: `repeating-linear-gradient(45deg, ${GAP_STYLE[g].color} 0 2px, transparent 2px 5px)`, border: `1px solid ${GAP_STYLE[g].color}` }} />
                {g}
              </span>
            ))}
          </div>
        </div>
        <LocationLanes segments={segs} people={people} t0={t0} t1={t1} selected={sel?.segment_id} onSelect={setSel} rowH={64} width={1180} />
      </section>

      <div className="dot-rule" />
      <section className="frame grid grid-cols-[1fr_1.15fr] gap-10 px-12 py-10">
        <div>
          <Eyebrow>Selected</Eyebrow>
          {sel ? <SegmentDetail s={sel} onOpen={(id) => findingById(id) && openFinding(findingById(id)!)} /> : <p className="mt-3 text-sm text-faint">Click a stay, a travel line or a gap.</p>}
        </div>
        <div>
          <Eyebrow className="mb-3">
            Every phone {sel ? `· ${fmtDateTime(sel.start)} – ${fmtTime(sel.end)}` : range === 'week' ? '· whole week' : `· ${DOW[(range as number) - 13]} ${range} April`}
          </Eyebrow>
          <WindowMap segs={inWindow} places={caseInfo.places} />
        </div>
      </section>

      <div className="dot-rule" />
      <section className="frame px-12 py-10">
        <Eyebrow className="mb-4">Every gap in the week</Eyebrow>
        <div className="divide-y divide-line rounded-xl border border-line">
          {gaps.map((g) => {
            const out = GAP_OF.get(g.segment_id)
            return (
              <button
                key={g.segment_id}
                onClick={() => {
                  setSel(g)
                  setRange(Number(g.start.slice(8, 10)))
                }}
                className={`grid w-full grid-cols-[6rem_12rem_8rem_1fr_7rem] items-center gap-4 px-4 py-3 text-left text-sm transition hover:bg-panel ${sel?.segment_id === g.segment_id ? 'bg-panel' : ''}`}
              >
                <span className="inline-flex items-center gap-2 text-fg">
                  <span className="h-2 w-2 rounded-full" style={{ background: personColor(g.person) }} />
                  {personName(g.person)}
                </span>
                <span className="tabular-nums text-muted">{out ? `${fmtDate(out.start)} ${fmtTime(out.start)}–${fmtTime(out.end)}` : ''}</span>
                <span className="font-mono text-xs" style={{ color: GAP_STYLE[g.gap_type!].color }}>
                  {g.gap_type}
                </span>
                <span className="text-xs text-faint">{out?.activity.length ? `${out.activity.length} activity rows inside` : out?.power_event_ids.length ? 'power events cover it' : 'no activity'}</span>
                <span className={`text-right text-xs ${g.raised ? 'text-terra-soft' : 'text-faint'}`}>{g.raised ? 'raised' : 'not raised'}</span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function RangeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs transition ${active ? 'border-fg text-fg' : 'border-line text-muted hover:text-fg'}`}>
      {children}
    </button>
  )
}

function SegmentDetail({ s, onOpen }: { s: Segment; onOpen: (findingId: string) => void }) {
  const out = s.kind === 'gap' ? GAP_OF.get(s.segment_id) : undefined
  return (
    <div className="mt-3 space-y-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: personColor(s.person) }} />
        <span className="text-sm text-muted">{personName(s.person)}'s phone</span>
        <span className="font-mono text-[11px] text-faint">{s.segment_id}</span>
      </div>
      {s.kind === 'stay' && (
        <Title size="md">
          Stayed at {s.place}, {fmtDateTime(s.start)}–{fmtTime(s.end)}.
        </Title>
      )}
      {s.kind === 'travel' && (
        <Title size="md">
          Travelled from {s.from} to {s.to}, {fmtDateTime(s.start)}–{fmtTime(s.end)}.
        </Title>
      )}
      {s.kind === 'gap' && out && (
        <>
          <Title size="md">
            No location data, {fmtDateTime(out.start)}–{fmtTime(out.end)} ({out.minutes} min).
          </Title>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm" style={{ color: GAP_STYLE[out.gap_type].color }}>
              {out.gap_type}
            </span>
            <span className="text-sm text-muted">{GAP_STYLE[out.gap_type].reading}</span>
          </div>
          {out.activity.length > 0 && (
            <ul className="space-y-1 text-sm">
              {out.activity.map((a) => (
                <li key={a.id} className="flex gap-3 text-muted">
                  <span className="w-12 tabular-nums text-fg">{fmtTime(a.t)}</span>
                  {a.label}
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm leading-relaxed text-faint">
            {out.raised
              ? out.gap_type === 'location_off'
                ? 'Raised: the phone was in use during the gap.'
                : 'Raised because it overlaps another signal.'
              : 'Not raised: no activity during the gap and no overlapping signal. Shown so you can see it was checked.'}
          </p>
          {s.finding_id && (
            <button onClick={() => onOpen(s.finding_id!)} className="btn-ghost px-4 py-2 text-sm">
              Evidence and how we know →
            </button>
          )}
        </>
      )}
    </div>
  )
}

function WindowMap({ segs, places }: { segs: Segment[]; places: CaseInfo['places'] }) {
  const stays = segs.filter((s) => s.kind === 'stay')
  const gapPeople = [...new Set(segs.filter((s) => s.kind === 'gap').map((s) => s.person))]
  const byPersonPlace = new Map<string, Segment>()
  for (const s of stays) byPersonPlace.set(`${s.person}|${s.place}`, s)
  const pts = [...byPersonPlace.values()].map((s) => placeCoords(s.place)).filter(Boolean) as { lat: number; lon: number }[]
  const bounds = (pts.length ? pts : places).map((p) => [p.lat, p.lon] as [number, number])
  if (bounds.length === 1) bounds.push([bounds[0][0] + 0.01, bounds[0][1] + 0.01])
  return (
    <div className="space-y-3">
      <PlainMap key={bounds.map((b) => b.join()).join('|')} places={places} bounds={bounds} labelNear={bounds} labelTol={0.003} height={300}>
        {[...byPersonPlace.values()].map((s, i) => {
          const p = placeCoords(s.place)
          if (!p) return null
          const offset = PEOPLE.findIndex((x) => x.person_id === s.person) * 0.0012
          return (
            <CircleMarker key={i} center={[p.lat + offset, p.lon + offset]} radius={7} pathOptions={{ color: personColor(s.person), fillColor: personColor(s.person), fillOpacity: 0.85, weight: 1 }}>
              <Tooltip>
                {personName(s.person)}'s phone · {s.place}
              </Tooltip>
            </CircleMarker>
          )
        })}
      </PlainMap>
      {gapPeople.length > 0 && (
        <p className="text-xs text-faint">
          No location data in this window for: {gapPeople.map((p) => `${personName(p)}'s phone`).join(', ')}.
        </p>
      )}
    </div>
  )
}
