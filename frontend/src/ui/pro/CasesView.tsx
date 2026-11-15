import { DEMO_CASE_NAME, useCase } from '../../state/caseStore'

/** Archived cases shown for context; only the Pier 9 case has data in this mock. */
const ARCHIVE = [
  { name: 'Dockside storage break-in', phones: 3, range: '2–6 Mar 2026', status: 'Closed', insights: 3, updated: '19 Mar' },
  { name: 'Northgate payroll query', phones: 2, range: '10–14 Feb 2026', status: 'Closed', insights: 1, updated: '27 Feb' },
  { name: 'Riverside van collision', phones: 4, range: '8–9 Jan 2026', status: 'Closed', insights: 2, updated: '21 Jan' },
]

export default function CasesView({ open, theme, toggleTheme }: { open: (v: 'board') => void; theme: 'light' | 'dark'; toggleTheme: () => void }) {
  const c = useCase()
  return (
    <div className="flex h-full flex-col bg-page text-ink">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-6">
        <span className="grid h-6 w-6 place-items-center rounded bg-ink text-[11px] font-bold text-surface">A</span>
        <span className="text-[14px] font-semibold">Alib.ai</span>
        <span className="rounded border border-line px-1.5 text-[10px] text-ink-3">mock</span>
        <button onClick={toggleTheme} title="Toggle theme" className="ml-auto grid h-7 w-7 place-items-center rounded-md border border-line text-[13px] text-ink-2 hover:bg-sunken">
          {theme === 'light' ? '☾' : '☀'}
        </button>
      </header>
      <main className="mx-auto w-full max-w-[1100px] flex-1 overflow-y-auto px-6 py-8">
        <div className="flex items-center">
          <h1 className="text-[20px] font-semibold">Cases</h1>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full text-[13px]">
            <thead className="text-left text-[11px] text-ink-3">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">Case</th>
                <th className="px-3 py-2 font-medium">Phones</th>
                <th className="px-3 py-2 font-medium">Date range</th>
                <th className="px-3 py-2 font-medium">Insights</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              <Row
                name={DEMO_CASE_NAME}
                phones={`${c.loaded.length} of 5`}
                range="13–19 Apr 2026"
                insights={c.board.incidents.length}
                status="Active"
                updated="now"
                onClick={() => open('board')}
              />
              {ARCHIVE.map((a) => (
                <Row key={a.name} name={a.name} phones={a.phones} range={a.range} insights={a.insights} status={a.status} updated={a.updated} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-ink-3">Closed cases are listed for context. Only the Pier 9 case has data in this mock.</p>
      </main>
    </div>
  )
}

function Row({ name, phones, range, insights, status, updated, onClick }: { name: string; phones: number | string; range: string; insights: number | string; status: string; updated: string; onClick?: () => void }) {
  return (
    <tr onClick={onClick} className={`border-b border-line last:border-0 ${onClick ? 'cursor-pointer hover:bg-sunken' : 'text-ink-3'}`}>
      <td className={`px-4 py-2.5 ${onClick ? 'font-medium text-ink' : ''}`}>{name}</td>
      <td className="tnum px-3 py-2.5">{phones}</td>
      <td className="tnum px-3 py-2.5">{range}</td>
      <td className="tnum px-3 py-2.5">{insights}</td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center gap-1.5 text-[12px] ${status === 'Closed' ? 'text-ink-3' : 'text-ink'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status === 'Closed' ? 'bg-line-strong' : status === 'Active' ? 'bg-good' : 'bg-accent'}`} />
          {status}
        </span>
      </td>
      <td className="tnum px-4 py-2.5 text-right text-ink-3">{updated}</td>
    </tr>
  )
}
