# How Alib.ai derives what it says

This document is for engineers building or reviewing Alib.ai. It traces every statement the product makes back to its source. For each kind of finding, it covers which rows are read, what is computed, which rule turns a computation into a verdict, what the model is and isn't allowed to do, and how a reviewer can reproduce the result by hand.

For the system overview, see [ARCHITECTURE.md](ARCHITECTURE.md). For the input format, see [schema/case-bundle-v1/README.md](schema/case-bundle-v1/README.md).

---

## 1. The lineage of a statement

**Operating rule: agents never compute, and checks never conclude.** Every number comes from a check. Every judgement (merge, dismiss, follow up, wording) comes from an agent, and is logged.

Every sentence in a briefing, report or Ask answer has this lineage:

```
 source file line ─► ingested row ─► check (sweep or targeted) ─► signal ─► incident ─► finding ─► statement ─► validator ─► UI
 (bundle, file,      (global id,      (code: rows in,             (signals   (triage:    (verdict   (one sentence (code rules)  (Evidence · How we know
  line, raw JSON)     provenance)      numbers + ids out)          table)     grouped)    by rule)   by model)                   · Verify · Sources)
       ▲                                                                                                                               │
       └──────────────────────────── a reviewer can walk this chain backwards from any finding ────────────────────────────────────────┘
```

A finding may also carry **follow-up hops**: one subagent's result triggers a targeted check by another. Each hop is a step in `derivation.steps` with `kind: "follow_up"`, naming the subagent that asked, the subagent that ran, and the check call (§6.3).

Each arrow is something an engineer can inspect:

| Link | Stored where | Shown in UI |
|---|---|---|
| Check output → signal | `signals` row: `check, people, start, end, evidence_ids, strength, output_json` | **How we know**, step "Signal" |
| Signals → incident | `incidents.signal_ids`; merge and split decisions logged by triage | **How we know**, step "Grouped with" |
| Source file → row | `EvidenceRow.provenance` (bundle, sha256, file, line, record_id, raw) | **Sources** tab, expand a row |
| Row → check input | The check's SQL is deterministic; its args are logged in `derivation.steps[kind=tool]` | **How we know**, step "Check called" |
| Check input → output | Pure Python, which can be re-run with the same args | **How we know**, steps "Data read" and "Computation" |
| Output → verdict | A named rule with named thresholds | **How we know**, step "Verdict" |
| Output → statement numbers | `derivation.numbers[]` maps each number to a check-output field | **How we know**, "Where each number comes from" |
| Statement → validator | `derivation.validator[]` | **How we know**, "Report validator" |
| Statement ↔ raw rows | Recomputed in the browser by `frontend/src/lib/verify.ts` | **Verify** tab |

### Who does what: code or model

| Step | Actor | Why |
|---|---|---|
| Ingest, normalise, resolve people | code | Must be reproducible |
| Run every check over every pair on case load (sweep) | **code** | Produces `signals` with no model involved |
| Compute signal `strength` | **code** | Per-check rule, §3.0 |
| Propose incident groupings and count agreeing checks and phones | **code** | `propose_incidents()` |
| Find anchor moments (≥3 phones clustered) | **code** | `anchor_moments()` |
| Accept, merge or split proposed incidents | model | Judgement. Logged. |
| Dismiss a signal with an ordinary explanation | model | Judgement. Must cite the rule or the row that explains it. |
| Request a follow-up from another subagent | model | Judgement. The hop is logged as a derivation step. |
| Split a brief into items, resolve names and dates | model | Natural language |
| Match a brief item to existing signals | **code** proposes (`match_brief_item`), model confirms | Reuse beats re-running |
| Label an incident's relevance to the brief | model | Judgement |
| Run a check | **code** | No model touches data |
| Compute any number | **code** | The model is forbidden from arithmetic |
| Apply a verdict rule | **code** | Thresholds are named parameters |
| Phrase one sentence from check output | model | Readability |
| Validate the sentence | **code** | Rejects anything uncited, unnumbered, or worded as an accusation |
| Sort incidents | **code** | `rank_incidents()`: relevance label (if a brief exists) → `n_checks` → `n_phones`. See §6. |

In the UI's derivation chain, code steps are drawn in blue and model steps in amber, so a reviewer can see exactly where judgement entered.

---

## 2. Provenance: from file to row

Ingest assigns every row:
- a global id `<device_owner>:<type>:<n>`, for example `amy:evt:0149`
- a `provenance` record:

