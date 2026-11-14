// Pro dashboard charts. Every series is computed from the evidence rows (lib/aggregates.ts).
// Colours: people = categorical slots 1–4 (validated); magnitude = one-hue opacity ramp; status reserved.
import { useMemo, useState } from 'react'
import { Brush, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Sankey, Tooltip, XAxis, YAxis } from 'recharts'
import { CircleMarker, Tooltip as LTooltip } from 'react-leaflet'
import type { PersonId } from '../../api'
import { CASE_PEOPLE, activityHeatmap, contactMatrix, dwellByPlace, hourlyActivity, moneyFlows, pairDistanceSeries } from '../../lib/aggregates'
import { NUMBERS, PEOPLE, PLACES, ROWS, S7, KEN_NIGHT, personColor, personName } from '../../mock/data'
import { SEGMENTS } from '../../mock/segments'
import { caseMinutes, fmtTime } from '../../lib/format'
import PlainMap from '../../components/evidence/PlainMap'
import { chart } from './kit'

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hourLabel = (h: number) => `${DAY[Math.floor(h / 24)]} ${13 + Math.floor(h / 24)} Apr ${String(h % 24).padStart(2, '0')}:00`

function Legend({ people, hidden, toggle }: { people: PersonId[]; hidden?: Set<PersonId>; toggle?: (p: PersonId) => void }) {
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

/** Hourly messages + calls per phone, with power-off periods shaded and the anchor annotated. */
export function ActivityChart({ height = 230 }: { height?: number }) {
  const [hidden, setHidden] = useState<Set<PersonId>>(new Set())
  const data = useMemo(() => {
    const series = Object.fromEntries(CASE_PEOPLE.map((p) => [p, hourlyActivity(p)]))
    return Array.from({ length: 168 }, (_, h) => ({ h, ...Object.fromEntries(CASE_PEOPLE.map((p) => [p, series[p][h]])) }))
  }, [])
  const off = [
    ...S7.events.filter((e) => e.event_type === 'power_off').map((e) => {
      const on = S7.events.find((x) => x.device_owner === e.device_owner && x.event_type === 'power_on')!
      return { p: e.device_owner, a: caseMinutes(e.t) / 60, b: caseMinutes(on.t) / 60 }
    }),
    { p: 'ken', a: caseMinutes(KEN_NIGHT.bounding.before.t) / 60, b: caseMinutes(KEN_NIGHT.bounding.after.t) / 60 },
  ]
  const toggle = (p: PersonId) => setHidden((s) => (s.has(p) ? new Set([...s].filter((x) => x !== p)) : new Set([...s, p])))
  const total = data.reduce((n, d) => n + CASE_PEOPLE.reduce((k, p) => k + (d as unknown as Record<string, number>)[p], 0), 0)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Legend people={CASE_PEOPLE} hidden={hidden} toggle={toggle} />
        <span className="text-[11px] text-ink-3">messages + calls · n = {total.toLocaleString()} · shaded = powered off</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 14, right: 12, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chart.grid.stroke} />
          <XAxis dataKey="h" type="number" domain={[0, 168]} ticks={[0, 24, 48, 72, 96, 120, 144, 168]} tickFormatter={(h) => (h < 168 ? `${DAY[h / 24]} ${13 + h / 24}` : '')} {...chart.axis} />
          <YAxis allowDecimals={false} {...chart.axis} width={44} />
          {off.map((o, i) => (
            <ReferenceArea key={i} x1={o.a} x2={o.b} fill="var(--off)" fillOpacity={0.25} stroke="none" ifOverflow="hidden" />
          ))}
          <ReferenceArea x1={caseMinutes(S7.window.start) / 60} x2={caseMinutes(S7.window.end) / 60} fill="var(--serious)" fillOpacity={0.12} stroke="none" />
          <ReferenceLine x={caseMinutes(S7.trigger!.t) / 60} stroke="var(--serious)" strokeDasharray="3 3" label={{ value: 'Audit notice 17 Apr 10:00', position: 'top', fill: 'var(--ink-2)', fontSize: 11 }} />
          <Tooltip {...chart.tooltip} labelFormatter={(h) => hourLabel(Number(h))} formatter={(v, n) => [v as number, personName(n as PersonId)]} />
          {CASE_PEOPLE.filter((p) => !hidden.has(p)).map((p) => (
            <Line key={p} type="monotone" dataKey={p} stroke={personColor(p)} strokeWidth={1.6} dot={false} isAnimationActive={false} />
          ))}
          <Brush dataKey="h" height={18} travellerWidth={8} stroke="var(--line-strong)" fill="var(--sunken)" tickFormatter={(h) => hourLabel(Number(h))} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Day × hour heatmap per phone; one-hue opacity ramp so zero recedes into the surface in both themes. */
export function Heatmaps() {
  const maps = useMemo(() => CASE_PEOPLE.map((p) => ({ p, m: activityHeatmap(p) })), [])
  const max = Math.max(...maps.flatMap((x) => x.m.flat()))
  const cell = 11
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        {maps.map(({ p, m }) => (
          <div key={p}>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-ink-2">
              <span className="h-2 w-2 rounded-sm" style={{ background: personColor(p) }} />
              {personName(p)} <span className="text-ink-3">· {m.flat().reduce((a, b) => a + b, 0)} events</span>
            </div>
            <svg viewBox={`0 0 ${24 * cell + 26} ${7 * cell + 14}`} className="w-full">
              {m.map((row, d) => (
                <g key={d}>
                  <text x={0} y={d * cell + 9} fontSize={8} fill="var(--ink-3)">
                    {DAY[d]}
                  </text>
                  {row.map((v, h) => (
                    <rect key={h} x={26 + h * cell} y={d * cell} width={cell - 1.5} height={cell - 1.5} rx={1.5} fill={v ? 'var(--ink)' : 'var(--sunken)'} fillOpacity={v ? 0.15 + 0.85 * (v / max) : 1}>
                      <title>{`${personName(p)} · ${DAY[d]} ${13 + d} Apr ${String(h).padStart(2, '0')}:00 · ${v} messages + calls`}</title>
                    </rect>
                  ))}
                </g>
              ))}
              {[0, 6, 12, 18].map((h) => (
                <text key={h} x={26 + h * cell} y={7 * cell + 10} fontSize={8} fill="var(--ink-3)">
                  {String(h).padStart(2, '0')}
                </text>
              ))}
            </svg>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-3">
        <span>0</span>
        <span className="h-2 w-28 rounded-sm" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--ink) 15%, transparent), var(--ink))' }} />
        <span>{max} per hour</span>
        <span className="ml-auto">grey = no activity (night, or phone off)</span>
      </div>
    </div>
  )
}

