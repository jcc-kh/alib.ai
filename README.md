# Alib.ai

*Alibi + AI = **Alib.ai**: it checks whether everyone's story holds up across their phones.*

**Compare phones from the same case. See what's confirmed, what doesn't add up, and what can't be known, with every claim one click from its evidence.**

> Status: **clickable mock-up.** The UI runs on canned synthetic data with a simulated agent run. The real backend (ingest, checks, LangChain deepagents) is designed in [ARCHITECTURE.md](ARCHITECTURE.md) and plugs in behind the same API. Built for HackPrinceton (Arlequin Track 1, LangChain deepagents, Amazon).

---

## Why

Investigators often hold data from several phones in one case. Reading them by hand takes days, and some facts only show up when you compare phones. One example: a message that is still on Paul's phone but has been deleted from Amy's.

Alib.ai does that comparison. The investigator writes a short **brief** in three parts: what they believe, what confuses them, and what they don't know. An AI agent checks the brief against every phone and returns a report. Every finding cites the exact data rows behind it.

## How it works

```
 Phone data           Ingest              Case store        Checks (code)           Agents (LLM)                 Report
 ───────────          ──────              ──────────        ─────────────           ────────────                 ──────
 Case Bundle  ──►  load → validate  ──►   SQLite     ◄──  missing_messages    ◄──  orchestrator plans to-dos  ──►  Confirmed
 (one folder       → normalise →          one row per      distance_between         and routes each brief          Inconsistent
  per phone)       resolve people         phone, with      money_chains             item to specialist             Answers
                   → store                device_owner     silent_meetings          subagents, then sweeps         Didn't ask about
                                                           synchronised_behaviour   for anything unasked           Next steps
```

**Code finds the facts, and the model routes and phrases them.** Every comparison is a plain Python function that returns the rows it used. The agents decide *which* checks answer *which* question and write one plain sentence per finding. A code validator then rejects any sentence that:
- doesn't cite evidence
- uses a number that didn't come from a check
- says a *person* was somewhere instead of their *phone*

## The demo case (synthetic)

Money is missing from **Harbor Supply Co.**, a fictional company. An audit is announced on 17 April at 10:00. Four people say they barely know each other:

| Person | Role |
|---|---|
| Paul Tan | Bookkeeper at Harbor Supply Co. |
| Amy Lim | Paul's friend |
| Ken Ong | Paul's friend |
| Cara Diaz | Supplier to Harbor Supply Co. |

The investigator's brief is pre-filled:
- **Believe:** Paul and Amy were together on the evening of 14 April. Paul and Cara don't know each other.
- **Confused:** Paul sent Ken $5,000 on 15 April and can't explain why.
- **Don't know:** Where did the missing money end up? Did anyone react to the audit announcement?

All people, companies, places and data are invented.

## The agents

They are built with LangChain **deepagents** (`create_deep_agent`). The orchestrator uses the built-in to-do list and dispatches domain subagents in parallel.

| Agent | Looks at | Calls |
|---|---|---|
| **orchestrator** | The brief | Splits it into items, writes the to-do list, routes items, runs the unprompted sweep |
| **location-analyst** | Location history | `distance_between`, `silent_meetings` |
| **comms-analyst** | Messages and calls | `missing_messages`, `search_messages` |
| **relationship-mapper** | Contacts, calls, messages, social follows and likes, co-location, deleted threads | `contact_graph`, `silent_meetings` |
| **financial-analyst** | Transfers | `money_chains` |
| **device-forensics** | Deletions, power-offs, triggers, data coverage | `synchronised_behaviour`, `get_coverage` |
| **report-writer** | Subagent results | Assembles the report and next steps, then the validator runs |

## The data format

Alib.ai ingests **Case Bundle v1**: one folder per phone, one JSONL file per record type. The record types are contacts, messages, calls, locations, transactions, device events, social accounts and social interactions. People are referenced by phone number, email or handle, and ingest works out who is who.

Any source can be supported by writing an adapter that outputs this format.

- Full spec: [schema/case-bundle-v1/README.md](schema/case-bundle-v1/README.md)
- Example: [schema/case-bundle-v1/example/](schema/case-bundle-v1/example/)

## Report rules

- **Verdicts:**
  - `confirmed`: data on at least two phones agrees.
  - `inconsistent`: the data contradicts the brief.
  - `cannot_tell`: the phones hold nothing that settles it. The agent says so instead of guessing.
- **Every statement cites evidence rows.** Each row shows its id, its source phone and its timestamp.
- **Phones, not people.** A finding reads "Amy's phone was at Northgate Mall", never "Amy was at Northgate Mall".
- **"Inconsistent", never "lied" or "guilty".** The report describes data, and the investigator draws the conclusions.
- **Phone data is assumed genuine.** Spoofing detection is out of scope, and the report says so.

