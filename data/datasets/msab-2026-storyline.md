# MSAB 2026: the storyline, with evidence and decisions

Reconstructed by us from the two phones. MSAB publishes questions and answers but no storyline, so this is our reading of the data, not an official account. All people and data are fictional.

- **Every time is UTC.** The phones are in US Eastern time (UTC−5).
- **Evidence ids** are `<phone>:<source>:<row id>`. `B` is Blaise's iPhone, `E` is Emily's Samsung. Regenerate the event lists with `scripts/msab_events_iphone.py` and `scripts/msab_events_samsung.py`. Notes in Emily's secure folder are cited as `E:securenotes:<title>` (table `sdoc` in `user/150/com.samsung.android.app.notes/databases/sdoc.db`).
- Each chapter separates **Evidence** (what the rows say) from **Decision** (what we conclude, and how sure we are).

## Summary

Emily Min owns a bakery, Chromatic Confections. Blaise Suttoni is her employee and writes the recipes. On 1 December Blaise sends Emily his Rainbow Funnel Cake recipe. Within three days an Instagram account called `galactic.gateaux` is selling a near-identical "nebula funnel cake". Emily concludes Blaise leaked it. She orders from the account under a false name, looks up Blaise's home address, and researches a flammable banana flavouring in her phone's secure folder, then pushes Blaise to make banana-flavoured products. Blaise's phone shows password-locked notes titled "Transactions" and "Prospective Buyers", image-sharing through an anonymous site, and a burst of calls on 19 December.

**The data does not show who runs `galactic.gateaux`, and it does not show what Emily's plan is.**

## The people and their accounts

| Person | Identifier | Evidence |
|---|---|---|
| Blaise Suttoni | Phone +1 571 591 4099 | `B:sms` owner number; `E:contact:4` |
| | Email `bsuttoni.now@icloud.com` | `B:mail:1` |
| | Instagram `blaze1candy` (id 78563694174) | `B:mail:54`; Emily's `direct.db` thread info |
| | Snapchat `blaisesutto.`, Discord `blaisesuttoni` | `E:gmessages:34`; `B:mail:29` |
| | Home address "985 Elm Street, New Haven, Connecticut" | `E:contact:4` (as saved by Emily) |
| Emily Min | Phone +1 571 530 8144 | `E:gmessages` sender; `B:sms:1` |
| | Email `emmin.online@gmail.com` | `B:mail:33`; Android accounts table |
| | Instagram `emily_min96` (id 78099131962) | Emily's `direct.db` thread info |
| | **Second Instagram `easy_e_money96` (id 78684999560)** | Emily's `direct.db`, logged in on her phone |
| | A third Instagram login (id 78507234311), username unknown | Android accounts table |
| | Discord `emmin.online96`, X `emily_min74469` | `B:call:1`; Android accounts table |
| `galactic.gateaux` | Instagram "Galactic Gateux" (id 78655236632) | Emily's `direct.db` thread info |
| Dorian Fletcher | Wire contact of Blaise | `B:call:7`, `B:call:8` |
| "Pete" | Snapchat contact of Blaise | Snapchat `arroyo.db` |
| "CC Legal & Payroll Team" | (844) 387-6962 | `E:contact:5`. Both phones call it |
| "Layla, Glassdoor hiring team" | +1 321 417 8328 | `B:sms:20` |

## Chapter 1: Setting up (3 to 24 November)

**Evidence**
- Emily's phone is activated on 3 November; Blaise's on 10 November (`E:gmessages:8`, `B:mail:1`).
- 17 Nov 01:01 to 01:19, Emily searches in Edge: "best tips for running a bakery", **"how to protect employee secrecy"**, **"is having a secret employee legal in the us"** (`E:edge-search:1`, `5`, `7`).
- 18 Nov, **Find My is disabled on Blaise's iPhone**, and his Apple account signs in on a MacBook Pro (`B:mail:13`, `B:mail:14`).
- 20 Nov, a sound is played on Blaise's iPhone through Find My eight times in 40 minutes, after an iCloud web sign-in (`B:mail:16` to `24`).

**Decision**
- Emily treats Blaise's role as something to keep quiet. *Confidence: medium.* The searches say so, but nothing explains why.
- The MacBook is Blaise's. *Confidence: high.* No copy of it is in the dataset, so anything done there is invisible to us.

## Chapter 2: A warm start (24 to 29 November)

