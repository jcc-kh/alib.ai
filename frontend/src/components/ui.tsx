import type { ReactNode } from 'react'
import type { PersonId, Verdict } from '../api'
import { personColor, personName } from '../mock/data'

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`text-[11px] font-medium uppercase tracking-[0.14em] text-faint ${className}`}>{children}</div>
}

export function Title({ children, size = 'lg', className = '' }: { children: ReactNode; size?: 'xl' | 'lg' | 'md' | 'sm'; className?: string }) {
  const s = { xl: 'text-5xl leading-[1.08]', lg: 'text-4xl leading-tight', md: 'text-xl leading-snug', sm: 'text-xl leading-snug' }[size]
  return <h2 className={`font-serif font-normal tracking-[-0.01em] text-fg ${s} ${className}`}>{children}</h2>
}

export function PersonChip({ id, small = false }: { id: PersonId; small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-line ${small ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'} text-muted`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: personColor(id) }} />
      {personName(id)}
    </span>
  )
}

export const VERDICT: Record<Verdict | 'sweep', { label: string; color: string }> = {
  confirmed: { label: 'Confirmed', color: 'var(--good)' },
  inconsistent: { label: 'Inconsistent', color: 'var(--serious)' },
  cannot_tell: { label: 'Cannot tell', color: 'var(--ink-2)' },
  sweep: { label: 'Found unprompted', color: 'var(--amber)' },
}

export function VerdictBadge({ v }: { v: Verdict | 'sweep' }) {
  const s = VERDICT[v]
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: s.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-6 border-b border-line">
      {tabs.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`-mb-px border-b pb-2.5 text-sm transition ${value === k ? 'border-fg text-fg' : 'border-transparent text-faint hover:text-muted'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-serif text-4xl text-fg">{value}</div>
      <div className="mt-1 text-xs text-faint">{label}</div>
    </div>
  )
}

export function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[11px] text-faint ${className}`}>{children}</span>
}
