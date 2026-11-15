import type { IngestReport, IngestStage } from '../api/types'
import { countsFor } from './background'
import { PEOPLE, RAVI_END } from './data'

export const INGEST_STAGES: IngestStage[] = [
  { id: 'load', label: 'Load', detail: 'Read manifest.json and 45 JSONL files across 5 devices', status: 'pending' },
  { id: 'validate', label: 'Validate', detail: 'Check every row against the Case Bundle v1 schema', status: 'pending' },
  { id: 'normalise', label: 'Normalise', detail: 'Phone numbers to E.164, timestamps to ISO 8601 with offset, geofence places', status: 'pending' },
  { id: 'resolve', label: 'Resolve entities', detail: 'Map phone numbers, emails and social handles to people', status: 'pending' },
  { id: 'store', label: 'Store', detail: 'Write 9 tables to SQLite with device_owner on every row', status: 'pending' },
  { id: 'index', label: 'Index', detail: 'Build per-pair contact and 10-minute location indexes', status: 'pending' },
]

export const MODELS: Record<string, string> = { ravi: 'iPhone 13', paul: 'iPhone 15', amy: 'Pixel 8', ken: 'Galaxy S24', cara: 'iPhone 14' }
export const EXTRACTED: Record<string, string> = {
  ravi: '2026-04-17T15:20:00-04:00',
  paul: '2026-04-21T09:14:00-04:00',
  amy: '2026-04-21T10:02:00-04:00',
  ken: '2026-04-21T11:30:00-04:00',
  cara: '2026-04-21T13:45:00-04:00',
}

/** Ingest report with every count computed from the generated rows. */
export function buildIngestReport(): IngestReport {
  const devices = PEOPLE.map((p) => ({
    device_id: p.device_id,
    owner: p.person_id,
    model: MODELS[p.person_id],
    extracted_at: EXTRACTED[p.person_id],
    extraction_tool: 'synthetic-generator 0.2',
    coverage_start: '2026-04-13T00:00:00-04:00',
    coverage_end: p.is_victim ? RAVI_END : '2026-04-19T23:50:00-04:00',
    counts: { ...countsFor(p.person_id) } as Record<string, number>,
  }))
  const total = devices.reduce((n, d) => n + Object.values(d.counts).reduce((a, b) => a + b, 0), 0)
  return {
    bundle_name: 'pier9-case.zip',
    schema_version: 'case-bundle/1.0',
    files_read: 45,
    rows_checked: total,
    errors: 0,
    devices,
    warnings: [
      { level: 'info', message: "Ravi's phone was recovered at the scene; its data ends at 01:52 on 17 April, when the battery ran out." },
      { level: 'info', message: 'Resolved 5 Snapline handles to 5 people using the accounts logged in on each device.' },
    ],
  }
}
