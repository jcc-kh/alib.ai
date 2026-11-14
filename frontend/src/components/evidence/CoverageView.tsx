import type { CoverageOutput } from '../../api'
import { personColor, personName } from '../../mock/data'
import { fmtDateTime } from '../../lib/format'

export default function CoverageView({ out }: { out: CoverageOutput }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        The agent returned <b>cannot tell</b> instead of guessing. The item refers to a period outside what the phones hold, so no check can settle it.
      </div>
      <table className="w-full text-xs">
        <thead className="text-left text-slate-500">
          <tr>
            <th className="py-1">Phone</th>
            <th>Earliest row</th>
            <th>Latest row</th>
          </tr>
        </thead>
        <tbody>
          {out.devices.map((d) => (
            <tr key={d.owner} className="border-t border-slate-100">
              <td className="py-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: personColor(d.owner) }} />
                  {personName(d.owner)}
                </span>
              </td>
              <td>{fmtDateTime(d.first.t)}</td>
              <td>{fmtDateTime(d.last.t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-[11px] text-slate-500">Suggested: request carrier or bank records for the period the item refers to.</div>
    </div>
  )
}
