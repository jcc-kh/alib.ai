import type { Brief, CaseInfo } from '../api'

const BOXES: { key: keyof Brief; label: string; hint: string }[] = [
  { key: 'believe', label: 'What we believe', hint: 'One statement per line' },
  { key: 'confused', label: 'What confuses us', hint: 'One per line' },
  { key: 'unknown', label: "What we don't know", hint: 'One question per line' },
]

export default function BriefPanel({
  caseInfo,
  brief,
  onChange,
  onAnalyse,
  running,
}: {
  caseInfo: CaseInfo
  brief: Brief
  onChange: (b: Brief) => void
  onAnalyse: () => void
  running: boolean
}) {
  return (
    <div className="space-y-5 p-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Case</div>
        <h2 className="mt-0.5 text-base font-semibold leading-snug">{caseInfo.title}</h2>
        <p className="mt-1 text-xs text-slate-600">{caseInfo.summary}</p>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phones in this case</div>
        {caseInfo.people.map((p) => (
          <div key={p.person_id} className="rounded-lg border border-slate-200 p-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
              <span className="text-sm font-semibold">{p.name}</span>
              <span className="ml-auto font-mono text-[10px] text-slate-400">{p.device_id}</span>
            </div>
            <div className="ml-4.5 text-xs text-slate-500">{p.role}</div>
            <div className="mt-1.5 grid grid-cols-4 gap-1 text-center text-[11px]">
              {(
                [
                  ['msgs', p.counts.messages],
                  ['calls', p.counts.calls],
                  ['locs', p.counts.locations],
                  ['txns', p.counts.transfers],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded bg-slate-50 py-0.5">
                  <div className="font-semibold tabular-nums">{v.toLocaleString()}</div>
                  <div className="text-slate-500">{k}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Case brief</div>
        {BOXES.map((b) => (
          <label key={b.key} className="block">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm font-medium">{b.label}</span>
              <span className="text-[10px] text-slate-400">{b.hint}</span>
            </div>
            <textarea
              value={brief[b.key].join('\n')}
              onChange={(e) => onChange({ ...brief, [b.key]: e.target.value.split('\n') })}
              rows={3}
              className="w-full resize-y rounded-lg border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
        ))}
        <p className="text-[11px] text-slate-500">
          Tip: add “Paul met Cara in March.” to see a <i>cannot tell</i> verdict, or delete a line to see it surface under “What you didn't ask about”.
        </p>
        <button
          onClick={onAnalyse}
          disabled={running}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {running ? 'Analysing…' : 'Analyse'}
        </button>
      </div>
    </div>
  )
}
