import type { EvidenceByPhone } from '../../api'
import { PEOPLE, personColor, personName } from '../../mock/data'
import { fmtDate, fmtTimeSec } from '../../lib/format'

export default function EvidenceRows({ rows }: { rows: EvidenceByPhone }) {
  const owners = PEOPLE.map((p) => p.person_id).filter((id) => rows[id]?.length)
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Source rows · {owners.length} phone{owners.length === 1 ? '' : 's'}
      </div>
      {owners.map((owner) => (
        <details key={owner} open={rows[owner].length <= 12} className="rounded-lg border border-slate-200">
          <summary className="flex cursor-pointer items-center gap-2 bg-slate-50 px-3 py-1.5 text-sm font-medium">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: personColor(owner) }} />
            {personName(owner)}'s phone
            <span className="ml-auto text-xs font-normal text-slate-500">{rows[owner].length} rows</span>
          </summary>
          <table className="w-full text-xs">
            <tbody>
              {rows[owner].map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-2 py-1 font-mono text-[10.5px] text-slate-500">{r.id}</td>
                  <td className="whitespace-nowrap px-2 py-1 tabular-nums text-slate-600">
                    {fmtDate(r.timestamp)} {fmtTimeSec(r.timestamp)}
                  </td>
                  <td className="px-2 py-1 text-slate-800">{r.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </div>
  )
}