**Evidence**
- 24 Nov 20:48 and 20:50, Emily texts Blaise: is he coming to work tomorrow, he is "my best employee", payroll details are coming by email (`E:gmessages:27`, `28`; the same texts are `B:sms:1`, `2`).
- 24 Nov 20:56, Emily calls "CC Legal & Payroll Team" for 126 seconds (`E:call:9`).
- 25 Nov 01:35, Blaise replies warmly: "I love Chromatic Confections" (`B:sms:3`; `E:gmessages:29`).
- 29 Nov 19:34, Blaise tells Snapchat's AI chatbot: "That is the company I work for! My boss is Emily Min. I love it!" (Snapchat `arroyo.db`, conversation `5bf73fc8`).
- 29 Nov, Blaise creates Snapchat, Discord and Facebook accounts (`B:sms:6` to `12`). Facebook suspends his account the same day (`B:mail:32`).

**Decision**
- Employer and employee on good terms. *Confidence: high.* Both phones agree.

## Chapter 3: The recipe handover (1 December)

**Evidence**
- 17:58 and 18:09, Blaise creates two **password-locked notes: "Transactions" and "Prospective Buyers"** (`B:note:13`, `14`). We can't read them.
- 18:02, Blaise opens `online-clipboard.online/send-image-online` in Safari (`B:safari:3`, `4`).
- 19:16 and 19:19, Blaise writes the notes "Rainbow Funnel" and "Rainbow Funnel Cake", with the ingredient list (`B:note:17`, `19`).
- 19:26, Emily emails Blaise's pay stub: 30 hours at $25 an hour, $750 (`B:mail:33`).
- 19:45 and 19:48, both register for Signal (`E:gmessages:42`, `B:sms:16`).
- 19:55 to 19:56, on Signal, Blaise sends Emily the Rainbow Funnel Cake recipe and a mock-up image (`E:signal:6` to `9`).
- 19:56, Emily on Instagram: "You always have some new secret app to be communicating on smh". 20:00, Blaise: "Security is important! We don't want Chromatic Confections' IP getting leaked……." (`E:instagram:203`, `204`).
- 20:04, Emily on Signal: "Thanks for finally sending the recipe, now I can get around to making it for the bakery" (`E:signal:10`).
- 19:40, Emily texts: "add me on Pinterest so I can send you ideas to reverse engineer there" (`E:gmessages:40`; `B:sms:15`).

**Decision**
- The recipe is Blaise's work, and he gave it to Emily over Signal at his own suggestion. *Confidence: high.* His notes predate the handover by 40 minutes, and Emily's own message confirms receipt.
- **Blaise had notes about buyers and transactions, and used an anonymous image-sharing site, about 90 minutes before the handover.** *Confidence in the facts: high. In what they mean: low.* The notes are locked.
- Emily asks Blaise to copy other bakers' ideas. *Confidence: high.* She says "reverse engineer", and repeats it on 3 Dec (`B:mail:38`).

## Chapter 4: The argument over credit (3 December)

**Evidence**
- 06:17, Blaise shares an Instagram post with Emily and writes "Your newest creation?…" (`E:instagram:205`, `206`).
- 06:26 to 06:31, Blaise tries a Discord call to `emmin.online96`, calls Emily twice (4 seconds each), then calls (844) 387-6962 twice for about 115 seconds each (`B:call:1` to `5`).
- 06:38, Blaise on Signal: "Creative genius takes time. Please be patient…" (`E:signal:11`).
- 14:26, Emily calls Blaise, 8 seconds (`E:call:10`; `B:call:6`).
- 14:30, Emily on Instagram: "Well i baked it didnt i? Its my brand so gotta protect it 😌" (`E:instagram:207`).
- 14:44, Emily on Signal: "Our customers want the next best thing as soon as possible" (`E:signal:12`).
- 17:06, Blaise on Instagram: "But you would not even know how to bake it if I did not make the recipe!" (`E:instagram:208`).
- 17:47, Blaise on Signal: "And if I didn't exist, then what would happen? No recipes at all." (`E:signal:13`).
- 17:53, Blaise registers for Wire, an encrypted messenger (`B:mail:40`).

**Decision**
- Emily presented the funnel cake as her own creation, and Blaise objected. *Confidence: medium-high.* The messages fit, but we haven't seen the shared post itself.
- Blaise is upset enough to call the payroll and legal line at 1:30 am local time. *Confidence in the calls: high. In the reason: low.*

