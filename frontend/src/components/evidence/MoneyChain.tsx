import { Fragment } from 'react'
import type { ChainOutput } from '../../api'
import { personColor, personName } from '../../mock/data'
import { fmtDateTime, fmtMoney } from '../../lib/format'

export default function MoneyChain({ out }: { out: ChainOutput }) {
  const people = [out.links[0].from, ...out.links.map((l) => l.to)]
  return (
    <div className="space-y-3">
      <div className="flex items-center rounded-lg bg-slate-50 p-3">
        {people.map((p, i) => (
          <Fragment key={p + i}>
            <div className="flex flex-col items-center">
              <div className="grid h-11 w-11 place-items-center rounded-full text-sm font-bold text-white" style={{ background: personColor(p) }}>
                {personName(p)[0]}
              </div>
              <div className="mt-1 text-xs font-medium">{personName(p)}</div>
            </div>
            {i < out.links.length && (
              <div className="mx-1 flex flex-1 flex-col items-center">
                <div className="text-sm font-semibold">{fmtMoney(out.links[i].amount, out.links[i].currency)}</div>
                <div className="flex w-full items-center">
                  <div className="h-0.5 flex-1 bg-slate-400" />
                  <div className="h-0 w-0 border-y-4 border-l-8 border-y-transparent border-l-slate-400" />
                </div>
                <div className="text-[10px] text-slate-500">{fmtDateTime(out.links[i].t)}</div>
                <div className="text-[10px] italic text-slate-500">{out.links[i].memo ? `“${out.links[i].memo}”` : 'no memo'}</div>
              </div>
            )}
          </Fragment>
        ))}
      </div>
      {out.links.length > 1 && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-slate-50 py-1.5">
            <div className="text-slate-500">Gap</div>
            <div className="font-semibold">{out.gap_label}</div>
          </div>
          <div className="rounded-lg bg-slate-50 py-1.5">
            <div className="text-slate-500">Onward share</div>
            <div className="font-semibold">{Math.round(out.ratio * 100)}%</div>
          </div>
          <div className="rounded-lg bg-slate-50 py-1.5">
            <div className="text-slate-500">Rule</div>
            <div className="font-semibold">
              ≤{out.thresholds.window_h} h, {out.thresholds.ratio_min * 100}–{out.thresholds.ratio_max * 100}%
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
