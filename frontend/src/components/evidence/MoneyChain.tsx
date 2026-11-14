import { Fragment } from 'react'
import type { ChainOutput } from '../../api'
import { personColor, personName } from '../../mock/data'
import { fmtDateTime, fmtMoney } from '../../lib/format'

export default function MoneyChain({ out }: { out: ChainOutput }) {
  const people = [out.links[0].from, ...out.links.map((l) => l.to)]
  return (
    <div className="space-y-6">
      <div className="flex items-center rounded-xl border border-line px-6 py-8">
        {people.map((p, i) => (
          <Fragment key={p + i}>
            <div className="flex flex-col items-center">
              <div className="grid h-14 w-14 place-items-center rounded-full border-2 font-serif text-2xl" style={{ borderColor: personColor(p), color: personColor(p) }}>
                {personName(p)[0]}
              </div>
              <div className="mt-2 text-sm text-fg">{personName(p)}</div>
            </div>
            {i < out.links.length && (
              <div className="mx-3 flex flex-1 flex-col items-center">
                <div className="font-serif text-2xl text-sage">{fmtMoney(out.links[i].amount, out.links[i].currency)}</div>
                <div className="my-1 flex w-full items-center">
                  <div className="h-px flex-1 bg-sage/60" />
                  <div className="h-0 w-0 border-y-[5px] border-l-[9px] border-y-transparent border-l-sage/80" />
                </div>
                <div className="text-[11px] text-faint">{fmtDateTime(out.links[i].t)}</div>
                <div className="text-[11px] italic text-faint">{out.links[i].memo ? `“${out.links[i].memo}”` : 'no memo'}</div>
              </div>
            )}
          </Fragment>
        ))}
      </div>
      {out.links.length > 1 && (
        <div className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line">
          {[
            ['Time between', out.gap_label],
            ['Passed on', `${Math.round(out.ratio * 100)}%`],
            ['Rule', `≤ ${out.thresholds.window_h} h · ${out.thresholds.ratio_min * 100}–${out.thresholds.ratio_max * 100}%`],
          ].map(([k, v]) => (
            <div key={k} className="px-4 py-3">
              <div className="text-[11px] text-faint">{k}</div>
              <div className="font-serif text-2xl text-fg">{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