## Chapter 5: The copycat (4 December)

**Evidence**
- 13:18 to 13:23, Blaise and **Dorian Fletcher** exchange Wire calls; one connects for 41 seconds (`B:call:7`, `8`).
- 14:28 to 14:40, on Instagram, **Emily's second account `easy_e_money96` messages `galactic.gateaux`**: "The nebula funnel cake looks great and super original. Could i place an order for one?" The seller asks for details. Emily gives the **name "Minnie E"**, an address in Cincinnati, her real email, and says she will pay by cheque (`E:instagram:162` to `166`).
- 14:34, Emily's note "Chromatic being copied?": "This account, galactic something or other, made a funnel cake nearly exactly the same as mine! A day after! Did they know I made it?" (`E:notesapp:note_120425_093421`).
- 17:38, in the secure folder, Emily edits the note "CC status 1": "Blaise is so lucky I was willing to hire him for his ideas… he's not much of a Baker… I'll keep him around as long as he's useful" (`E:securenotes:CC status 1`, created 26 Nov).
- 17:39, secure-folder note **"He stole it!"**: "The rainbow funnel cake and the nebula cake are exactly the same thing. It's him. It's gotta be! Does he think I don't pay him enough?" (`E:securenotes:He stole it!`).
- 17:45, note "Other folder": "Important notes there", plus a line in ROT13 that decodes to "password is my 6 digit birthday" (`E:notesapp:note_120425_124526`).

**Decision**
- Emily went undercover to investigate the copycat. *Confidence: high.* A second account, a false name, and her own note explaining why.
- Emily is convinced Blaise leaked the recipe. *Confidence: high*, in her own words.
- **Whether Blaise did leak it: cannot tell.** No evidence on either phone links Blaise to `galactic.gateaux`. Its account id appears nowhere on his iPhone. The only trace is Instagram suggesting the account to him on 13, 15 and 18 Dec (`B:mail:55`, `57`, `61`), which proves nothing. The leak could have gone through the MacBook, through Dorian, or not through Blaise at all.
- Emily writes that the cake "tastes exactly the same" three hours after asking to order one by mailed cheque. *This is an inconsistency in her own account.* She may have tasted it some other way, or she is assuming.

## Chapter 6: Emily's response (4 to 5 December)

**Evidence**
- 4 Dec 18:52 to 18:55, Edge: "connecticut voter registration", "new haven connecticut white pages" (`E:edge-search:8`, `12`). Blaise's saved address is in New Haven (`E:contact:4`).
- 19:26 to 19:39, **Brave, inside the secure folder**: "banana oil flash point", "isoamyl acetate", **"is isoamyl acetate dangerous"**, "isoamyl acetate msds", "food chemical suppliers", "isoamyl acetate suppliers", then a supplier's product page (`E:brave-SECUREFOLDER-search:1`, `7`, `9`, `11`, `14`; `E:brave-SECUREFOLDER:18`).
- 19:43, Emily on Signal: "You're absolutely right. I do need your help… I really want to make some banana flavored creations- I really want the customers to get a strong banana taste. Can you make something to ensure they get that?" (`E:signal:14`).
- 19:52 to 19:53, Emily on Pinterest: banana bread brownies, "to really get that banana FLAVOR across" (`B:mail:44`, `45`).
- 20:06 to 20:10, Edge: "intellectual property lawyers", **"how yo fire an employee for giving away secrets"** (`E:edge-search:14`, `17`).
- 20:38, two secure-folder notes titled "SDB-7341-IE-EN" are created, with no text (`E:securenotes`). The title looks like a safety data sheet number.
- 5 Dec 16:41 and 16:42, Emily texts Blaise twice about banana flavour: "Please work on this now" (`B:sms:21`, `22`).

**Decision**
- Emily looked up where Blaise lives. *Confidence: medium-high.* The searches match the city of his saved address; they don't name him.
- Emily hid the chemical research. *Confidence: high.* It is the only browsing in the secure folder.
- Emily's sudden friendliness on Signal follows her decision that Blaise is the thief. *Confidence: high*, from the order of events: "He stole it!" at 17:39, the conciliatory message at 19:43, "how to fire an employee" at 20:10.
- **What the banana plan is: cannot tell.** Two readings fit:
  - **A trap to prove the leak.** She gives Blaise a distinctive assignment and watches whether the copycat account releases the same thing. This fits the lawyer and firing searches.
  - **Something involving the chemical's hazards.** She searched its flash point and whether it is dangerous. The answer key says her "SECRET plan" has an important temperature of 77°F. We did not find the plan's text in the databases we extracted.

  The evidence doesn't choose between them, and Alib.ai must not.

