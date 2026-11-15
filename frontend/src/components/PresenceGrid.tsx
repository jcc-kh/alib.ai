import type { PersonId, PresenceOutput, PresenceStatus, SpaceOutput } from '../api'
import { fmtKm, fmtTime } from '../lib/format'
import { addMin } from '../mock/data'
import Portrait from './Portrait'

export const PRESENCE_STYLE: Record<PresenceStatus, { label: string; fill: string; text: string }> = {
  scene: { label: 'At the scene', fill: 'var(--serious)', text: 'var(--surface)' },
  near: { label: 'Within 2 km', fill: 'color-mix(in srgb, var(--serious) 32%, var(--surface))', text: 'var(--ink)' },
  away: { label: 'More than 2 km away', fill: 'var(--sunken)', text: 'var(--ink-2)' },
  no_data: { label: 'No location data', fill: 'transparent', text: 'var(--ink-2)' },
}
const HATCH = 'repeating-linear-gradient(45deg, var(--line-strong) 0 1.5px, transparent 1.5px 6px)'

type Phone = PresenceOutput['phones'][number]
type Run = { status: PresenceStatus; gap?: string; i0: number; i1: number; min_m: number | null; row_id: string | null }

/** Consecutive 10-minute slots with the same status, merged into one stretch. */
function runsOf(p: Phone): Run[] {
  const out: Run[] = []
  p.slots.forEach((s, i) => {
    const last = out[out.length - 1]
    if (last && last.status === s.status && last.gap === s.gap_type) {
      last.i1 = i
      if (s.distance_m !== null) last.min_m = Math.min(last.min_m ?? Infinity, s.distance_m)
    } else out.push({ status: s.status, gap: s.gap_type, i0: i, i1: i, min_m: s.distance_m, row_id: s.row_id })
  })
  return out
}

function runLabel(r: Run) {
  if (r.status === 'scene') return 'at the scene'
  if (r.status === 'no_data') return r.gap === 'powered_off' ? 'phone switched off' : r.gap === 'location_off' ? 'location off, phone in use' : 'no location data'
  return `${r.status === 'near' ? '' : '≥ '}${fmtKm(r.min_m ?? 0)} away`
}

/** The one-line answer for a phone: placed, unaccounted for, or at the scene. `short` fits the board card. */
function verdict(p: Phone, slotMin: number): { tag: string; color: string; text: string; short: string } {
  const n = p.slots.length
  const firstScene = p.slots.find((s) => s.status === 'scene')
  if (p.counts.scene === n) return { tag: 'At the scene', color: 'var(--serious)', text: 'At the scene for the whole window', short: 'whole window' }
  if (firstScene) return { tag: 'At the scene', color: 'var(--serious)', text: `At the scene from ${fmtTime(firstScene.t)}`, short: `from ${fmtTime(firstScene.t)}` }
  const nearest = p.closest_m !== null ? `${fmtKm(p.closest_m)} from the scene at ${fmtTime(p.closest_t!)}` : 'no fix in the window'
  if (p.counts.no_data) {
    const gaps = p.slots.filter((s) => s.status === 'no_data')
    const span = `${fmtTime(gaps[0].t)}–${fmtTime(gaps[gaps.length - 1].t)}`
    return { tag: 'Unaccounted', color: 'var(--warning)', text: `No location ${span} · last fix ${nearest}`, short: `no location ${span}` }
  }
  if (p.counts.near) return { tag: 'Nearby', color: 'var(--warning)', text: `Came within ${nearest}`, short: `within ${fmtKm(p.closest_m ?? 0)}` }
  return { tag: 'Placed away', color: 'var(--good)', text: `Away the whole window · never closer than ${fmtKm(p.closest_m ?? 0)}`, short: `≥ ${fmtKm(p.closest_m ?? 0)} away` }
}

/**
 * Where was each phone during the time-of-death window? One bar per phone across the window,
 * coloured by distance from the scene, with a plain answer beside it. Each stretch is built from
 * 10-minute location fixes (or their absence); hover for details, click to open the row.
 */
