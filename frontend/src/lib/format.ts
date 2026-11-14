// Case timestamps are ISO 8601 with the case's offset (-04:00). We display them in case-local
// time by reading the string directly, so the viewer's own timezone never shifts them.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function parts(iso: string) {
  const [date, rest] = iso.split('T')
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi, s] = rest.slice(0, 8).split(':').map(Number)
  return { y, mo, d, h, mi, s }
}

export function fmtTime(iso: string) {
  const p = parts(iso)
  return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`
}

export function fmtTimeSec(iso: string) {
  const p = parts(iso)
  return `${fmtTime(iso)}:${String(p.s).padStart(2, '0')}`
}

export function fmtDate(iso: string) {
  const p = parts(iso)
  return `${p.d} ${MONTHS[p.mo - 1]}`
}

export function fmtDateTime(iso: string) {
  return `${fmtDate(iso)} ${fmtTime(iso)}`
}

/** Minutes since 2026-04-13 00:00 case-local; used for timeline maths. */
export function caseMinutes(iso: string) {
  const p = parts(iso)
  return (p.d - 13) * 1440 + p.h * 60 + p.mi + p.s / 60
}

export function fmtKm(m: number) {
  // Under 1 km, metres rounded to 10 m read better than "1.0 km" for 951 m.
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toFixed(1)} km`
}

export function fmtMoney(n: number, currency = 'USD') {
  return `${currency === 'USD' ? '$' : currency + ' '}${n.toLocaleString('en-US')}`
}