/** Contacts between the four case phones by channel, plus volume with everyone else. */
export function ContactMatrix() {
  const { pairs, others, key } = useMemo(() => contactMatrix(), [])
  return (
    <div>
      <table className="w-full border-separate border-spacing-1 text-[11.5px]">
        <thead>
          <tr>
            <th />
            {CASE_PEOPLE.map((p) => (
              <th key={p} className="pb-1 text-center font-medium text-ink-2">
                {personName(p)}
              </th>
            ))}
            <th className="pb-1 text-center font-medium text-ink-3">Others</th>
          </tr>
        </thead>
        <tbody>
          {CASE_PEOPLE.map((a) => (
            <tr key={a}>
              <th className="pr-1 text-left font-medium text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: personColor(a) }} />
                  {personName(a)}
                </span>
              </th>
              {CASE_PEOPLE.map((b) => {
                if (a === b) return <td key={b} className="rounded bg-sunken/60" />
                const c = pairs[key(a, b)]
                const empty = !c || (!c.messages && !c.calls && !c.transfers)
                return (
                  <td key={b} className={`h-14 rounded border px-1.5 align-top ${empty ? 'border-dashed border-line text-ink-3' : 'border-line'}`}>
                    {empty ? (
                      <div className="pt-4 text-center">0 contact</div>
                    ) : (
                      <div className="tnum space-y-px pt-0.5 leading-tight">
                        <div className="text-ink">{c.messages} msg</div>
                        <div className="text-ink">{c.calls} calls</div>
                        {c.transfers > 0 && <div className="text-ink-2">{c.transfers} transfer</div>}
                        {c.deleted && <div className="font-medium text-serious">⊘ thread deleted</div>}
                      </div>
                    )}
                    {empty && c?.deleted && <div className="text-center font-medium text-serious">⊘ deleted</div>}
                  </td>
                )
              })}
              <td className="tnum rounded border border-line px-1.5 text-center text-ink-2">
                {others[a].messages.toLocaleString()} msg
                <br />
                {others[a].calls} calls
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[11px] text-ink-3">De-duplicated across both phones. Paul–Cara: 0 messages, 0 calls on any phone. Deleted threads leave no rows to count.</p>
    </div>
  )
}

/** Money between case phones and everyday card spend, as a Sankey. */
export function MoneyFlow() {
  const links = useMemo(() => moneyFlows(), [])
  const names = ['paul', 'amy', 'ken', 'cara', 'Card spend']
  const nodes = names.map((n) => ({ name: n }))
  const data = { nodes, links: links.map((l) => ({ source: names.indexOf(l.source), target: names.indexOf(l.target), value: l.value, label: l.label })) }
  const color = (n: string) => (n === 'Card spend' ? 'var(--ink-3)' : personColor(n as PersonId))
  const nodeName = (n: string) => (n === 'Card spend' ? 'Card spend (merchants)' : personName(n as PersonId))
  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <Sankey
          data={data}
          nodePadding={26}
          nodeWidth={10}
          margin={{ top: 8, right: 190, bottom: 8, left: 8 }}
          link={(props: any) => {
            const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload, index } = props
            return (
              <path
                key={`link-${index}`}
                d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
                fill="none"
                stroke={color(payload.source.name)}
                strokeOpacity={0.35}
                strokeWidth={Math.max(1.5, linkWidth)}
              >
                <title>{`${nodeName(payload.source.name)} → ${nodeName(payload.target.name)}: $${payload.value.toLocaleString()} (${payload.label})`}</title>
              </path>
            )
          }}
          node={(props: any) => {
            const { x, y, width, height, payload, index } = props
            return (
              <g key={`node-${index}`}>
                <rect x={x} y={y} width={width} height={Math.max(2, height)} rx={2} fill={color(payload.name)} />
                <text x={x + width + 6} y={y + Math.max(2, height) / 2 + 4} fontSize={11.5} fill="var(--ink)">
                  {nodeName(payload.name)} <tspan fill="var(--ink-3)">${Math.round(payload.value).toLocaleString()}</tspan>
                </text>
              </g>
            )
          }}
        >
          <Tooltip {...chart.tooltip} />
        </Sankey>
      </ResponsiveContainer>
      <div className="tnum mt-1 grid grid-cols-3 gap-2 text-[11px] text-ink-2">
        {links
          .filter((l) => l.target !== 'Card spend')
          .map((l) => (
            <div key={`${l.source}${l.target}`} className="rounded border border-line px-2 py-1">
              {personName(l.source as PersonId)} → {personName(l.target as PersonId)} <span className="text-ink">${l.value.toLocaleString()}</span> · “{l.label}”
            </div>
          ))}
      </div>
    </div>
  )
}

export const PAIRS: [PersonId, PersonId][] = [
  ['paul', 'cara'],
  ['paul', 'amy'],
  ['amy', 'ken'],
  ['paul', 'ken'],
  ['ken', 'cara'],
  ['amy', 'cara'],
]

/** Distance between two phones at each shared 10-minute slot (log scale). */
export function PairDistance({ fixed, height = 210 }: { fixed?: [PersonId, PersonId]; height?: number }) {
  const [picked, setPair] = useState<[PersonId, PersonId]>(['paul', 'cara'])
  const pair = fixed ?? picked
  const data = useMemo(() => pairDistanceSeries(pair[0], pair[1]).map((d) => ({ ...d, h: d.m / 60, dd: Math.max(5, d.d) })), [pair])
  const close = data.filter((d) => d.d <= 100).length
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {!fixed && PAIRS.map((p) => {
          const on = p[0] === pair[0] && p[1] === pair[1]
          return (
            <button key={p.join()} onClick={() => setPair(p)} className={`rounded-md border px-2 py-0.5 text-[11px] ${on ? 'border-ink text-ink' : 'border-line text-ink-2 hover:bg-sunken'}`}>
              {personName(p[0])}–{personName(p[1])}
            </button>
          )
        })}
        <span className="tnum ml-auto text-[11px] text-ink-3">
          {data.length} shared slots · {close} within 100 m
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 6, right: 12, left: -6, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chart.grid.stroke} />
          <XAxis dataKey="h" type="number" domain={[0, 168]} ticks={[0, 24, 48, 72, 96, 120, 144, 168]} tickFormatter={(h) => (h < 168 ? `${DAY[h / 24]} ${13 + h / 24}` : '')} {...chart.axis} />
          <YAxis dataKey="dd" scale="log" domain={[5, 40000]} ticks={[10, 100, 1000, 10000]} tickFormatter={(v) => (v >= 1000 ? `${v / 1000} km` : `${v} m`)} {...chart.axis} width={54} />
          <ReferenceLine y={100} stroke="var(--serious)" strokeDasharray="4 3" label={{ value: '100 m · together', position: 'insideTopLeft', fill: 'var(--ink-2)', fontSize: 10.5 }} />
          <ReferenceLine y={1000} stroke="var(--ink-3)" strokeDasharray="2 4" label={{ value: '1 km', position: 'insideTopLeft', fill: 'var(--ink-3)', fontSize: 10.5 }} />
          <Tooltip {...chart.tooltip} labelFormatter={(h) => hourLabel(Math.floor(Number(h)))} formatter={(v) => [`${Number(v) >= 1000 ? (Number(v) / 1000).toFixed(1) + ' km' : v + ' m'}`, 'distance']} />
          <Line
            type="linear"
            dataKey="dd"
            stroke="var(--ink-2)"
            strokeWidth={1.2}
            isAnimationActive={false}
            dot={(p: any) => (p.payload.d <= 100 ? <circle key={p.index} cx={p.cx} cy={p.cy} r={3.5} fill="var(--serious)" stroke="var(--surface)" strokeWidth={1.5} /> : <g key={p.index} />)}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Places sized by dwell time (stays table), optionally within a selected window. */
export function DwellMap({ window }: { window?: [number, number] | null }) {
  const dwell = useMemo(() => dwellByPlace(window ?? undefined), [window])
  const entries = Object.entries(dwell).map(([place, by]) => ({ place, by, total: Object.values(by).reduce((a, b) => a + b, 0) }))
  const max = Math.max(...entries.map((e) => e.total), 1)
  return (
    <div>
      <PlainMap places={PLACES} bounds={PLACES.map((p) => [p.lat, p.lon] as [number, number])} height={250} labelTol={0.004} labelNear={entries.filter((e) => e.total > 0).map((e) => { const p = PLACES.find((x) => x.name === e.place)!; return [p.lat, p.lon] as [number, number] })}>
        {entries.map((e) => {
          const p = PLACES.find((x) => x.name === e.place)
          if (!p || !e.total) return null
          const top = (Object.entries(e.by) as [PersonId, number][]).sort((a, b) => b[1] - a[1])[0][0]
          return (
            <CircleMarker key={e.place} center={[p.lat, p.lon]} radius={5 + 18 * Math.sqrt(e.total / max)} pathOptions={{ color: personColor(top), fillColor: personColor(top), fillOpacity: 0.3, weight: 1.2 }}>
              <LTooltip>
                <div className="text-[12px]">
                  <b>{e.place}</b>
                  {(Object.entries(e.by) as [PersonId, number][])
                    .filter(([, v]) => v > 0)
                    .map(([pp, v]) => (
                      <div key={pp}>
                        {personName(pp)}: {(v / 60).toFixed(1)} h
                      </div>
                    ))}
                </div>
              </LTooltip>
            </CircleMarker>
          )
        })}
      </PlainMap>
      <div className="mt-1.5 text-[11px] text-ink-3">Circle area = hours spent (stays). Colour = phone with the most time there. {window ? `Window: ${fmtTime(isoOf(window[0]))}–${fmtTime(isoOf(window[1]))}.` : 'Whole week.'}</div>
    </div>
  )
}
const isoOf = (m: number) => {
  const d = 13 + Math.floor(m / 1440)
  const r = Math.round(m % 1440)
  return `2026-04-${d}T${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}:00-04:00`
}

/** Anchor window close-up: 30-minute activity bins per phone, 08:00–16:00 on 17 Apr, with events. */
export function AnchorWindow() {
  const t0 = caseMinutes('2026-04-17T08:00:00-04:00')
  const t1 = caseMinutes('2026-04-17T16:00:00-04:00')
  const bins = (t1 - t0) / 30
  const data = CASE_PEOPLE.map((p) => {
    const b = new Array(bins).fill(0)
    for (const r of ROWS.values()) {
      if (r.device_owner !== p || (r.table !== 'messages' && r.table !== 'calls')) continue
      const m = caseMinutes(r.timestamp)
      if (m >= t0 && m < t1) b[Math.floor((m - t0) / 30)]++
    }
    return { p, b }
  })
  const max = Math.max(...data.flatMap((d) => d.b), 1)
  const W = 440
  const L = 44
  const rowH = 34
  const x = (m: number) => L + ((m - t0) / (t1 - t0)) * (W - L - 6)
  const ev = S7.events
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${CASE_PEOPLE.length * rowH + 20}`} className="w-full">
        <rect x={x(caseMinutes(S7.window.start))} y={0} width={x(caseMinutes(S7.window.end)) - x(caseMinutes(S7.window.start))} height={CASE_PEOPLE.length * rowH} fill="var(--serious)" opacity={0.1} />
        {[8, 10, 12, 14, 16].map((h) => {
          const m = t0 + (h - 8) * 60
          return (
            <g key={h}>
              <line x1={x(m)} x2={x(m)} y1={0} y2={CASE_PEOPLE.length * rowH} stroke="var(--line)" />
              <text x={x(m)} y={CASE_PEOPLE.length * rowH + 13} fontSize={10} textAnchor="middle" fill="var(--ink-3)">
                {h}:00
              </text>
            </g>
          )
        })}
        {data.map(({ p, b }, i) => {
          const base = (i + 1) * rowH - 6
          const off = ev.find((e) => e.device_owner === p && e.event_type === 'power_off')
          const on = ev.find((e) => e.device_owner === p && e.event_type === 'power_on')
          return (
            <g key={p}>
              <text x={0} y={base - 8} fontSize={11} fill="var(--ink-2)">
                {personName(p)}
              </text>
              {b.map((v, k) => (
                <rect key={k} x={x(t0 + k * 30) + 1} y={base - (v / max) * 22} width={x(t0 + 30) - x(t0) - 2} height={(v / max) * 22} rx={1.5} fill={personColor(p)}>
                  <title>{`${personName(p)} ${fmtTime(isoOf(t0 + k * 30))}–${fmtTime(isoOf(t0 + k * 30 + 30))}: ${v} messages + calls`}</title>
                </rect>
              ))}
              <line x1={L} x2={W - 6} y1={base} y2={base} stroke="var(--line-strong)" />
              {off && on && <rect x={x(caseMinutes(off.t))} y={base - 3} width={x(caseMinutes(on.t)) - x(caseMinutes(off.t))} height={6} rx={2} fill="var(--off)" />}
              {ev
                .filter((e) => e.device_owner === p && e.event_type === 'thread_deleted')
                .map((e) => (
                  <rect key={e.id} x={x(caseMinutes(e.t)) - 4} y={base - 28} width={8} height={8} transform={`rotate(45 ${x(caseMinutes(e.t))} ${base - 24})`} fill="var(--serious)" stroke="var(--surface)" strokeWidth={1.2}>
                    <title>{`${fmtTime(e.t)} thread deleted (${e.detail})`}</title>
                  </rect>
                ))}
              {p === 'paul' && (
                <g>
                  <line x1={x(caseMinutes(S7.trigger!.t))} x2={x(caseMinutes(S7.trigger!.t))} y1={base - 30} y2={base} stroke="var(--ink)" strokeDasharray="2 2" />
                  <text x={x(caseMinutes(S7.trigger!.t)) - 3} y={base - 30} fontSize={9.5} textAnchor="end" fill="var(--ink)">
                    audit notice 10:00
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 text-[11px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rotate-45 bg-serious" /> thread deleted
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-sm bg-off" /> powered off
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-serious/15" /> 50-min window
        </span>
        <span>bars = messages + calls per 30 min</span>
      </div>
    </div>
  )
}

export { PEOPLE, NUMBERS, SEGMENTS }

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
