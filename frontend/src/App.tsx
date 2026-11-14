import { useEffect, useState } from 'react'
import { getCase, type CaseInfo } from './api'
import IngestPage from './pages/IngestPage'
import CasePage from './pages/CasePage'

type Page = 'ingest' | 'case'

export default function App() {
  const [page, setPage] = useState<Page>(() => (window.location.hash === '#case' ? 'case' : 'ingest'))
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null)

  useEffect(() => {
    getCase().then(setCaseInfo)
  }, [])
  useEffect(() => {
    window.location.hash = page
  }, [page])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-6 border-b border-slate-200 bg-white px-5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-slate-900 text-sm font-bold text-white">✓✗</div>
          <span className="text-lg font-semibold tracking-tight">Crosscheck</span>
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">mock-up</span>
        </div>
        <nav className="flex gap-1 text-sm">
          {(['ingest', 'case'] as Page[]).map((p, i) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`rounded-md px-3 py-1.5 font-medium ${page === p ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {i + 1}. {p === 'ingest' ? 'Ingest data' : 'Case analysis'}
            </button>
          ))}
        </nav>
        {caseInfo && <div className="ml-auto text-sm text-slate-500">{caseInfo.title} · synthetic data</div>}
      </header>
      <main className="min-h-0 flex-1">
        {page === 'ingest' ? <IngestPage onOpenCase={() => setPage('case')} /> : caseInfo ? <CasePage caseInfo={caseInfo} /> : null}
      </main>
    </div>
  )
}
