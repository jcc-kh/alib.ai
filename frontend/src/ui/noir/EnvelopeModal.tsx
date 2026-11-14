import { useState } from 'react'
import { useCase } from '../../state/caseStore'
import { SIGNALS } from '../../mock/signals'
import { personName } from '../../mock/data'
import { fmtDate, fmtTime } from '../../lib/format'

/** A manila case envelope: click the seal to break it, then read the typed pages inside. */
export default function EnvelopeModal() {
  const c = useCase()
  const e = c.openedEnvelope
  const [broken, setBroken] = useState(false)
  if (!e) return null
  const close = () => {
    c.openEnvelope(null)
    setBroken(false)
  }
  const sigs = SIGNALS.filter((s) => e.signal_ids.includes(s.signal_id))
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-6" onClick={close}>
      <div onClick={(ev) => ev.stopPropagation()} className="drop-in relative w-full max-w-[760px]">
        {!broken ? (
          <button onClick={() => setBroken(true)} className="manila relative block h-[380px] w-full rounded-sm text-left">
            <div className="absolute left-8 top-7 text-[12px] uppercase tracking-[0.25em] text-[#6b5328]">Case file № 2026-0417</div>
            <div className="absolute left-8 top-14 text-[28px] text-[#3a2a12]" style={{ fontFamily: 'var(--type-font)' }}>
              {e.file}
            </div>
            <div className="absolute left-8 top-[104px] text-[14px] text-[#5a4320]" style={{ fontFamily: 'var(--type-font)' }}>
              From: {e.agent}
            </div>
            <div className="absolute left-8 top-[128px] text-[14px] text-[#5a4320]" style={{ fontFamily: 'var(--type-font)' }}>
              Contents: {e.findings.length} findings · {sigs.length} signals · {e.tool_calls.length} checks
            </div>
            <span className="stamp absolute right-10 top-10 text-[22px] text-[#a3201e]">Sealed</span>
            <div className="absolute bottom-24 left-1/2 grid h-20 w-20 -translate-x-1/2 place-items-center rounded-full border-4 border-[#7a1716] bg-[#a3201e] text-[11px] uppercase tracking-widest text-[#f3d9b0] shadow-lg">
              break
            </div>
            <div className="absolute bottom-7 w-full text-center text-[12px] text-[#6b5328]">click the wax seal to open</div>
          </button>
        ) : (
          <div className="paper max-h-[86vh] overflow-y-auto rounded-sm px-9 py-7" style={{ fontFamily: 'var(--type-font)' }}>
            <div className="flex items-baseline gap-3">
              <span className="text-[22px] text-[#221a10]">{e.file}</span>
              <span className="stamp ml-auto text-[13px] text-[#3b6b2c]">Opened</span>
            </div>
            <div className="text-[13px] text-[#594834]">
              {e.agent} · worked t+{(e.started_ms / 1000).toFixed(1)}s to t+{(e.finished_ms / 1000).toFixed(1)}s
            </div>
            <p className="typed mt-4 border-l-4 border-[#a3201e] pl-3 text-[15px] leading-relaxed text-[#221a10]">{e.summary}</p>

            <h4 className="mt-6 text-[13px] uppercase tracking-[0.2em] text-[#85745b]">Findings</h4>
            {e.findings.length === 0 && <p className="text-[13px] text-[#85745b]">None in this envelope.</p>}
            <ol className="mt-1 space-y-2">
              {e.findings.map((f, i) => (
                <li key={f.id}>
                  <button
                    onClick={() => {
                      close()
                      c.openFinding(f)
                    }}
                    className="text-left text-[14px] leading-snug text-[#221a10] underline decoration-[#c9b38a] underline-offset-4 hover:decoration-[#a3201e]"
                  >
                    {i + 1}. {f.statement}
                  </button>
                </li>
              ))}
            </ol>

            <h4 className="mt-6 text-[13px] uppercase tracking-[0.2em] text-[#85745b]">Checks run</h4>
            <table className="mt-1 w-full text-[12.5px] text-[#221a10]" style={{ fontFamily: 'var(--mono-font)' }}>
              <tbody>
                {e.tool_calls.map((t) => (
                  <tr key={t.id} className="border-b border-dashed border-[#d3c09a] align-top">
                    <td className="py-1 pr-3">
                      {t.check}({t.args})
                      {t.follow_up_from && <div className="text-[11px] text-[#a3201e]">at the request of {t.follow_up_from}</div>}
                    </td>
                    <td className="py-1 pr-3 text-[#594834]">{t.result}</td>
                    <td className="py-1 text-right text-[#85745b]">{t.rows.toLocaleString()} rows</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(e.follow_ups_received.length > 0 || e.follow_ups_sent.length > 0) && (
              <>
                <h4 className="mt-6 text-[13px] uppercase tracking-[0.2em] text-[#85745b]">Notes passed</h4>
                {e.follow_ups_sent.map((h, i) => (
                  <p key={`s${i}`} className="mt-1 rotate-[-0.5deg] bg-[#fff6a8] px-3 py-1.5 text-[13px] text-[#221a10] shadow">
                    To {h.to}: {h.note}
                  </p>
                ))}
                {e.follow_ups_received.map((h, i) => (
                  <p key={`r${i}`} className="mt-1 rotate-[0.5deg] bg-[#fff6a8] px-3 py-1.5 text-[13px] text-[#221a10] shadow">
                    From {h.from}: {h.note}
                  </p>
                ))}
              </>
            )}

            {sigs.length > 0 && (
              <>
                <h4 className="mt-6 text-[13px] uppercase tracking-[0.2em] text-[#85745b]">Signals logged</h4>
                <ul className="mt-1 space-y-0.5 text-[12.5px] text-[#221a10]" style={{ fontFamily: 'var(--mono-font)' }}>
                  {sigs.map((s) => (
                    <li key={s.signal_id}>
                      {s.signal_id} · {s.check} · {s.people.map(personName).join(', ')} · {fmtDate(s.start)} {fmtTime(s.start)}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {e.dismissed.length > 0 && (
              <>
                <h4 className="mt-6 text-[13px] uppercase tracking-[0.2em] text-[#85745b]">Set aside</h4>
                {e.dismissed.map((d) => (
                  <p key={d.title} className="mt-1 text-[13px] text-[#594834] line-through decoration-[#a3201e]/60">
                    {d.title}
                  </p>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
