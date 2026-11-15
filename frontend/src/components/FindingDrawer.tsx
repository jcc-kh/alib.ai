import { useEffect, useState } from 'react'
import type { EvidenceByPhone, EvidenceRow, Finding } from '../api'
import type { EvidenceItem } from '../state/caseStore'
import { ROWS, personColor, personName } from '../mock/data'
import { fmtDate, fmtTime } from '../lib/format'
import FindingDetail from './FindingDetail'
import SourcesView from './SourcesView'
import { PersonChip, Tabs, Title } from './ui'

/** Side drawer for a finding (an insight's evidence) or any other evidence item from the dashboard. */
export default function FindingDrawer({ finding, item, onClose }: { finding: Finding | null; item?: EvidenceItem | null; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  if (!finding && !item) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="slide-in relative h-full w-[min(760px,100vw)] overflow-y-auto border-l border-line bg-canvas px-8 py-7">
        <button onClick={onClose} className="absolute right-6 top-6 text-sm text-faint hover:text-fg">
          Close ✕
        </button>
        {finding ? <FindingDetail finding={finding} /> : <ItemDetail item={item!} />}
      </aside>
    </div>
  )
}

export function byPhone(ids: string[]): EvidenceByPhone {
  const out: EvidenceByPhone = {}
  for (const id of ids) {
    const r = ROWS.get(id)
    if (r) (out[r.device_owner] ??= []).push(r)
  }
  for (const rs of Object.values(out)) rs.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  return out
}

function ItemDetail({ item }: { item: EvidenceItem }) {
  const [tab, setTab] = useState<'evidence' | 'sources'>('evidence')
  useEffect(() => setTab('evidence'), [item])
  const rows = byPhone(item.ids)
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Title size="md">{item.title}</Title>
        <div className="flex flex-wrap items-center gap-2">
          {item.people.map((p) => (
            <PersonChip key={p} id={p} />
          ))}
          <span className="ml-auto text-xs text-faint">
            {item.ids.length} source row{item.ids.length === 1 ? '' : 's'} from {Object.keys(rows).length} phone{Object.keys(rows).length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ['evidence', 'Evidence'],
          ['sources', 'Sources (raw logs)'],
        ]}
      />
      <div className="rise" key={tab}>
        {tab === 'evidence' ? (
          <div className="space-y-5">
            {item.points.length > 0 && (
              <ul className="space-y-1.5">
                {item.points.map((p, i) => (
                  <li key={i} className="flex gap-2 text-[14px] leading-snug text-ink">
                    <span className="text-ink-3">•</span>
                    {p}
                  </li>
                ))}
              </ul>
            )}
            <ReadableRows rows={rows} />
          </div>
        ) : (
          <SourcesView rows={rows} />
        )}
      </div>
    </div>
  )
}

/** The rows in plain words, oldest first: time, which phone holds it, what it says. */
export function ReadableRows({ rows }: { rows: EvidenceByPhone }) {
  const all: EvidenceRow[] = Object.values(rows)
    .flat()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  if (!all.length) return null
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">What the phones recorded</div>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {all.map((r) => (
          <li key={r.id} className="flex gap-3 px-3 py-2 text-[13px]">
            <span className="tnum w-24 shrink-0 text-ink-3">
              {fmtDate(r.timestamp)} {fmtTime(r.timestamp)}
            </span>
            <span className="w-28 shrink-0 text-[12px]" style={{ color: personColor(r.device_owner) }}>
              {personName(r.device_owner)}'s phone
            </span>
            <span className="min-w-0 flex-1 text-ink">{r.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