```jsonc
{
  "bundle": "harbor-supply-case.zip",
  "bundle_sha256": "9f2c…a2d4",              // hash of the zip as received
  "file": "devices/amy-pixel/device_events.jsonl",
  "line": 37,                                 // 1-based line in that file
  "record_id": "e149",                        // the record_id inside the file
  "extraction_tool": "synthetic-generator 0.1",
  "extracted_at": "2026-04-21T10:02:00-04:00",
  "raw": "{\"record_id\":\"e149\", …}"          // the original line, before normalisation
}
```

**Invariants:**
- `raw` is stored as received.
- Normalisation may change *formats* but never values. Examples of format changes: `(555) 010-0202` becomes `+15550100202`, and timestamps gain a timezone object.
- A row with no provenance cannot be cited, and `/api/evidence` returns 404 for it.

**Tracing by hand:**
1. Check the bundle hash with `shasum -a 256 harbor-supply-case.zip`.
2. Open the file at the given line.
3. Compare it to `raw`.

---

## 3. Each check: input, computation, rule, evidence

### 3.0 From check result to signal

During the sweep, each result a check returns becomes one `signals` row:

```jsonc
{ "signal_id": "sig_0042", "check": "location_gaps", "people": ["ken"],
  "start": "2026-04-15T14:00-04:00", "end": "2026-04-15T16:30-04:00",
  "evidence_ids": ["ken:msg:3311", "ken:txn:0041", "ken:loc:2203", "ken:loc:2219"],
  "strength": 0.9, "output_json": { … the check's full result … } }
```

`strength` is computed in code from a fixed rule per check, and is used only for ordering ties inside an incident:

| Check | Strength rule (0–1) |
|---|---|
| `missing_messages` | 0.6, +0.3 if a `thread_deleted` explains it |
| `distance_between` | 0.8 if label contradicts a co-location claim or exceeds 5 km; else 0.3 |
| `silent_meetings` | min(1, occasions / 4) |
| `money_chains` | 0.5 + 0.5 × ratio |
| `synchronised_behaviour` | min(1, phones / 4) + 0.2 if a trigger candidate exists |
| `location_gaps` | `location_off` 0.9 · `powered_off` 0.4 · `unexplained` 0.2 |
| optional checks | 0.5 by default, documented with the check |

All thresholds are keyword arguments with these defaults. Evidence ids are always the rows the computation actually used. No check cites a row "for context".

### 3.1 `missing_messages(a, b, start, end)`: scenario S1

| | |
|---|---|
| **Reads** | `messages` and `calls` on a's phone and b's phone where {from, to} = {a, b} and the timestamp is in range; `device_events` of type `thread_deleted` on either phone whose counterpart is the other person |
| **Computes** | For each message on one phone, look for a counterpart on the other phone with the same sender, recipient and body and \|Δt\| ≤ `tolerance_s` (2 s). Calls are matched the same way and serve as anchors: if calls match but messages don't, the phones are in sync and the gap is specific. |
| **Output** | `items[]` (with `on_a` and `on_b` ids, or null), `missing_count`, `deletion_events[]`, `tolerance_s` |
| **Rule** | Report if `missing_count > 0`. Attach any `thread_deleted` on the phone that lacks the messages whose timestamp is later than the missing messages. |
| **Evidence** | Every unmatched message, every matched call (both copies), and the deletion event |
| **Verify recomputes** | Unmatched count by body and time; call pairs; deletion timestamp later than every missing message |

### 3.2 `distance_between(a, b, start, end)`: scenario S2

| | |
|---|---|
| **Reads** | `locations` for both phones in range |
| **Computes** | Join slots on identical timestamp (slots are 10-minute aligned at ingest). For each pair: `d = 2R·asin(√(sin²(Δφ/2) + cos φ₁ cos φ₂ sin²(Δλ/2)))`, R = 6,371,000 m. Then min, median and max. |
| **Rule** | `together` if d ≤ 150 m in ≥ 80% of slots; `apart` if min d ≥ 1,000 m; otherwise `mixed`. Against a belief of "together", `apart` gives **inconsistent**, `together` gives **confirmed**, and `mixed` or no shared slots gives **cannot tell**. |
| **Evidence** | Every location row in every compared slot, on both phones |
| **Verify recomputes** | Slot pair count, min, max, label |

### 3.3 `money_chains(start, end)`: scenario S4

