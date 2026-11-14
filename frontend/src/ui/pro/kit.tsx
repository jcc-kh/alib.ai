// Small dashboard primitives for the Pro UI. Everything uses semantic tokens so light/dark both work.
import type { ReactNode } from 'react'
import type { PersonId, Verdict } from '../../api'
import { personColor, personName } from '../../mock/data'

export function Panel({
  title,
  count,
  actions,
  children,
  className = '',
  pad = true,
  sub,
}: {
  title: ReactNode
  count?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  pad?: boolean
  sub?: ReactNode
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-lg border border-line bg-surface ${className}`}>
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">{title}</h3>
        {count !== undefined && <span className="tnum rounded bg-sunken px-1.5 text-[11px] text-ink-2">{count}</span>}
        {sub && <span className="truncate text-[11px] text-ink-3">{sub}</span>}
        <div className="ml-auto flex items-center gap-1.5">{actions}</div>
      </header>
      <div className={`min-h-0 flex-1 ${pad ? 'p-3' : ''}`}>{children}</div>
    </section>
  )
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'serious' | 'good' }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="text-[11px] text-ink-2">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-[22px] font-semibold leading-tight text-ink">{value}</span>
        {tone && <span className={`h-1.5 w-1.5 rounded-full ${tone === 'serious' ? 'bg-serious' : 'bg-good'}`} />}
      </div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-ink-3">{sub}</div>}
    </div>
  )
}

export function Btn({
  children,
  onClick,
  kind = 'default',
  disabled,
  className = '',
  title,
}: {
  children: ReactNode
  onClick?: () => void
  kind?: 'primary' | 'default' | 'ghost'
  disabled?: boolean
  className?: string
  title?: string
}) {
  const k =
    kind === 'primary'
      ? 'bg-ink text-surface hover:opacity-90'
      : kind === 'ghost'
        ? 'text-ink-2 hover:bg-sunken hover:text-ink'
        : 'border border-line-strong bg-surface text-ink hover:bg-sunken'
  return (
    <button title={title} disabled={disabled} onClick={onClick} className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${k} ${className}`}>
      {children}
    </button>
  )
}

export function PersonTag({ id }: { id: PersonId }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] text-ink">
      <span className="h-2 w-2 rounded-sm" style={{ background: personColor(id) }} />
      {personName(id)}
    </span>
  )
}

const VERDICT_STYLE: Record<Verdict | 'sweep', { label: string; icon: string; color: string }> = {
  confirmed: { label: 'Confirmed', icon: '✓', color: 'var(--good)' },
  inconsistent: { label: 'Inconsistent', icon: '✕', color: 'var(--serious)' },
  cannot_tell: { label: 'Cannot tell', icon: '?', color: 'var(--ink-3)' },
  sweep: { label: 'Unprompted', icon: '◆', color: 'var(--accent)' },
}

/** Status shown as icon + label (never colour alone); the label stays in ink. */
export function VerdictPill({ v }: { v: Verdict | 'sweep' }) {
  const s = VERDICT_STYLE[v]
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-line px-1.5 py-px text-[11px] text-ink-2">
      <span className="font-bold" style={{ color: s.color }}>
        {s.icon}
      </span>
      {s.label}
    </span>
  )
}

export function StrengthBar({ v }: { v: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-sunken">
        <span className="block h-full rounded-full bg-ink-2" style={{ width: `${v * 100}%` }} />
      </span>
      <span className="tnum text-[11px] text-ink-2">{v.toFixed(2)}</span>
    </span>
  )
}

export function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[11px] ${className}`}>{children}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="grid h-full min-h-24 place-items-center text-[12px] text-ink-3">{children}</div>
}

/** Shared Recharts styling, resolved through CSS variables so it follows the theme. */
export const chart = {
  axis: { stroke: 'var(--line-strong)', tick: { fill: 'var(--ink-3)', fontSize: 11 }, tickLine: false },
  grid: { stroke: 'var(--line)', strokeDasharray: '0' },
  tooltip: {
    contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, color: 'var(--ink)', boxShadow: '0 4px 14px rgb(0 0 0 / 0.12)' },
    labelStyle: { color: 'var(--ink-2)', fontSize: 11 },
    itemStyle: { color: 'var(--ink)', padding: 0 },
    cursor: { stroke: 'var(--ink-3)', strokeDasharray: '3 3' },
  },
}
