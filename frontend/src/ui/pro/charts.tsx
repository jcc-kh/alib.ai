// Pro dashboard charts. Every series is computed from the evidence rows (lib/aggregates.ts).
// Colours: people = categorical slots (validated) with the victim in neutral ink; status colours reserved
// (serious = at the scene / hostile, amber = near); identity always also carries a name or portrait.
import { Fragment, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PersonId } from '../../api'
import { CASE_PEOPLE, NIGHT_HOURS, dwellByPlace, hourlyActivity, nightProfile, socialByDay, socialItems } from '../../lib/aggregates'
import { ALL_GAPS, HOSTILE, PEOPLE, ROWS, SCENE, SYNC, TOD, haversine, personColor, personName } from '../../mock/data'
import { caseMinutes, fmtDate, fmtKm, fmtTime } from '../../lib/format'
import Portrait from '../../components/Portrait'
import { chart } from './kit'

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hourLabel = (h: number) => `${DAY[Math.floor(h / 24)]} ${13 + Math.floor(h / 24)} Apr ${String(h % 24).padStart(2, '0')}:00`

export function Legend({ people, hidden, toggle }: { people: PersonId[]; hidden?: Set<PersonId>; toggle?: (p: PersonId) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px]">
      {people.map((p) => (
        <button key={p} onClick={() => toggle?.(p)} className={`inline-flex items-center gap-1.5 ${hidden?.has(p) ? 'text-ink-3 line-through' : 'text-ink-2'}`}>
          <span className="h-[3px] w-4 rounded-full" style={{ background: personColor(p) }} />
          {personName(p)}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Distance to the scene, 10-minute slots across the evening of the 16th (log scale)
// ---------------------------------------------------------------------------------------------
const EVE_START = caseMinutes('2026-04-16T18:00:00-04:00')
const EVE_END = caseMinutes('2026-04-17T01:50:00-04:00')
export function DistanceToScene({ height = 280 }: { height?: number }) {
  const [hidden, setHidden] = useState<Set<PersonId>>(new Set())
  const data = useMemo(() => {
    const byKey = new Map<string, number>()
    for (const r of ROWS.values()) {
      if (r.table !== 'locations') continue
      const m = caseMinutes(r.timestamp)
      if (m < EVE_START || m > EVE_END) continue
      byKey.set(`${r.device_owner}|${m}`, Math.max(5, Math.round(haversine(Number(r.fields.lat), Number(r.fields.lon), SCENE.lat, SCENE.lon))))
    }
    const out: Record<string, number | null>[] = []
    for (let m = EVE_START; m <= EVE_END; m += 10) out.push({ m, ...Object.fromEntries(CASE_PEOPLE.map((p) => [p, byKey.get(`${p}|${m}`) ?? null])) })
    return out
  }, [])
  const toggle = (p: PersonId) => setHidden((s) => (s.has(p) ? new Set([...s].filter((x) => x !== p)) : new Set([...s, p])))
  const tick = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:00`
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Legend people={CASE_PEOPLE} hidden={hidden} toggle={toggle} />
        <span className="text-[11px] text-ink-3">distance to {SCENE.name}, every 10 min · breaks = no location data</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 14, right: 12, left: -4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chart.grid.stroke} />
          <ReferenceArea x1={caseMinutes(TOD.start)} x2={caseMinutes(TOD.end)} fill="var(--serious)" fillOpacity={0.08} stroke="none" label={{ value: 'Time-of-death window', position: 'insideTop', fill: 'var(--ink-2)', fontSize: 11 }} />
          <XAxis dataKey="m" type="number" domain={[EVE_START, EVE_END]} ticks={Array.from({ length: 8 }, (_, i) => EVE_START + i * 60)} tickFormatter={tick} {...chart.axis} />
          <YAxis scale="log" domain={[5, 30000]} ticks={[10, 150, 2000, 20000]} tickFormatter={(v) => (v >= 1000 ? `${v / 1000} km` : `${v} m`)} allowDataOverflow {...chart.axis} width={52} />
          <ReferenceLine y={150} stroke="var(--serious)" strokeDasharray="4 3" label={{ value: 'at the scene (150 m)', position: 'insideBottomLeft', fill: 'var(--ink-2)', fontSize: 10.5 }} />
          <ReferenceLine y={2000} stroke="var(--ink-3)" strokeDasharray="2 4" label={{ value: 'near (2 km)', position: 'insideTopLeft', fill: 'var(--ink-3)', fontSize: 10.5 }} />
          <Tooltip {...chart.tooltip} labelFormatter={(m) => `16–17 Apr ${tick(Number(m)).slice(0, 2)}:${String(Number(m) % 60).padStart(2, '0')}`} formatter={(v, n) => [fmtKm(Number(v)), personName(n as PersonId)]} />
          {CASE_PEOPLE.filter((p) => !hidden.has(p)).map((p) => (
            <Line key={p} type="linear" dataKey={p} stroke={personColor(p)} strokeWidth={p === 'ravi' ? 2.4 : 1.8} dot={false} connectNulls={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Pattern of life: that night against a normal night, per phone (small multiples)
// ---------------------------------------------------------------------------------------------
export function NightProfiles({ night = 16 }: { night?: number }) {
  const data = useMemo(() => CASE_PEOPLE.map((p) => ({ p, rows: nightProfile(p, night) })), [night])
  const max = Math.max(1, ...data.flatMap((d) => d.rows.flatMap((r) => [r.night, r.max])))
  const todHours = [21, 22, 23]
  return (
    <div className="space-y-2">
      {data.map(({ p, rows }) => {
        const nightTotal = rows.filter((r) => todHours.includes(r.hour)).reduce((a, r) => a + r.night, 0)
        const medTotal = rows.filter((r) => todHours.includes(r.hour)).reduce((a, r) => a + r.median, 0)
        return (
          <div key={p} className="grid grid-cols-[8.5rem_1fr_9rem] items-end gap-3">
            <Portrait id={p} size={24} label />
            <div className="grid grid-cols-8 items-end gap-1" style={{ height: 46 }}>
              {rows.map((r) => (
                <div key={r.hour} className="relative h-full" title={`${String(r.hour).padStart(2, '0')}:00 · that night ${r.night} · usual ${r.median}`}>
                  {todHours.includes(r.hour) && <div className="absolute inset-0 rounded-sm bg-serious/10" />}
                  <div className="absolute bottom-0 left-[18%] right-[18%] rounded-t-[3px]" style={{ height: `${(r.night / max) * 100}%`, background: personColor(p) }} />
                  <div className="absolute left-0 right-0 border-t-2 border-dashed border-ink" style={{ bottom: `${(r.median / max) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="tnum text-[11.5px] text-ink-2">
              21–24h: <span className="text-ink">{nightTotal}</span> vs usual {medTotal}
              {nightTotal === 0 && medTotal > 0 && <span className="ml-1 text-serious">▼ silent</span>}
            </div>
          </div>
        )
      })}
      <div className="grid grid-cols-[8.5rem_1fr_9rem] gap-3 text-[10.5px] text-ink-3">
        <span />
        <div className="grid grid-cols-8 gap-1">
          {NIGHT_HOURS.map((h) => (
            <span key={h} className="text-center">
              {String(h % 24).padStart(2, '0')}
            </span>
          ))}
        </div>
        <span>
          bars = 16 Apr · <span className="border-b-2 border-dashed border-ink">dashes</span> = median of other nights
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// The week: hourly activity per phone, with location gaps shaded and the key moments marked
// ---------------------------------------------------------------------------------------------
export function ActivityChart({ height = 240 }: { height?: number }) {
  const [hidden, setHidden] = useState<Set<PersonId>>(new Set(['amy', 'ken']))
  const data = useMemo(() => {
    const series = Object.fromEntries(CASE_PEOPLE.map((p) => [p, hourlyActivity(p, ['messages', 'calls', 'social_interactions'])]))
    return Array.from({ length: 168 }, (_, h) => ({ h, ...Object.fromEntries(CASE_PEOPLE.map((p) => [p, series[p][h]])) }))
  }, [])
  const toggle = (p: PersonId) => setHidden((s) => (s.has(p) ? new Set([...s].filter((x) => x !== p)) : new Set([...s, p])))
  const gaps = ALL_GAPS.filter((g) => g.raised && !hidden.has(g.person))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Legend people={CASE_PEOPLE} hidden={hidden} toggle={toggle} />
        <span className="text-[11px] text-ink-3">messages + calls + posts per hour · shaded = raised location gaps · click a name to show it</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 16, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chart.grid.stroke} />
          <XAxis dataKey="h" type="number" domain={[0, 168]} ticks={[0, 24, 48, 72, 96, 120, 144, 168]} tickFormatter={(h) => (h < 168 ? `${DAY[h / 24]} ${13 + h / 24}` : '')} {...chart.axis} />
          <YAxis allowDecimals={false} {...chart.axis} width={44} />
          {gaps.map((g, i) => (
            <ReferenceArea key={i} x1={caseMinutes(g.start) / 60} x2={caseMinutes(g.end) / 60} fill={personColor(g.person)} fillOpacity={0.18} stroke="none" ifOverflow="hidden" />
          ))}
          <ReferenceArea x1={caseMinutes(TOD.start) / 60} x2={caseMinutes(TOD.end) / 60} fill="var(--serious)" fillOpacity={0.1} stroke="none" />
          <ReferenceLine x={caseMinutes(TOD.start) / 60} stroke="var(--serious)" strokeDasharray="3 3" label={{ value: 'Time of death 21:00–23:30', position: 'top', fill: 'var(--ink-2)', fontSize: 11 }} />
          <ReferenceLine x={caseMinutes(SYNC.trigger!.t) / 60} stroke="var(--ink-3)" strokeDasharray="2 3" label={{ value: 'News 17 Apr 09:05', position: 'insideTopRight', fill: 'var(--ink-3)', fontSize: 10.5 }} />
          <Tooltip {...chart.tooltip} labelFormatter={(h) => hourLabel(Number(h))} formatter={(v, n) => [v as number, personName(n as PersonId)]} />
          {CASE_PEOPLE.filter((p) => !hidden.has(p)).map((p) => (
            <Line key={p} type="monotone" dataKey={p} stroke={personColor(p)} strokeWidth={1.6} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Social: every post over the week, one row per person, coloured by hostility score
// ---------------------------------------------------------------------------------------------
export function HostilityTimeline({ onPick }: { onPick?: (id: string) => void }) {
  const items = useMemo(() => socialItems(), [])
  const byDay = useMemo(() => socialByDay(), [])
  const W = 900
  const L = 140
  const row = 46
  const H = CASE_PEOPLE.length * row + 26
  const x = (iso: string) => L + (caseMinutes(iso) / (7 * 1440)) * (W - L - 10)
  const [hover, setHover] = useState<(typeof items)[number] | null>(null)
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {Array.from({ length: 8 }, (_, d) => (
          <Fragment key={d}>
            <line x1={L + (d / 7) * (W - L - 10)} x2={L + (d / 7) * (W - L - 10)} y1={0} y2={H - 20} stroke="var(--line)" />
            {d < 7 && (
              <text x={L + (d / 7) * (W - L - 10) + 4} y={H - 6} fontSize={10.5} fill="var(--ink-3)">
                {DAY[d]} {13 + d}
              </text>
            )}
          </Fragment>
        ))}
        <rect x={x(TOD.start)} width={Math.max(3, x(TOD.end) - x(TOD.start))} y={0} height={H - 20} fill="var(--serious)" opacity={0.15} />
        {CASE_PEOPLE.map((p, i) => {
          const y = i * row + 22
          const total = byDay.find((b) => b.person === p)!.days.reduce((a, d) => a + d.posts, 0)
          return (
            <g key={p}>
              <line x1={L} x2={W - 10} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 3" />
              <text x={0} y={y + 4} fontSize={12.5} fill="var(--ink)">
                {personName(p)}
              </text>
              <text x={0} y={y + 18} fontSize={10.5} fill="var(--ink-3)">
                {PEOPLE.find((x) => x.person_id === p)!.handle} · {total} posts
              </text>
              {items
                .filter((it) => it.person === p)
                .map((it) => {
                  const hot = it.score >= HOSTILE.threshold
                  return (
                    <circle
                      key={it.id}
                      cx={x(it.t)}
                      cy={y}
                      r={hot ? 7 : 3 + it.score * 6}
                      fill={hot ? 'var(--serious)' : it.score >= 0.4 ? 'var(--amber)' : 'var(--ink-3)'}
                      opacity={hot ? 0.95 : 0.55}
                      stroke="var(--surface)"
                      strokeWidth={1.5}
                      className="cursor-pointer"
                      onMouseEnter={() => setHover(it)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => onPick?.(it.id)}
                    />
                  )
                })}
            </g>
          )
        })}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute right-2 top-2 max-w-sm rounded-md border border-line bg-surface px-3 py-2 text-[12px] shadow-lg">
          <div className="text-ink-3">
            {personName(hover.person)} · {fmtDate(hover.t)} {fmtTime(hover.t)} · {hover.kind}
          </div>
          <div className="text-ink">“{hover.text}”</div>
          <div className="tnum mt-0.5" style={{ color: hover.score >= HOSTILE.threshold ? 'var(--serious)' : 'var(--ink-3)' }}>
            hostility {hover.score.toFixed(2)} {hover.target ? `· about ${hover.target}` : ''}
          </div>
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-4 text-[11px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-serious" /> scored ≥ {HOSTILE.threshold} (flagged)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber opacity-60" /> 0.4–0.7
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-ink-3 opacity-60" /> below 0.4
        </span>
        <span className="text-ink-3">· shaded = time-of-death window · scores by {HOSTILE.model}</span>
      </div>
    </div>
  )
}

/** Hours at each place per phone (stays table), stacked; filtered by an optional window. */
export function PlaceTime({ window }: { window?: [number, number] | null }) {
  const dwell = useMemo(() => dwellByPlace(window ?? undefined), [window])
  const rows = Object.entries(dwell)
    .map(([place, by]) => ({ place, by, total: Object.values(by).reduce((a, b) => a + b, 0) }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
  const max = Math.max(...rows.map((r) => r.total), 1)
  return (
    <div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.place} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-2 text-[11.5px]">
            <span className="truncate text-ink-2">{r.place}</span>
            <span className="flex h-3 overflow-hidden rounded-r-[3px]" style={{ width: `${(r.total / max) * 100}%` }}>
              {CASE_PEOPLE.filter((p) => r.by[p] > 0).map((p, i) => (
                <span key={p} title={`${personName(p)} · ${r.place}: ${(r.by[p] / 60).toFixed(1)} h`} className="h-full" style={{ width: `${(r.by[p] / r.total) * 100}%`, background: personColor(p), marginLeft: i ? 2 : 0 }} />
              ))}
            </span>
            <span className="tnum text-right text-ink">{(r.total / 60).toFixed(r.total < 600 ? 1 : 0)} h</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Legend people={CASE_PEOPLE} />
        <span className="text-[11px] text-ink-3">{window ? 'selected window' : 'whole week'} · from stays</span>
      </div>
    </div>
  )
}
