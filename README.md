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

## Run the mock-up

Prerequisites: Node 20 or newer.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in Chrome on a laptop-size screen.

### Demo click-path
1. **Ingest data.** Click **Load sample bundle** and watch the six pipeline stages run. Check the per-phone counts and the ingest notes, which include warnings such as power-off gaps. Then click **Open case**.
2. **Case analysis.** The left panel shows the four phones and the pre-filled brief. Click **Analyse**.
3. **Watch the run.** The to-do list ticks off one item at a time, and the subagent lanes show which tool each agent is calling. A run takes about 17 seconds.
4. **Read the report.** It has five parts: Confirmed, Inconsistent with what you believe, Answers to your open questions, What you didn't ask about, and Suggested next steps.
5. **Click each finding.** The right panel switches to the matching evidence view:

   | Finding | View |
   |---|---|
   | Paul's and Amy's phones 23 km apart | Map with both tracks and a per-slot distance bar |
   | Paul's and Cara's phones at Dock Cafe 4 times, with zero contact | Occasions table and map |
   | $5,000 Paul → Ken, then $4,500 Ken → Cara | Money chain |
   | Three phones deleting threads and powering off after the audit notice | Timeline per phone |
   | Texts on Paul's phone that are missing from Amy's | Side-by-side thread with gaps |

6. **Relations graph tab.** Shows who is connected to whom, and on which channel. Click an edge to see its rows.
7. **Try variations:**
   - Add the line `Paul met Cara in March.` and re-run. You get a **cannot tell** finding, because the data only covers 13–19 April.
   - Delete the line `Paul and Cara don't know each other.` and re-run. The Dock Cafe finding moves to **What you didn't ask about**, because the sweep still catches it.
   - Open http://localhost:5173/?fail=1#case and click Analyse to see the error state and **Retry**.

## Status

| Part | State |
|---|---|
| UI: ingest page, case page, all evidence views, relations graph | ✅ Built (mock data) |
| API contract (`frontend/src/api/types.ts`) | ✅ Defined |
| Case Bundle v1 format and example | ✅ Defined |
| Synthetic data generator and answer key | ⏳ Next |
| Ingest pipeline, SQLite store, checks and tests | ⏳ Next |
| deepagents orchestrator and subagents | ⏳ Next |
| FastAPI with SSE | ⏳ Next |

**Open questions:**
- Does Arlequin accept a fully synthetic case for Track 1?
- Which model will the agents use: Anthropic API or Amazon Bedrock? It is configurable through the `MODEL` env var.
- Is a free-form chat box needed for the demo, or does it wait for iteration 2?

## Repo layout

```
README.md                  you are here
ARCHITECTURE.md            full engineering design
schema/case-bundle-v1/     ingest format spec + example bundle
frontend/
  src/api/types.ts         the API contract (shared shapes)
  src/api/index.ts         swap point: mock today, FastAPI later
  src/api/mock.ts          mock API (simulated agent run)
  src/mock/                synthetic case data, scripted report, ingest report
  src/pages/               IngestPage, CasePage
  src/components/          BriefPanel, AgentProgress, ReportPanel, EvidencePanel
  src/components/evidence/ one view per check + relations graph
```

These folders are planned and not yet created: `data/` (the generator), `backend/` (ingest, checks, agents, API) and `backend/tests/`. See [ARCHITECTURE.md](ARCHITECTURE.md).