export default function PresenceGrid({ out, onPick, compact = false, fresh = [], space }: { out: PresenceOutput; onPick?: (rowId: string) => void; compact?: boolean; fresh?: PersonId[]; legend?: boolean; space?: SpaceOutput }) {
  // Routine context: is being at the scene ordinary for this phone? (stays there on 2+ days in the week)
  const routine = (p: PersonId) => {
    const s = space?.spaces.find((x) => x.person === p)
    if (!s || s.person === space?.victim) return null
    const days = s.scene_visits.length
    return s.scene_inside ? `goes to ${out.scene.name.split(' ').slice(0, 2).join(' ')} regularly (${days} day${days === 1 ? '' : 's'} this week)` : days ? `at ${out.scene.name.split(' ').slice(0, 2).join(' ')} on ${days} day${days === 1 ? '' : 's'} this week` : null
  }
  const n = out.phones[0]?.slots.length ?? 0
  const slotMin = out.thresholds.slot_min
  const t0 = out.phones[0]?.slots[0].t ?? out.window.start
  const total = n * slotMin
  const ticks: { pct: number; label: string }[] = []
  for (let m = 0; m <= total; m += 30) ticks.push({ pct: (m / total) * 100, label: fmtTime(addMin(t0, m)) })
  const barH = compact ? 20 : 26
  const nameW = compact ? 84 : 110
  return (
    <div>
      <div className="space-y-1.5">
        {out.phones.map((p) => {
          const v = verdict(p, slotMin)
          return (
            <div key={p.person} className={`flex items-center gap-3 ${fresh.includes(p.person) ? 'row-in' : ''}`}>
              <div className="shrink-0" style={{ width: nameW }}>
                <Portrait id={p.person} size={compact ? 20 : 26} label />
              </div>
              <div className="relative min-w-0 flex-1 overflow-hidden rounded-[5px] border border-line" style={{ height: barH }}>
                {runsOf(p).map((r) => {
                  const st = PRESENCE_STYLE[r.status]
                  const w = ((r.i1 - r.i0 + 1) / n) * 100
                  const from = p.slots[r.i0].t
                  const to = addMin(p.slots[r.i1].t, slotMin)
                  return (
                    <button
                      key={r.i0}
                      onClick={() => r.row_id && onPick?.(r.row_id)}
                      title={`${fmtTime(from)}–${fmtTime(to)} · ${runLabel(r)}`}
                      className="absolute top-0 flex h-full items-center overflow-hidden whitespace-nowrap px-1.5 text-left"
                      style={{ left: `${(r.i0 / n) * 100}%`, width: `${w}%`, background: r.status === 'no_data' ? HATCH : st.fill, color: st.text, fontSize: compact ? 10.5 : 11.5, borderLeft: r.i0 ? '2px solid var(--surface)' : undefined }}
                    >
                      {w >= (compact ? 22 : 15) && <span className={r.status === 'no_data' ? 'rounded bg-surface/85 px-1' : ''}>{runLabel(r)}</span>}
                    </button>
                  )
                })}
              </div>
              <div className="shrink-0 text-[12px] leading-tight" style={{ width: compact ? 150 : 300 }}>
                <span className="mr-1.5 inline-flex items-center gap-1 font-medium" style={{ color: v.color }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.color }} />
                  {v.tag}
                </span>
                {!compact && <span className="tnum text-ink-2">{v.text}</span>}
                {!compact && routine(p.person) && <div className="text-[11px] text-ink-3">Context: {routine(p.person)}</div>}
                {compact && <div className="tnum truncate text-[11px] text-ink-3" title={v.text}>{v.short}</div>}
              </div>
            </div>
          )
        })}
      </div>
      {/* clock axis under the bars */}
      <div className="mt-1 flex gap-3">
        <div className="shrink-0" style={{ width: nameW }} />
        <div className="relative h-4 min-w-0 flex-1 text-[10.5px] text-ink-3">
          {ticks.map((t, i) => (
            <span key={t.label} className="tnum absolute" style={{ left: `${t.pct}%`, transform: i === 0 ? undefined : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
              {t.label}
            </span>
          ))}
        </div>
        <div className="shrink-0" style={{ width: compact ? 150 : 300 }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-2">
        {(Object.keys(PRESENCE_STYLE) as PresenceStatus[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-sm border border-line-strong" style={{ background: k === 'no_data' ? HATCH : PRESENCE_STYLE[k].fill }} />
            {PRESENCE_STYLE[k].label}
          </span>
        ))}
      </div>
    </div>
  )
}
