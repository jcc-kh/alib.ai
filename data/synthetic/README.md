# Synthetic case: Death at Pier 9

One fixed synthetic case for the demo: five phones that can be added **one at a time**. It tells the same story as the front-end mock (`frontend/src/mock/data.ts`). Everything is fictional.

- `build_pier9.py` builds the case. The seed is fixed, so rerunning gives the same files.
- `pier9/` is the output, committed so nobody has to run the script.

```
pier9/
├─ manifest.json        devices, places, known organisations, suggested add order
├─ persons.jsonl        the five people and their identifiers
├─ statements.jsonl     what each person told investigators (8 statements)
├─ answer_key.json      plants, decoys, tampering and expected verdicts. Never show this to an agent
├─ stages.json          the relation graph after each phone is added
└─ devices/<device>/    one self-contained bundle per phone
```

## How it was built

1. **A true event log** is written first: who messaged, called, paid and met whom, and when.
2. **Each phone's files are derived from it.** A message between two case phones appears on both, unless a plant removes it. The script checks this and fails if a difference has no planted cause.
3. **Plants, decoys and noise** are applied by code and listed in `answer_key.json` with row ids.

## The phones

| Device | Owner | Messages | Calls | Location fixes | Coverage |
|---|---|---|---|---|---|
| `ravi-iphone` | Ravi Mehta, the victim | 96 | 7 | 616 | 13 Apr to 17 Apr 08:00 (seized) |
| `paul-iphone` | Paul Becker, bookkeeper | 77 | 11 | 960 | 13 to 19 Apr |
| `amy-pixel` | Amy Brooks, Ravi's estranged partner | 78 | 7 | 986 | 13 to 19 Apr |
| `cara-iphone` | Cara Novak, supplier | 60 | 7 | 971 | 13 to 19 Apr |
| `ken-galaxy` | Ken Walsh, dismissed 14 Apr | 77 | 4 | 950 | 13 to 19 Apr |

Each phone also has transactions, device events, contacts, social accounts and interactions, emails, notes and web history.

## Adding phones one at a time

`stages.json` gives, for each step, the nodes, the edges by channel, how many events are on one phone only, and which plants and statements can now be checked. Suggested order:

| Step | Add | What appears |
|---|---|---|
| 1 | Ravi | His contacts, as numbers with the names he saved. The Pier 9 text to Paul and the argument with Amy, from his side only |
| 2 | Paul | Paul's whole SMS thread with Ravi is missing from his own phone (36 messages on one phone only). Payments to and from Cara. An unsaved number |
| 3 | Amy | Her texts with Ravi are missing from her phone. Her location is off while she calls him. A text to Paul that arrived 93 minutes late |
| 4 | Cara | The money loop confirmed on both sides. Four meetings with Paul at Dock Cafe. The unsaved number now links two people. One leftover WhatsApp message |
| 5 | Ken | Hostile posts, but his phone was 9 km from the pier. His clock runs 90 seconds fast |

Before a person's phone is added they appear as a number saved under whatever name the other phones use. For example Cara is "Novak Marine - Cara" on Ravi's phone and "C. Novak (supplier)" on Paul's.

## What is planted

| Id | What | Needs |
|---|---|---|
| `LAST` | Ravi's text to Paul: "Pier 9, 9:30 tonight. Come alone." | Ravi |
| `MISSING_PAUL` | Ravi and Paul's SMS thread, deleted from Paul's phone | Ravi, Paul |
| `MISSING_AMY` | Ravi and Amy's texts of 16 Apr, deleted from Amy's phone | Ravi, Amy |
| `GPAUL` | Paul's phone at the Harbor Rd lot at 21:10, then off until 23:38 | Paul |
| `GAMY` | Amy's phone reports no location 21:40 to 22:50 while it calls Ravi twice | Amy |
| `CHAIN` | Paul pays Cara $4,800; Cara sends $4,320 back 4 h 35 min later | Paul |
| `MEET` | Paul's and Cara's phones together at Dock Cafe on four days, with no contact on record | Paul, Cara |
| `SYNC` | After a 09:05 news alert, three phones delete threads within 26 minutes | Paul, Amy, Cara |
| `BURNER` | An unsaved number that both Paul and Cara call | Paul, Cara |
| `LEFTOVER` | Cara's "Done." reached Paul's phone after he deleted their chat, and she then deleted hers | Paul, Cara |
| `HOSTILE` | Ken's posts about Ravi after his dismissal | Ken |
| `LATE` | Amy's 22:05 text reached Paul's phone at 23:38 because it was off. This is not a missing message | Paul, Amy |
| `ALIAS` | Cara's phone is logged in to a second Snapline account | Cara |

**Tampering:** every timestamp Ken's phone stamped itself is 90 seconds fast. Its GPS fixes and server-stamped rows (payments, social) are correct, which is how the offset can be recovered.

**Decoys:** Ken's phone off overnight; Cara's 50-minute location gap with no activity; Amy and Ken at FreshMart once; Paul's $50 "lunch" to Amy; Amy's vague post; two short GPS dropouts a day on every phone; verification-code and marketing texts.

**Deleted on both phones:** Paul and Cara's WhatsApp chat is in the answer key only. No phone holds it, so the correct answer about its content is "cannot tell". The data also never establishes who was at the pier, and the answer key says so.

## Statements

Eight statements, with expected verdicts in the answer key: three confirmed, three inconsistent and two cannot tell. For example Paul says he "went straight home after work on the 16th and stayed in all night", and his phone was at the Harbor Rd lot at 21:10.

## Format

Case Bundle v1 (`schema/case-bundle-v1`), with optional additions modelled on what the real MSAB phones contain. Nothing existing was changed or removed.

| Addition | Why |
|---|---|
| `messages.source_seq` | The phone's own row number. A deleted message leaves a gap |
| `messages.received_timestamp` | When an incoming message arrived. `timestamp` stays the sent time, so the two phones' copies match |
| `messages.state` | `recently_deleted` on one innocent row |
| `emails.jsonl`, `notes.jsonl`, `web_history.jsonl` | New per-phone files. One of Paul's notes is locked and has no body |
| `statements.jsonl`, `manifest.known_orgs`, `manifest.add_order` | Case-level additions |

## Not included

- The group patterns in architecture §12.1 that don't belong to this story: the three-person relay, the recurring three-phone group and spoofed GPS.
- Cell-tower and Wi-Fi location sources. All fixes are GPS, with a few marked Wi-Fi.
- Message text is from a small template bank for background chatter, so it repeats.
