import type { IngestReport, IngestStage } from '../api/types'
import { countsFor } from './background'

export const INGEST_STAGES: IngestStage[] = [
  { id: 'load', label: 'Load', detail: 'Read manifest.json and 36 JSONL files across 4 devices', status: 'pending' },
  { id: 'validate', label: 'Validate', detail: 'Check every row against the Case Bundle v1 schema', status: 'pending' },
  { id: 'normalise', label: 'Normalise', detail: 'Phone numbers to E.164, timestamps to ISO 8601 with offset, geofence places', status: 'pending' },
  { id: 'resolve', label: 'Resolve entities', detail: 'Map phone numbers, emails and social handles to people', status: 'pending' },
  { id: 'store', label: 'Store', detail: 'Write 9 tables to SQLite with device_owner on every row', status: 'pending' },
  { id: 'index', label: 'Index', detail: 'Build per-pair contact and 10-minute location indexes', status: 'pending' },
]

const coverage = { coverage_start: '2026-04-13T00:00:00-04:00', coverage_end: '2026-04-19T23:50:00-04:00' }

const DEVICES = [
  { device_id: 'paul-iphone', owner: 'paul', model: 'iPhone 15', extracted_at: '2026-04-21T09:14:00-04:00' },
  { device_id: 'amy-pixel', owner: 'amy', model: 'Pixel 8', extracted_at: '2026-04-21T10:02:00-04:00' },
  { device_id: 'ken-galaxy', owner: 'ken', model: 'Galaxy S24', extracted_at: '2026-04-21T11:30:00-04:00' },
  { device_id: 'cara-iphone', owner: 'cara', model: 'iPhone 14', extracted_at: '2026-04-21T13:45:00-04:00' },
] as const

/** Ingest report with every count computed from the generated rows. */
export function buildIngestReport(): IngestReport {
  const devices = DEVICES.map((d) => {
    const c = countsFor(d.owner)
    return {
      ...d,
      extraction_tool: 'synthetic-generator 0.1',
      ...coverage,
      counts: { ...c, social_accounts: d.owner === 'amy' || d.owner === 'ken' ? 1 : 2 } as Record<string, number>,
    }
  })
  const total = devices.reduce((n, d) => n + Object.values(d.counts).reduce((a, b) => a + b, 0), 0)
  const msgs = devices.reduce((n, d) => n + d.counts.messages, 0)
  return {
    bundle_name: 'harbor-supply-case.zip',
    schema_version: 'case-bundle/1.0',
    files_read: 36,
    rows_checked: total,
    errors: 0,
    devices,
    warnings: [
      { level: 'info', message: `Normalised ${msgs.toLocaleString()} message timestamps to ISO 8601 with offset -04:00.` },
      { level: 'info', message: 'Resolved 6 social handles to 4 people using the accounts logged in on each device.' },
      { level: 'warn', message: '1 identifier is not a person: +1 555 010 0900 (saved as "Harbor Supply Finance" on Paul\'s phone). Kept as an organisation.' },
      { level: 'warn', message: "Ken's phone has no location data from 15 Apr 23:20 to 16 Apr 07:00, matching a power_off event." },
      { level: 'warn', message: "Paul's, Ken's and Cara's phones have location gaps on 17 Apr between 10:30 and 14:00, matching power_off events." },
      { level: 'warn', message: "Ken's phone has no location data on 15 Apr 14:00–16:30 while it sent a message and a transfer." },
      { level: 'info', message: "Amy's phone has no location data on 16 Apr 09:10–10:00 and no other activity in that window." },
    ],
  }
}
