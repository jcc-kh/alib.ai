# Case Bundle v1: the Alib.ai ingest format

Alib.ai ingests any multi-phone case in this format. A forensic export, such as one from a commercial extraction tool, a spreadsheet or the synthetic generator, gets an **adapter** that writes a Case Bundle. After that, everything downstream (the checks, the agents and the UI) works the same way.

A worked example is in [`example/`](example/).

## Layout

A bundle is a folder, or a `.zip` of that folder:

```
<bundle>/
├─ manifest.json
├─ persons.jsonl
└─ devices/
   └─ <device_id>/
      ├─ device.json
      ├─ contacts.jsonl
      ├─ messages.jsonl
      ├─ calls.jsonl
      ├─ locations.jsonl
      ├─ transactions.jsonl
      ├─ device_events.jsonl
      ├─ social_accounts.jsonl
      └─ social_interactions.jsonl
```

- `.jsonl` means one JSON object per line.
- Every per-device file is optional. A file that is missing means "not extracted". That isn't the same as "nothing happened", and the report treats the two differently.
- Per-device files hold **what that phone holds**. When two case phones messaged each other, the message appears in both phones' `messages.jsonl`. Alib.ai relies on comparing those two copies.

## Shared conventions

| Concept | Rule |
|---|---|
| `record_id` | String, unique within its device and file. Global id after ingest: `<device_id>:<type>:<record_id>`. |
| Timestamps | ISO 8601 with an explicit offset, e.g. `2026-04-14T18:32:04-04:00`. Rows without an offset fail validation. |
| Identifier | How people are referenced: `{"kind": "phone" \| "email" \| "handle" \| "account", "value": "...", "platform": "..."?}`. Phone values may be in any format; ingest normalises them to E.164. |
| Person resolution | Rows never contain `person_id`. Ingest maps identifiers to people using `persons.jsonl`, then contacts and social accounts. An identifier that matches no person is kept as `unknown:<value>`. |
| Money | `amount` is a decimal number in major units, and `currency` is ISO 4217. |

## Files

### manifest.json
```json
{
  "schema_version": "case-bundle/1.0",
  "case_id": "harbor-supply-2026-04",
  "title": "Harbor Supply Co. missing funds",
  "timezone": "-04:00",
  "devices": ["paul-iphone", "amy-pixel", "ken-galaxy", "cara-iphone"],
  "places": [{ "name": "Dock Cafe", "kind": "cafe", "lat": 40.9905, "lon": -71.9842, "radius_m": 60 }]
}
```
`places` is optional. When it is present, ingest tags each location row with the nearest named place within `radius_m`.

### persons.jsonl
| Field | Type | Notes |
|---|---|---|
| person_id | string | Short stable id, e.g. `paul` |
| display_name | string | |
| role | string? | Free text |
| identifiers | Identifier[] | Every number, email and handle known to belong to this person |

### devices/&lt;id&gt;/device.json
| Field | Type | Notes |
|---|---|---|
| device_id | string | Must match the folder name |
| owner | Identifier \| person_id | Whose phone it is |
| model | string? | |
| extraction_tool | string | E.g. `synthetic-generator 0.1` |
| extracted_at | timestamp | |
| coverage_start / coverage_end | timestamp | The period the extraction covers. Used for `cannot_tell` answers. |

### contacts.jsonl
`record_id`, `saved_name`, `identifiers: Identifier[]`

### messages.jsonl
| Field | Type | Notes |
|---|---|---|
| record_id | string | |
| thread_id | string | Stable within the device |
| app | string | `SMS`, `WhatsApp`, `iMessage`, `Snapline DM`, … |
| direction | `in` \| `out` | Relative to this device |
| from | Identifier | |
| to | Identifier[] | Several entries for a group message |
| timestamp | timestamp | |
| body | string | |
| attachments | string[]? | File names only in v1 |

### calls.jsonl
`record_id`, `app`, `direction`, `from`, `to`, `start_time`, `duration_s` (int), `status` (`answered` \| `missed` \| `rejected`)

### locations.jsonl
`record_id`, `timestamp`, `lat`, `lon`, `accuracy_m`, `source` (`gps` \| `wifi` \| `cell`)

### transactions.jsonl
`record_id`, `app`, `direction` (`in` \| `out`), `from`, `to` (identifiers or `{"kind":"account","value":"..."}`), `amount`, `currency`, `timestamp`, `memo`

### device_events.jsonl
| Field | Type | Notes |
|---|---|---|
| record_id | string | |
| event_type | enum | `thread_deleted`, `power_off`, `power_on`, `app_uninstalled`, `factory_reset` |
| timestamp | timestamp | |
| detail | object | For `thread_deleted`: `{"counterpart": Identifier, "app": "SMS"}` |

### social_accounts.jsonl
`record_id`, `platform`, `handle`, `display_name`. These are the accounts logged in on this device, which is how ingest links handles to the phone's owner.

### social_interactions.jsonl
`record_id`, `platform`, `actor_handle`, `target_handle`, `kind` (`follow` \| `like` \| `comment` \| `tag` \| `mention`), `timestamp` (may be null for follow lists), `content?`

## Validation

Ingest rejects any row that:
- is missing a required field
- has a timestamp without an offset
- has a duplicate `record_id` within its file
- has a `device_id` that doesn't match its folder
- has an unknown `event_type`

Errors are reported with the file and line number, and ingest stops if any error is found. Warnings don't stop ingest. Examples are unresolved identifiers and gaps in location data.