| | |
|---|---|
| **Reads** | `transactions` on all phones |
| **Computes** | De-duplicate transfers seen on both phones by (from, to, amount, currency, \|Δt\| ≤ 2 s), keeping both row ids. For each A→B transfer with amount ≥ `min_amount` (500), find B→C with `0 < t₂ − t₁ ≤ window_h` (24 h) and `ratio_min ≤ amount₂ / amount₁ ≤ ratio_max` (0.8 to 1.0). |
| **Output** | `links[]`, `gap_minutes`, `gap_label` (preformatted, e.g. "4 h 35 min"), `ratio` |
| **Rule** | Any match is a chain. A transfer seen on both phones is **confirmed**. |
| **Evidence** | Both copies of each link |
| **Verify recomputes** | Presence on sender and receiver, gap in minutes, ratio |

### 3.4 `silent_meetings(start, end)`: scenario S5

| | |
|---|---|
| **Reads** | `locations` for every pair of phones; `messages` and `calls` on **all** phones |
| **Computes** | Per pair, a slot is "close" if d ≤ `within_m` (100 m). Consecutive close slots form an episode, with duration = (last − first) + 10 min. Keep episodes ≥ `min_minutes` (20). Contact count = messages ∪ calls on any phone where {from, to} = the pair. |
| **Rule** | Flag if episodes ≥ `min_occasions` (2) **and** contact count = 0. Against "X and Y don't know each other", this gives **inconsistent**. |
| **Evidence** | Location rows for every slot of every episode, on both phones |
| **Absence** | A zero count can't be shown by citing rows. The output records the query and the tables searched (`channels_checked`), and Verify shows the query to re-run. |
| **Verify recomputes** | Close-slot count, distinct days, shortest occasion |

### 3.5 `synchronised_behaviour(start, end)`: scenario S7

| | |
|---|---|
| **Reads** | `device_events` of type `thread_deleted`, `power_off` and `power_on` on all phones; inbound `messages` in the 2 h before each candidate window |
| **Computes** | Slide a `window_min` (60) window over deletion and power-off events. Keep windows with ≥ `min_phones` (3) distinct phones. Report the tightest span (first to last event) as `window.minutes`. For trigger candidates, list inbound messages before the window with `minutes_before_window` precomputed. |
| **Rule** | Flag any qualifying window. The **model** may pick a trigger from the candidates, but only one returned by the check, and the minutes come from the output. |
| **Evidence** | Trigger message, every deletion and power-off in the window, and the matching power-on |
| **Verify recomputes** | Phone count, window length, minutes after trigger |

### 3.6 `location_timeline(person, start, end)`: stays, travel, gaps

| | |
|---|---|
| **Reads** | `locations` for one phone, in time order |
| **Computes** | Walk the rows. A **stay** starts when consecutive points remain within `stay_radius_m` (150) of their running centroid for ≥ `min_stay_min` (10). Its place is the nearest named place within its radius, or "unnamed". A **travel** segment joins two stays. A **gap** is any interval between consecutive rows longer than `min_gap_min` (45); it is classified by `location_gaps`. |
| **Output** | Ordered `segments[]`: `{kind, place?, from?, to?, start, end, gap_type?, evidence_ids}` |
| **Stored** | `stays` table, at ingest. `distance_between` and `silent_meetings` read stays instead of raw slots. |
| **Rule** | None. This check describes; it never raises a signal by itself. |
| **Evidence** | The first and last location row of each stay or travel; for a gap, the rows on either side of it |
| **Verify recomputes** | Segment boundaries from raw rows; every gap's length |

### 3.7 `location_gaps(person, start, end)`: G1

| | |
|---|---|
| **Reads** | `stays` gap segments for the phone; `device_events` (power), `messages`, `calls` and `transactions` on **that phone** inside each gap |
| **Computes** | For each gap ≥ 45 min, check in this order: (1) a `power_off` … `power_on` pair covers it → `powered_off`; (2) any outgoing or incoming message, call or transfer falls inside it → `location_off`; (3) otherwise → `unexplained`. |
| **Output** | `{start, end, minutes, gap_type, activity_ids[], bounding_location_ids[2], power_event_ids[]}` |
| **Rule** | Raise `location_off` always. Raise `powered_off` or `unexplained` **only** if the gap overlaps another signal. On the demo case: Ken 15 Apr 14:00–16:30 is `location_off` and raised. Amy 16 Apr 09:10–10:00 is `unexplained` with no overlap, so it is **not** raised. Ken overnight 15→16 Apr is `powered_off` with no overlap, so it is not raised. The S7 power-offs are `powered_off` but overlap S7, so they are raised as part of that incident. |
| **Wording** | Always "no location data from X to Y". Never "turned off location to hide", never a claim about intent. For `location_off`: "…while the phone sent a message at 15:10 and a transfer at 15:40". |
| **Evidence** | The two bounding location rows, every activity row inside the gap, and any power events |
| **Verify recomputes** | Gap minutes from the bounding rows; that each activity row's timestamp is inside the gap; the gap type |