## Trust and transparency

Every finding can be checked by the person reading it. Each one opens with four tabs:

| Tab | What it gives you |
|---|---|
| **Evidence** | The picture: a map, a money chain, a thread diff, a timeline |
| **How we know** | The step-by-step derivation, marking which steps were plain code and which were the language model. It also shows where each number came from, which phones hold each fact, and the validator checks the sentence passed. |
| **Verify** | Your browser recomputes the key numbers from the raw rows, without trusting the check's own output, and shows ✓ or ✗ for each. Here you can also record "I checked this" or "I dispute this". |
| **Sources** | For each row: the bundle hash, file, line number and the original JSON line, so you can open the source file and find it |

Alib.ai also **briefs you before you ask.** As soon as the phones are loaded, it sweeps every pair and presents what stands out, ranked, with a week timeline and a relations graph. It also lists what it checked and dismissed, and why. You can **ask questions at any time.** Every answer cites its rows or says "cannot tell".

Engineers: see [DERIVATION.md](DERIVATION.md) for exactly how each statement is derived.

## Run the mock-up

Prerequisites: Node 20 or newer.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in Chrome on a laptop-size screen.

### Demo click-path
1. **Ingest.** Click **Load the sample case** and watch the six pipeline stages run. Check the per-phone counts and the ingest notes. Then click **Read the briefing**.
2. **Briefing.** This is what Alib.ai found on its own:
   - **Week timeline:** hover a finding to light up its events, or click any marker.
   - **Five ranked patterns**, each with "why it matters" and follow-up questions.
   - **Relations graph:** click an edge to see its rows.
   - **Checked and dismissed:** the decoys, and the rule that rejected each one.
3. **Open a finding** with **Evidence and how we know**. Go through the tabs: Evidence, How we know, Verify (it should show all ✓), and Sources (expand a row to see its raw JSON line).
4. **Ask.** Click a follow-up chip, or **Ask Alib.ai** in the header. Watch the steps stream in, then open the cited evidence. Try `Did Paul meet Cara in March?` to get a **cannot tell** answer.
5. **Investigate.** The brief is pre-filled. Click **Analyse**. The to-do list and the agents' tool calls run for about 17 seconds. The report then appears: the index is on the left and the selected finding, with the same four tabs, is on the right.
6. **Try variations in the brief:**
   - Add `Paul met Cara in March.` and you get **cannot tell**.
   - Delete `Paul and Cara don't know each other.` and the sweep still surfaces the Dock Cafe pattern under **What you didn't ask about**.
   - Open http://localhost:5173/?fail=1#investigate and click Analyse to see the error state and **Retry**.

## Status

| Part | State |
|---|---|
| UI: Ingest, Briefing, Investigate, Ask drawer, finding drawer, all evidence views | ✅ Built (mock data) |
| Transparency: derivation chain, number tracing, validator, corroboration matrix | ✅ Built (mock data) |
| Fact-check: in-browser recomputation from raw rows; row provenance | ✅ Built (works on any rows from `/api/evidence`) |
| API contract (`frontend/src/api/types.ts`) | ✅ Defined |
| Case Bundle v1 format and example | ✅ Defined |
| Synthetic data generator and answer key | ⏳ Next |
| Ingest pipeline, SQLite store, checks and tests | ⏳ Next |
| deepagents orchestrator, subagents, briefing and Ask | ⏳ Next |
| FastAPI with SSE | ⏳ Next |

**Open questions:**
- Does Arlequin accept a fully synthetic case for Track 1?
- Which model will the agents use: Anthropic API or Amazon Bedrock? It is configurable through the `MODEL` env var.

## Repo layout

```
README.md                  you are here
ARCHITECTURE.md            full engineering design
DERIVATION.md              how every statement is derived and traced to source
schema/case-bundle-v1/     ingest format spec + example bundle
frontend/
  src/api/types.ts         the API contract (shared shapes)
  src/api/index.ts         swap point: mock today, FastAPI later
  src/api/mock.ts          mock API (simulated agent run, briefing, Ask)
  src/mock/                synthetic case data, findings with derivations, briefing, Ask
  src/lib/verify.ts        independent recomputation used by the Verify tab
  src/pages/               IngestPage, BriefingPage, InvestigatePage
  src/components/          FindingDetail (4 tabs), drawers, WeekTimeline, RunProgress
  src/components/evidence/ one view per check + relations graph
```

These folders are planned and not yet created: `data/` (the generator), `backend/` (ingest, checks, agents, API) and `backend/tests/`. See [ARCHITECTURE.md](ARCHITECTURE.md).