## Chapter 7: The missing text (5 December)

**Evidence**
- Blaise's phone has two texts from Emily on 5 Dec: 16:41:06 and 16:42:10 (`B:sms:21`, `22`).
- Emily's phone has only the first (`E:gmessages:55`, sent 16:41:04).
- In Emily's Google Messages database, **message id 56 does not exist**. The ids run 1 to 55, then 57 to 59, and the id counter stands at 59. One message part is missing as well (41 allocated, 40 present).

**Decision**
- **A message was removed from Emily's phone, and it is very likely the 16:42 banana text.** *Confidence: medium-high.* The gap sits exactly where the missing text belongs, and it is the only gap in the table. We can't recover the row's content from her phone, so the match rests on position and on Blaise's copy.
- This is the clearest finding for Alib.ai's `missing_messages` check on real data.

## Chapter 8: Blaise's side activity (11 to 20 December)

**Evidence**
- 11 Dec 20:18 to 20:25, Safari: eBay shoe sales, sneaker conventions near New Haven, directions from 216 Crown St, New Haven (`B:safari:33`, `37`, `43`).
- 11 Dec 20:40 to 21:24: "photorec" (a file-recovery tool), a Canva design, and three QR-code generators (`B:safari:55`, `61` to `64`, `73` to `81`).
- 11 Dec 21:30, note **"Super Secret Recipe"**, containing an image (`B:note:25`).
- 11 Dec 21:11 to 22:18, ice fishing and winter camping near New Haven; note "Gear" (`B:safari:67` to `113`, `B:note:23`).
- 17 Dec 07:20, Blaise to "Pete" on Snapchat: "Hey Pete! What's up? 🙂🍬". Pete had written "Hi this pete" on 4 Dec (Snapchat `arroyo.db`, conversation `830d3335`).
- 17 Dec 20:55, locked note "Diary" (`B:note:38`).
- 19 Dec 18:56, 20:36 and 22:33, Blaise uses `online-clipboard.online` to send an image, then a file (`B:safari:143`, `147`, `149`).
- **19 Dec 23:04 to 23:34, Blaise places 20 outgoing calls to 16 different numbers in 30 minutes**, including (844) 387-6962 twice. Most last under two minutes (`B:call:9` to `28`).
- 19 Dec 23:36 to 23:38, three voice memos of 15 to 19 seconds, labelled "Flour Bakery + Café" (`B:voicememo:1` to `3`).
- 19 Dec 23:42 to 23:47, locked notes "Diary #2", "CANDY AND INSPO" and "New Note" (`B:note:43`, `60`, `89`).
- 19 Dec 23:44, Blaise registers a Proton account; ProtonVPN is installed (`B:mail:65`).

**Decision**
- Blaise is doing something he wants hidden. *Confidence: medium.* Six locked notes, an anonymous file-sharing site, a VPN, an encrypted messenger, and Find My switched off.
- **What it is: cannot tell.** Selling recipes would fit "Prospective Buyers", "Transactions" and "Super Secret Recipe". So would a legitimate side business in sweets ("candy", `blaze1candy`), or reselling sneakers (eBay, conventions, a shoe wish list). The locked notes would settle it, and we can't open them.
- The call burst on 19 Dec is unexplained. None of the numbers is a saved contact, and none appears on Emily's phone except the payroll line.

## Chapter 9: Loose ends

- **4 Dec 19:47, "Layla from the Glassdoor hiring team"** texts Blaise an unsolicited offer: part-time remote work boosting app downloads, $250 to $500 a day, minimum age 22 (`B:sms:20`). *Decision: this reads as a recruitment scam, not as Blaise looking for work.* He never replies.
- **5 Dec, Emily removes autopay** from her phone plan (`E:gmessages:53`). 16 Dec, Blaise turns off autopay on his (`B:mail:60`). Unexplained.
- **22 Dec, Emily's Amazon account has a sign-in from Georgia**, followed by three Instagram login codes in 13 minutes (`E:gmessages:58`, `59`; `E:sms:35`, `36`). Someone may be trying to get into her accounts. *Cannot tell who.*
- **12 to 13 Jan 2026**, Emily creates three secure-folder notes reading "Banana pudding", deletes two, and revisits the chemical supplier's page (`E:securenotes`; `E:brave-SECUREFOLDER:19`). The banana plan is still alive a month later.
- **25 Nov, one text on Blaise's phone is in the "recently deleted" state**: an Instagram login code (`B:sms:4`). Harmless.