### 3.8 Optional checks

| Check | Reads | Rule | Evidence |
|---|---|---|---|
| `call_log_mismatch(a, b)` | `calls` on both phones | Unmatched within ±2 s → signal | The one-sided call row(s) |
| `shared_unknown_number()` | `messages`, `calls` on all phones | Number contacted by ≥2 people, resolving to no person and no `orgs` row | One row per person contacting it |
| `transfer_after_meeting()` | `transactions`, shared `stays` | Transfer ≥ $500 between a pair within 6 h after a shared stay ends | Transfer rows + stay bounding rows |
| `contact_went_quiet()` | `messages`, `calls` | ≥3 consecutive days with contact, then ≥2 days with none, inside coverage | Last contact rows + coverage rows |

### 3.9 `get_coverage()`: cannot tell

Returns the first and last row per phone. If a brief item or question names a period outside every phone's coverage, the verdict is **cannot tell**, and those boundary rows are cited. The model must use this verdict instead of guessing.

### 3.10 `contact_graph(people?)`: relations view

Edges are built by channel:

| Channel | Source |
|---|---|
| call | `calls` |
| message | `messages` |
| transfer | `transactions` |
| social | `social_interactions` between resolved handles |
| deleted_thread | `thread_deleted` whose counterpart is a case person |
| colocation | `silent_meetings` episodes, including weak (below-threshold) ones, which are drawn faded |

Each edge carries its own evidence ids. The graph is descriptive and produces no verdicts.

---

## 4. From check output to sentence

1. The subagent receives the check output (JSON) and writes **one sentence**.
2. It also returns `numbers[]`. Each entry pairs a number as it appears in the sentence with the output field it was copied from:

   ```jsonc
   { "text": "4 h 35 min", "field": "money_chains.gap_label", "value": "275 min" }
   ```

3. `validate_report()` (code) then checks:

| Rule | Check |
|---|---|
| Cites evidence | `evidence_ids` is non-empty and every id resolves |
| Phones, not people | The regex `\b<Name> (was\|were) (at\|in\|near)\b` does not match |
| Neutral wording | No `lied`, `lying` or `guilty` |
| Numbers traced | Every number token in the sentence appears in `numbers[].text`, and each `field` exists in the check output with an equal value |
| One sentence | Exactly one terminal punctuation mark |

A statement that fails gets one repair round-trip with the failure reason. If it fails again, it is **dropped** and logged.

---

## 5. Fact-checking in the UI (Verify tab)

`frontend/src/lib/verify.ts` recomputes each finding from the **raw rows returned by `/api/evidence`**. It deliberately ignores the check's own output, then compares:

```
claim            report says    recomputed    ✓/✗
Closest distance 23.1 km        23.1 km       ✓
```

- This catches bugs where a check's output and its cited rows disagree.
- It also lets an investigator see for themselves that the number follows from the rows.
- A ✗ means the finding must not be relied on. In the real build, a ✗ also files an automatic issue.

The Verify tab also records the investigator's own review ("I checked this, it holds" or "I dispute this", with a note). In the real build this is stored with the case, so the report shows who checked what.

---

## 6. Triage, the briefing, and brief refinement

### 6.1 Triage (stage ②, on case load, no brief)

1. **Propose (code).** `propose_incidents()` groups signals that share at least one person and overlap in time, padded by ±2 h. Each candidate carries `n_checks` (distinct checks) and `n_phones` (distinct device owners across its evidence).
2. **Review (model, logged).** Agents accept, merge or split candidates. Every merge or split is written to the incident's derivation with a one-line reason.
3. **Dismiss (model, logged).** A signal with an ordinary explanation goes to `dismissals` with `reason` and `rule`. The reason must point at a row or a threshold, for example "memo 'lunch' and $50 < $500 minimum". Dismissals are shown in "Checked and dismissed"; they are never silently dropped.
4. **Anchors (code).** `anchor_moments(window_min=60, min_phones=3)` returns windows where signals from ≥3 phones cluster. On the demo case it returns 17 Apr 10:00–11:10 (S7 deletions and power-offs on 3 phones, plus the audit message as a trigger candidate). No knowledge of the audit is needed: the cluster comes from the data.
5. **Rank (code).** `rank_incidents()` sorts by `n_checks`, then `n_phones`, then maximum `strength`. The top 5 form the briefing. `rank_reason` is generated from those numbers, for example "3 checks agree across 3 phones".
6. **Word (model).** The report-writer writes `headline` and `why_it_matters` for each. Both must pass `validate_report()`, and numbers must come from cited signals.

