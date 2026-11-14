import { useMemo, useState } from 'react'
import type { EvidenceByPhone, Finding } from '../api'
import { verifyFinding } from '../lib/verify'
import { Eyebrow } from './ui'

type Review = 'unreviewed' | 'agree' | 'dispute'

export default function VerifyView({ finding, rows }: { finding: Finding; rows: EvidenceByPhone }) {
  const results = useMemo(() => verifyFinding(finding, rows), [finding, rows])
  const passed = results.filter((r) => r.ok).length
  const [review, setReview] = useState<Review>('unreviewed')
  const [note, setNote] = useState('')

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-5 rounded-xl border border-line bg-panel p-5">
        <div className={`font-serif text-5xl ${passed === results.length ? 'text-sage' : 'text-terra-soft'}`}>
          {passed}/{results.length}
        </div>
        <div className="text-sm text-muted">
          checks reproduced in your browser from the {Object.values(rows).flat().length} raw rows, without using the check's own output. A mismatch here
          means the finding should not be relied on.
        </div>
      </div>

      <section>
        <Eyebrow className="mb-3">Independent recomputation</Eyebrow>
        <div className="overflow-hidden rounded-lg border border-line">
          <div className="grid grid-cols-[1fr_7rem_7rem_2rem] gap-3 border-b border-line bg-panel px-4 py-2 text-[11px] uppercase tracking-wider text-faint">
            <span>Claim</span>
            <span>Report says</span>
            <span>Recomputed</span>
            <span />
          </div>
          {results.map((r) => (
            <div key={r.label} className="grid grid-cols-[1fr_7rem_7rem_2rem] items-start gap-3 border-b border-line px-4 py-3 text-sm last:border-0">
              <div>
                <div className="text-fg">{r.label}</div>
                <div className="mt-0.5 text-xs text-faint">{r.how}</div>
              </div>
              <span className="text-muted">{r.claimed}</span>
              <span className="text-fg">{r.recomputed}</span>
              <span className={r.ok ? 'text-sage' : 'text-terra-soft'}>{r.ok ? '✓' : '✗'}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <Eyebrow className="mb-3">Trace it back yourself</Eyebrow>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>Open the <b className="text-fg">Sources</b> tab and note the bundle hash, file and line for each row.</li>
          <li>Unzip the original bundle, confirm its SHA-256 matches, then open each file at that line.</li>
          <li>Compare the raw JSON line with the row shown here. Ingest only normalises formats (phone numbers, timestamps), never values.</li>
          <li>Re-run the check from the <b className="text-fg">How we know</b> tab against the case store to reproduce the result.</li>
        </ol>
      </section>

      <section>
        <Eyebrow className="mb-3">Your review</Eyebrow>
        <div className="flex gap-2">
          {(
            [
              ['agree', 'I checked this, it holds'],
              ['dispute', 'I dispute this'],
            ] as [Review, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setReview(review === k ? 'unreviewed' : k)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                review === k ? (k === 'agree' ? 'border-sage text-sage' : 'border-terra-soft text-terra-soft') : 'border-line-strong text-muted hover:text-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {review !== 'unreviewed' && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={review === 'dispute' ? 'What looks wrong?' : 'Optional note for the case file'}
            className="mt-3 w-full rounded-lg border border-line bg-panel p-3 text-sm text-fg placeholder:text-faint focus:border-line-strong focus:outline-none"
            rows={2}
          />
        )}
        <p className="mt-2 text-xs text-faint">Mock-up: reviews are kept in this tab only. The real build stores them with the case so the report records who checked what.</p>
      </section>
    </div>
  )
}
