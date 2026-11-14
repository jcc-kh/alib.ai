# What data, other than devices, goes into an investigation?

Research note for the "add data" function. It lists the kinds of material a real investigation combines with phone data, what each would add to the case model, and how each should be treated.

**How to read the sourcing.** Claims with a link come from the sources listed at the end. Most web sources on this topic are vendor pages, so treat them as a practitioner's view. Rows marked *general knowledge* come from common forensic practice and were not confirmed by a source in this search.

## The short answer

Yes, interview transcripts belong. So do provider records, financial records, camera footage, other devices, lab results, documents, public records and the investigator's own findings. The important design decision is to keep three kinds of material apart:

| Kind | Examples | How to treat it |
|---|---|---|
| **Recorded** | Phone data, carrier records, bank statements, camera logs | Evidence. Machine-made, at the time, by a system with no stake in the case |
| **Asserted** | Interview transcripts, witness statements, tips | Claims to test against recorded data. Never evidence for a verdict by themselves |
| **Derived** | An analyst's finding, a lab conclusion, a hypothesis | Must link to the material it was derived from |

## Data types

### 1. Records held by third parties

| Data | What it contains | What it adds to the case model | Cautions |
|---|---|---|---|
| **Carrier call detail records (CDRs)** | A provider-generated log of every call, text and data session on its network ([Penlink](https://www.penlink.com/blog/cdr-analysis-101/)) | An independent copy of who contacted whom and when. It can confirm or contradict a phone's own call log, including calls deleted from the phone | Needs legal process to obtain ([Forensic Focus](https://www.forensicfocus.com/articles/three-reasons-why-call-detail-records-analysis-is-not-junk-science/)) |
| **Cell-site records** | Which tower a phone used at a given time | Approximate location that doesn't depend on the phone's own data | Should not be treated as precise GPS ([Forensic Analytics](https://www.forensicanalytics.io/assets/downloads/communications-data-analysis-&-cell-site-analysis-overview_a4_digital.pdf)). In the US, historical location data generally needs a warrant ([Crowell on *Carpenter*](https://www.crowell.com/en/insights/client-alerts/relying-on-seismic-shifts-in-digital-technology-supreme-court-requires-probable-cause-for-historical-cellphone-location-data)) |
| **Tower dumps** | Every device that used one tower in a time window | People present who aren't yet in the case ([Penlink](https://www.penlink.com/blog/cdr-analysis-101/)) | Large, and mostly uninvolved people |
| **Subscriber and account records** | Names, addresses, payment details, logs, IP addresses ([18 U.S.C. § 2703](https://www.law.cornell.edu/uscode/text/18/2703)) | Links a number, handle or account to a person. This is how an unknown number gets a name | Non-content records and content need different legal process |
| **Cloud and platform returns** | Account content and logs from a provider | Messages and files that are no longer on the device; activity on a device that isn't in the case | Content needs a warrant in the US |
| **Financial records** | Bank statements, card transactions, transfers | Money flows, and location from card use. A card transaction can line up with a tower record at the same time and place ([Penlink](https://www.penlink.com/blog/cdr-analysis-101/)) | |
| **CCTV and camera footage** | Video with a time and place | A sighting that anchors the timeline; cell-site data can then be tested against it ([Forensic Analytics](https://www.forensicanalytics.io/assets/downloads/communications-data-analysis-&-cell-site-analysis-overview_a4_digital.pdf)) | Camera clocks are often wrong (*general knowledge*) |
| **Licence-plate reader hits** | Plate image, vehicle image, GPS coordinates, date and time per scan ([OJP](https://www.ojp.gov/index%2ephp/node/1351751)) | Where a vehicle was, and its movement pattern | Places a vehicle, not a person |
| **Access and employer records** | Door-badge logs, shift rosters, payroll | Presence at a workplace; pay and hours. The MSAB case has a pay stub by email | *General knowledge* |
| **Transit card records** | Taps in and out | Movement by public transport | *Not confirmed by a source in this search* |

### 2. Other devices

| Data | What it adds | Source |
|---|---|---|
| **Computers and tablets** | Activity the phone doesn't hold. In the MSAB case the MacBook is the missing piece | *General knowledge* |
| **Vehicles** | Stored trip and connection data | A preprint on vehicle evidence ([preprints.org](https://www.preprints.org/manuscript/202501.1842/v1)) |
| **Wearables** | Steps, heart rate, sleep, GPS. One practitioner blog reports tracker data contradicting an alibi; that anecdote is unverified | [Hawk Eye Forensic](https://hawkeyeforensic.com/?p=4084) (vendor blog) |
| **Smart-home devices** | Timelines, presence, corroboration of statements | [Hawk Eye Forensic](https://hawkeyeforensic.com/?p=4618) (vendor blog) |

Smart-device evidence is rarely enough alone and is cross-checked against CCTV, phone logs or witness statements ([Hawk Eye Forensic](https://hawkeyeforensic.com/?p=3515)).

### 3. What people say

| Data | What it adds | How to treat it |
|---|---|---|
| **Suspect interviews** (recording or transcript) | The person's account: where they were, who they know, what happened | Split into individual claims and test each against recorded data |
| **Witness and victim statements** | Sightings, relationships, times | Same |
| **Tips and intelligence reports** | Leads from informants or the public | Grade the source and the information separately (below) |

**Why interviews matter for this product.** Research on the Strategic Use of Evidence technique found that mismatches between a suspect's statement and the evidence are a useful signal, and that disclosing evidence late and step by step works better than disclosing it early ([Hartwig et al., OJP abstract](https://ojp.gov/ncjrs/virtual-library/abstracts/eliciting-cues-deception-tactical-disclosure-evidence-first-test); [Granhag et al., Portsmouth](https://researchportal.port.ac.uk/en/publications/interviewing-strategically-to-elicit-admissions-from-guilty-suspe/)). Most of that research used mock crimes, so real-world effectiveness is less certain. The UK's PEACE interviewing model has the same step: after the account is given, the interviewer challenges contradictions with the evidence or with other statements and asks the person to explain them ([Schollum, *Bringing PEACE*](https://www.fis-international.com/assets/Uploads/resources/Schollum-PEACE.pdf)).

A tool that lists where each statement agrees or conflicts with the phones is preparing exactly that challenge stage.

### 4. Physical and laboratory forensics (*general knowledge*)

DNA, fingerprints, toxicology, ballistics, scene photographs and post-mortem reports. Each result enters the model as a finding that ties a person or object to a place or item, usually with a time range, not an exact time.

### 5. Documents (*general knowledge*)

Contracts, invoices, receipts, letters, handwritten notes, and files handed over by a party. They add relationships, amounts and dates. Their authorship and date need checking.

### 6. Open sources (*general knowledge*)

Public social-media posts, company registries, property and voter records, news reports. In the MSAB case Emily herself searches voter registration and address listings. Open sources link identities and add context, and anyone can alter or fake them.

### 7. The investigator's own material

| Data | Purpose |
|---|---|
| **Findings and notes** | Conclusions already reached, so they aren't rediscovered |
| **Hypotheses** | Explanations to test |
| **Legal authorisations** | What each warrant or order covers, and for which dates. This defines what data could exist |
| **Links to other cases** | Shared people, numbers or places |

### 8. Reference data (*general knowledge*)

Maps and named places, cell-tower locations, time zones, opening hours, weather, sunrise and sunset. None of it is evidence, but checks need it to interpret evidence.

## How each should be handled

### Grade the source and the information separately
Intelligence practice gives every item two grades:
- **The Admiralty code** rates source reliability A to F and information credibility 1 to 6, independently. F means reliability can't be judged, which is not the same as unreliable ([Wikipedia](https://en.wikipedia.org/wiki/Admiralty_code)).
- **UK policing's 3x5x2 system** grades the source as reliable, untested or not reliable, grades the information on five levels, and adds a handling code for sharing ([College of Policing](https://www.college.police.uk/app/intelligence-management/intelligence-report)).

For Alib.ai, a two-part grade on every added item would let the model weigh a carrier record differently from an anonymous tip.

### Record where everything came from
The CASE ontology is the open standard for exchanging investigation data. It records chain of custody (who handled the data, when and where) and chain of evidence (which tools and processes were applied), so each item traces back to its source ([CASE](https://caseontology.org/ontology/intro.html)). It has classes for the investigation, investigative actions, examiners, subjects, authorisations and provenance records, as well as people, organisations, locations, accounts, calls and cell sites.

It appears to have no classes for interviews, financial transactions or vehicles, based on its class index. So a model that takes those in needs its own types. Tools listed as adopting CASE include Autopsy ([CASE adopters](https://caseontology.org/community/adopters.html)).

### Record what each source covers
A provider return covers certain accounts and dates. A camera covers one doorway. Without that, the model can't tell "nothing happened" from "nothing was collected", which the "cannot tell" verdict depends on.

### Record precision and clock basis
A cell-site record is an area, not a point. Provider records, cameras and phones each keep their own clock. The integrity pass already handles clock offsets between phones; added sources need the same treatment.

### Legal notes (US)
- Electronic records can be authenticated by a qualified person's certificate instead of live testimony, under Federal Rules of Evidence 902(13) and 902(14). That settles authenticity only. Hearsay is a separate question, usually answered through the business-records exception ([Foley](https://www.foley.com/insights/publications/2017/12/new-federal-rules-of-evidence-90213-and-90214/)).
- This is background, not legal advice, and rules differ by country.

## What existing tools take in
Cellebrite's Pathfinder describes itself as combining 30+ digital sources, including mobile and cloud extractions, email, media and cell data, and it imports call detail records from warrant returns ([Cellebrite](https://cellebrite.com/en/pathfinder-x/); [Cellebrite on CDRs](https://cellebrite.com/en/series/tip-tuesday/how-to-use-call-detail-records-cdrs-in-cellebrite-pathfinder/)). These are vendor claims. None of the tools found treats interview statements as claims to be checked against the device data, which is where Alib.ai differs.

## Recommendation for the demo

Support four kinds of addition, one from each treatment class:

| Add | Kind | Why this one |
|---|---|---|
| **Another device** | Recorded | Already the core of the product |
| **A provider record**, as a simple file: a carrier call log or a bank statement | Recorded, independent | It shows corroboration from outside the phones. A carrier log can reveal a call deleted from a handset |
| **An interview transcript** | Asserted | The clearest fit for "alibi". It becomes claims, each marked supported, contradicted or cannot tell |
| **An investigator finding or note** | Derived | It shows the model growing as the case develops |

Each addition should show what changed: new people and links, claims now supported or contradicted, and gaps that have closed.

## Gaps in this research
- Transit-card records and licence-plate data beyond the basics were not confirmed by independent sources.
- Provider-specific return contents (Google, Apple, Meta) and geofence warrants were not found.
- How interview records are admitted and challenged in court was not covered.
- Most device and provider sources were vendor pages.

## Sources
- [Penlink, CDR Analysis 101](https://www.penlink.com/blog/cdr-analysis-101/)
- [CYFOR, Call Data Record Analysis](https://cyfor.co.uk/digital-forensics/call-data-record-analysis/)
- [Forensic Analytics, Communications Data Analysis & Cell Site Analysis Overview](https://www.forensicanalytics.io/assets/downloads/communications-data-analysis-&-cell-site-analysis-overview_a4_digital.pdf)
- [Forensic Focus, Three Reasons Why Call Detail Records Analysis Is Not "Junk Science"](https://www.forensicfocus.com/articles/three-reasons-why-call-detail-records-analysis-is-not-junk-science/)
- [Cornell LII, 18 U.S.C. § 2703](https://www.law.cornell.edu/uscode/text/18/2703)
- [Crowell, Supreme Court requires probable cause for historical cellphone location data](https://www.crowell.com/en/insights/client-alerts/relying-on-seismic-shifts-in-digital-technology-supreme-court-requires-probable-cause-for-historical-cellphone-location-data)
- [OJP, automated licence plate reader paper](https://www.ojp.gov/index%2ephp/node/1351751)
- [Preprints.org, vehicle digital evidence](https://www.preprints.org/manuscript/202501.1842/v1)
- [Hawk Eye Forensic, IoT Forensics: Evidence from Smart Homes & Wearables](https://hawkeyeforensic.com/?p=4084)
- [Hawk Eye Forensic, Digital Evidence from Smart Homes](https://hawkeyeforensic.com/?p=4618)
- [Hawk Eye Forensic, IoT Forensic: Investigating Smart Devices in Criminal Cases](https://hawkeyeforensic.com/?p=3515)
- [OJP, Eliciting Cues to Deception by Tactical Disclosure of Evidence](https://ojp.gov/ncjrs/virtual-library/abstracts/eliciting-cues-deception-tactical-disclosure-evidence-first-test)
- [University of Portsmouth, Interviewing strategically to elicit admissions from guilty suspects](https://researchportal.port.ac.uk/en/publications/interviewing-strategically-to-elicit-admissions-from-guilty-suspe/)
- [Schollum, Bringing PEACE](https://www.fis-international.com/assets/Uploads/resources/Schollum-PEACE.pdf)
- [Wikipedia, Admiralty code](https://en.wikipedia.org/wiki/Admiralty_code)
- [College of Policing, Intelligence report](https://www.college.police.uk/app/intelligence-management/intelligence-report)
- [CASE ontology, introduction](https://caseontology.org/ontology/intro.html)
- [CASE ontology, adopters](https://caseontology.org/community/adopters.html)
- [Foley, New Federal Rules of Evidence 902(13) and 902(14)](https://www.foley.com/insights/publications/2017/12/new-federal-rules-of-evidence-90213-and-90214/)
- [Cellebrite, Pathfinder](https://cellebrite.com/en/pathfinder-x/)
- [Cellebrite, How to use call detail records in Pathfinder](https://cellebrite.com/en/series/tip-tuesday/how-to-use-call-detail-records-cdrs-in-cellebrite-pathfinder/)