### 6.2 Brief refinement (stage ③)

1. **Split (model).** Items get people and dates resolved, and these are logged.
2. **Match first (code proposes, model confirms).** `match_brief_item(item)` returns signals and incidents sharing the item's people and overlapping its dates. If they settle the item, they are reused and no new check runs. The derivation shows "matched existing signal sig_…".
3. **Targeted checks for gaps only.** If nothing matches, the routed subagent runs a check with item-specific parameters. If the item's dates fall outside coverage, the result is `cannot_tell`.
4. **Re-rank.** The model labels each incident `high`, `medium` or `low` relevance to the brief, with the brief item quoted. `rank_incidents(relevance=…)` re-sorts in code.
5. **Sections.** Each item's verdict places it in Confirmed or Inconsistent (beliefs) or Answers (questions). Incidents matched to no item go to "What you didn't ask about".

### 6.3 Follow-up chains

A subagent may end a finding with a `follow_up`: `{to: "<subagent>", check: "<name>", params: {...}, reason}`. The orchestrator dispatches it as a new `task` and appends the hop to the finding's derivation:

```
step 4  follow_up   location-analyst → financial-analyst
        "Activity on Ken's phone during the location gap 14:00–16:30?"
        get_events(person='ken', table='transactions', start='…14:00', end='…16:30')  →  ken:txn:0041 ($4,500 → Cara, 15:40),
        which is link 2 of money_chains signal sig_0017 (S4)
step 5  follow_up   orchestrator → comms-analyst
        search_messages(person='ken', start='…14:00', end='…16:30')    →  ken:msg:3311 (15:10)
```

The merged finding cites the evidence of every hop. It must stay one sentence, with every number traced. Chains are capped at 3 hops per finding.

### 6.4 Timeline and dismissed lists

- The **week timeline** and the **location timeline** are drawn purely from `stays` and finding evidence. Each mark is a row id or a segment id, and clicking one opens its finding.
- **Checked and dismissed** lists every dismissal with its reason and rule. This is how decoys stay visible without being flagged.

---

## 7. Ask: questions with cited answers

`POST /api/ask` runs the orchestrator in Q&A mode:

1. **Parse.** The model resolves people and dates, and logs them as steps.
2. **Route.** The model picks a subagent and check, and logs the reason.
3. **Run.** The checks run in code.
4. **Answer.** The model writes 1–3 sentences. The answer is valid only if every claim in it is backed by a returned finding. The findings are attached and open in the same drawer with Evidence, How we know, Verify and Sources.
5. **Cannot tell.** If no check settles the question, the answer is `cannot_tell`, citing coverage. No free-text speculation is allowed.
6. **Stream.** Steps are streamed to the UI as they happen (`event: step`), so the user sees what was done before seeing the answer.

---

## 8. Data shapes

The TypeScript contract is [`frontend/src/api/types.ts`](frontend/src/api/types.ts). The relevant types are:
- `Finding.derivation`: `{ steps, numbers, validator, corroboration }`
- `EvidenceRow.provenance`: see §2
- `Signal`: `{ signal_id, check, people, start, end, evidence_ids, strength, output }`
- `Incident`: `{ incident_id, signal_ids, people, start, end, n_checks, n_phones, rank, headline, anchor_id? }`
- `Anchor`: `{ anchor_id, start, end, phones, signal_ids }`
- `Dismissal`: `{ signal_id, reason, rule }`
- `Segment`: `{ kind: stay|travel|gap, person, place?, from?, to?, start, end, gap_type?, evidence_ids }`
- `Briefing`: `{ anchors[], items[{ incident, finding, headline, why_it_matters, rank_reason, follow_ups }], timeline[], dismissed[] }`
- `DerivationStep.kind` gains `signal`, `grouped` and `follow_up`
- `Answer`: `{ text, verdict, findings[], steps[], suggestions[] }`

`backend/schemas.py` must mirror these exactly.

---

## 9. Engineering checklist when adding a new check

1. Make it a pure function over the case store (and `stays`, for location checks), with thresholds as named keyword arguments. It answers one fixed question and never concludes.
2. Return `evidence_ids` containing only rows the computation used.
3. Return every number a sentence could need, preformatted where the format matters (e.g. `gap_label`).
4. Write the verdict rule as code, and add it to §3 of this file.
5. Add a `verify.ts` case that recomputes the key numbers from raw rows.
6. Add an evidence view keyed by `check_output.kind`.
7. Define how each result becomes a `signals` row, including its `strength` rule (§3.0).
8. Add a unit test against the answer key, covering one planted positive and one decoy in the generator.
