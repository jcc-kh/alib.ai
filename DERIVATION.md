# How Alib.ai derives what it says

This document is for engineers building or reviewing Alib.ai. It traces every statement the product makes back to its source. For each kind of finding, it covers which rows are read, what is computed, which rule turns a computation into a verdict, what the model is and isn't allowed to do, and how a reviewer can reproduce the result by hand.

For the system overview, see [ARCHITECTURE.md](ARCHITECTURE.md). For the input format, see [schema/case-bundle-v1/README.md](schema/case-bundle-v1/README.md).

---

## 1. The lineage of a statement

Every sentence in a report, briefing or Ask answer has this lineage:

```
 source file line ──► ingested row ──► check input ──► check output ──► verdict ──► statement ──► validator ──► UI
 (bundle, file,       (global id,      (rows read     (numbers +       (rule over   (one sentence  (code rules,   (Evidence · How we know
  line, raw JSON)      provenance)      by a check)    evidence_ids)    output)      by the model)  pass or drop)    · Verify · Sources)
        ▲                                                                                                              │
        └────────────────────────── a reviewer can walk this chain backwards from any finding ──────────────────────────┘
```

Each arrow is something an engineer can inspect:

| Link | Stored where | Shown in UI |
|---|---|---|
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
| Split a brief into items, resolve names and dates | model | Natural language |
| Choose which subagent and check answer an item | model | Routing judgement. It is logged so it can be reviewed. |
| Run a check | **code** | No model touches data |
| Compute any number | **code** | The model is forbidden from arithmetic |
| Apply a verdict rule | **code** | Thresholds are named parameters |
| Phrase one sentence from check output | model | Readability |
| Validate the sentence | **code** | Rejects anything uncited, unnumbered, or worded as an accusation |
| Rank briefing items | **code** | Fixed rule, see §6 |

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

### 3.6 `get_coverage()`: cannot tell

Returns the first and last row per phone. If a brief item or question names a period outside every phone's coverage, the verdict is **cannot tell**, and those boundary rows are cited. The model must use this verdict instead of guessing.

### 3.7 `contact_graph(people?)`: relations view

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

## 6. The proactive briefing

Briefings are generated **at ingest time**, before anyone writes a brief:

1. `run_sweep()` runs every check over every pair for the full coverage period.
2. Each result becomes a finding with section `unprompted` and the same derivation as above.
3. **Ranking is code.** Results are sorted by:
   1. number of phones involved (descending)
   2. whether the result contradicts a statement in the case summary (e.g. "barely know each other")
   3. proximity to a key event named in the case summary

   The reason for each rank is stored in `rank_reason` and shown on the card.
4. The model writes only the `headline` and `why_it_matters` text. Both are subject to the same wording rules. Neither may contain numbers that aren't in the finding.
5. **Checked and dismissed** lists every candidate that a rule rejected, with the threshold that rejected it. This is how decoys stay visible without being flagged.
6. The **week timeline** is drawn purely from finding evidence: each marker is a row id, and clicking it opens that finding.

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
- `Briefing`: `{ items[{ finding, headline, why_it_matters, rank_reason, follow_ups }], timeline[], dismissed[] }`
- `Answer`: `{ text, verdict, findings[], steps[], suggestions[] }`

`backend/schemas.py` must mirror these exactly.

---

## 9. Engineering checklist when adding a new check

1. Make it a pure function over the case store, with thresholds as named keyword arguments.
2. Return `evidence_ids` containing only rows the computation used.
3. Return every number a sentence could need, preformatted where the format matters (e.g. `gap_label`).
4. Write the verdict rule as code, and add it to §3 of this file.
5. Add a `verify.ts` case that recomputes the key numbers from raw rows.
6. Add an evidence view keyed by `check_output.kind`.
7. Add a unit test against the answer key, covering both the planted scenario and the decoys.