## What the two phones agree and disagree on

| Item | Blaise's iPhone | Emily's Samsung | Verdict |
|---|---|---|---|
| Emily's texts of 24 Nov | `B:sms:1`, `2` | `E:gmessages:27`, `28` | Confirmed on both |
| Blaise's reply of 25 Nov | `B:sms:3`, 01:35 | `E:gmessages:29`, sent 01:42, received 26 Nov 18:45 | Confirmed. Emily's phone received it 41 hours late |
| Emily's texts of 1 Dec | `B:sms:13` to `15` | `E:gmessages:38` to `40` | Confirmed, times match to the second |
| Blaise's texts of 2 Dec | `B:sms:17` to `19` | `E:gmessages:45`, `47`, `48` | Confirmed. Received on Emily's phone at 17:25 in one batch |
| Emily's first text of 5 Dec | `B:sms:21` | `E:gmessages:55` | Confirmed |
| **Emily's second text of 5 Dec** | `B:sms:22` | **Absent; id 56 missing** | **Inconsistent** |
| Signal conversation | Encrypted, not opened | `E:signal:6` to `14` | One side only. Cannot compare yet |
| Instagram conversation | Stored as blobs, not decoded | `E:instagram:203` to `208` | One side only. Cannot compare yet |
| Call of 3 Dec 14:26 | `B:call:6`, incoming, 0 s | `E:call:10`, outgoing, 8 s | Confirmed. Durations differ because one counts ringing |
| Blaise's calls to Emily, 3 Dec 06:28 | `B:call:2`, `3` | Not in her call log | **Inconsistent**, or the calls never reached her phone |

**About the timestamps.** Earlier we noted that the same text shows different times on the two phones. That is now explained:
- Emily's phone records when a message **arrived**, and it received several of Blaise's texts in late batches (26 Nov 18:45 and 2 Dec 17:25). Her phone was probably off or out of coverage.
- SMS messages carry a sent time about 7 minutes later on Emily's phone than on Blaise's. RCS messages match to the second.
- Emily's two texts of 24 Nov show as 20:48 on her phone and 01:19 the next day on Blaise's, so his phone received them 4.5 hours late.

A check that compares the two phones must use the sent time and a tolerance of several minutes for SMS, or it will raise false alarms.

## What Alib.ai should and should not say

| Statement | Verdict | Why |
|---|---|---|
| Blaise wrote the Rainbow Funnel Cake recipe and sent it to Emily on 1 Dec | Confirmed | His notes, his Signal messages on her phone, her reply |
| Emily contacted `galactic.gateaux` from a second account under a false name | Confirmed | `E:instagram:162` to `166`, thread info |
| Emily believes Blaise leaked the recipe | Confirmed | Her notes |
| Blaise leaked the recipe | **Cannot tell** | Nothing links him to the account |
| Emily researched a hazardous chemical in her secure folder | Confirmed | Brave history, user 150 |
| Emily intends to harm someone | **Cannot tell** | The searches have an innocent reading |
| A text is missing from Emily's phone | Inconsistent | Id gap at 56, with a copy on Blaise's phone |
| Blaise is selling recipes | **Cannot tell** | The notes that would show it are locked |

## What we could not read

- Blaise's six password-locked notes.
- Blaise's Signal database (encrypted) and Instagram and Snapchat message bodies (stored as blobs; a few Snapchat texts were recoverable).
- The MacBook, which isn't in the dataset.
- Emily's Samsung Notes page files (`.sdocx`), the RAM dump, Gmail message bodies, and her gallery.
- Location history on either phone.
- The text of Emily's "SECRET plan" named in the answer key.

## Open questions for the team

1. Is the id gap enough to call a message "deleted", or should the report say "absent, with a gap in the numbering"?
2. Should we try to open Blaise's Signal database with the keychain file, so the Signal thread can be compared on both phones?
3. The published answers may settle some "cannot tell" items, such as the secret plan. Reading them makes them unusable as a blind test. Decide which questions to hold back before anyone reads the answer pages in full.
