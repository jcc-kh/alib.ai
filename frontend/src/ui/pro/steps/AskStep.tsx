import { useCase } from '../../../state/caseStore'
import { Panel } from '../kit'
import { AskThread } from '../AskPanel'

export default function AskStep() {
  const c = useCase()
  const findings = c.briefing?.incidents.flatMap((i) => i.findings) ?? []
  return (
    <div className="grid h-full grid-cols-12 gap-3 p-4">
      <Panel title="Questions" className="col-span-8 h-[calc(100vh-5.5rem)]" pad={false}>
        <AskThread />
      </Panel>
      <Panel title="Findings in this case" count={findings.length} className="col-span-4" pad={false}>
        <ul className="divide-y divide-line">
          {findings.map((f) => (
            <li key={f.id}>
              <button onClick={() => c.openFinding(f)} className="w-full px-3 py-2 text-left text-[12px] text-ink hover:bg-sunken">
                {f.statement}
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
