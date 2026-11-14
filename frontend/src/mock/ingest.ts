import type { IngestReport, IngestStage } from '../api/types'

export const INGEST_STAGES: IngestStage[] = [
  { id: 'load', label: 'Load', detail: 'Read manifest.json and 36 JSONL files across 4 devices', status: 'pending' },
  { id: 'validate', label: 'Validate', detail: 'Check every row against the Case Bundle v1 schema', status: 'pending' },
  { id: 'normalise', label: 'Normalise', detail: 'Phone numbers to E.164, timestamps to ISO 8601 with offset, geofence places', status: 'pending' },
  { id: 'resolve', label: 'Resolve entities', detail: 'Map phone numbers, emails and social handles to people', status: 'pending' },
  { id: 'store', label: 'Store', detail: 'Write 9 tables to SQLite with device_owner on every row', status: 'pending' },
  { id: 'index', label: 'Index', detail: 'Build per-pair contact and 10-minute location indexes', status: 'pending' },
]

const coverage = { coverage_start: '2026-04-13T00:00:00-04:00', coverage_end: '2026-04-19T23:50:00-04:00' }

export const INGEST_REPORT: IngestReport = {
  bundle_name: 'harbor-supply-case.zip',
  schema_version: 'case-bundle/1.0',
  files_read: 36,
  rows_checked: 12_874,
  errors: 0,
  devices: [
    { device_id: 'paul-iphone', owner: 'paul', model: 'iPhone 15', extraction_tool: 'synthetic-generator 0.1', extracted_at: '2026-04-21T09:14:00-04:00', ...coverage,
      counts: { contacts: 142, messages: 912, calls: 64, locations: 992, transactions: 14, device_events: 3, social_accounts: 2, social_interactions: 41 } },
    { device_id: 'amy-pixel', owner: 'amy', model: 'Pixel 8', extraction_tool: 'synthetic-generator 0.1', extracted_at: '2026-04-21T10:02:00-04:00', ...coverage,
      counts: { contacts: 203, messages: 801, calls: 51, locations: 1008, transactions: 9, device_events: 1, social_accounts: 1, social_interactions: 67 } },
    { device_id: 'ken-galaxy', owner: 'ken', model: 'Galaxy S24', extraction_tool: 'synthetic-generator 0.1', extracted_at: '2026-04-21T11:30:00-04:00', ...coverage,
      counts: { contacts: 88, messages: 655, calls: 47, locations: 944, transactions: 11, device_events: 7, social_accounts: 1, social_interactions: 22 } },
    { device_id: 'cara-iphone', owner: 'cara', model: 'iPhone 14', extraction_tool: 'synthetic-generator 0.1', extracted_at: '2026-04-21T13:45:00-04:00', ...coverage,
      counts: { contacts: 117, messages: 702, calls: 39, locations: 991, transactions: 17, device_events: 3, social_accounts: 2, social_interactions: 35 } },
  ],
  warnings: [
    { level: 'info', message: 'Normalised 3,070 message timestamps to ISO 8601 with offset -04:00.' },
    { level: 'info', message: 'Resolved 6 social handles to 4 people using the accounts logged in on each device.' },
    { level: 'warn', message: "1 identifier is not a person: +1 555 010 0900 (saved as \"Harbor Supply Finance\" on Paul's phone). Kept as an organisation." },
    { level: 'warn', message: "Ken's phone has no location data from 15 Apr 23:10 to 16 Apr 07:00, matching a power_off event." },
    { level: 'warn', message: "Paul's, Ken's and Cara's phones have location gaps on 17 Apr between 10:25 and 14:00, matching power_off events." },
  ],
}
