# Cellebrite CTF 2024

We have read the case document. None of the phone copies has been opened.

## The case
From Cellebrite's own case document (`CellebriteCTF2024.pdf`, which we downloaded and read):

- The story continues 2023. Abe took the blame for the crimes that Russell, Sharon, Felix and Abe committed.
- Russell got Sharon a job at "Howie Dewitt, LLC", a marketing firm. Customers submit requests through a Google Drive form that Russell provides, and Sharon fulfils them. Russell is a senior marketing manager.
- Russell introduces **Otto** to Sharon at the Techno Security conference. They start a relationship and go on a Disney cruise through several countries.
- **Otto goes missing on 20 July**, during the cruise. Sharon and Russell discuss what happened by chat.
- **Sharon gets Otto's phone back on 30 July and uses ChatGPT to pretend to be him.**
- In August, Sharon, "Otto" and Russell go to Salt Lake City, where arrests are made.
- Felix was arrested in France on 11 September for possessing and sharing US government documents.

This is a strong fit for Alib.ai: one person's phone is used by someone else after a known date, so the phone's messages stop matching its owner.

## Files
Google Drive zips, one per suspect. Zip password: `V@nD0wnByTh3R1veR`

| File | MD5 (as printed in the case document) |
|---|---|
| `CellebriteCTF24_Otto_.zip` | 54E581D2209A62EB431-B06CEFD786B1A |
| `CellebriteCTF24_Felix.zip` | 986FB9022E9AF1BF1431-26BE4E65AAAF |
| `CellebriteCTF24_Russell.zip` | E182FC05A9B83FCACC-9582DB92CEF6C8 |
| `CellebriteCTF24_Sharon.zip` | 514BF12C5862B20937F9-F808932B1368 |
| `2024_CTF_CLBE.zip` (Cellebrite Physical Analyzer format, not needed) | 550E8D311DD958D43A4DF0F088266E4 |

Links on the CFReDS listing:
- https://drive.google.com/file/d/1lONcY9BZ6srfvrQX6uGe-AXdK-6K0nLz/view (a suspect zip)
- https://drive.google.com/file/d/1hY8tk69mcz_VsXiUm0MxmOlf3edLMYX0/view (a suspect zip; listed twice)
- https://drive.google.com/file/d/1PrGE-Z6jZTZzPPzAdQoQI3SHDE3fM0ku/view (a suspect zip)
- https://drive.google.com/file/d/196nip4tvvepUFaF6uDibWkGSBz_ckWtX/view (`2024_CTF_CLBE.zip`)
- https://drive.google.com/file/d/1-6GzizR8X9kvGTBQUXOTl75n63_3vuF-/view (`CellebriteCTF2024.pdf`, the case document, 3.9 MB)

**The listing has only three distinct suspect links for four suspects**, because one link is repeated. The fourth zip's link is missing from CFReDS. We don't know which suspect each link is.

Google Drive refused every suspect zip when we tried (13:32 on 14 Nov), after allowing two of them briefly a few minutes earlier. Use a signed-in browser.

## Answer key
The CFReDS listing says the backstory, questions and solutions are at https://cellebrite.com/the-101/resources/notebook/. We haven't confirmed that, and we found no written walkthrough.

## Data shape
Not verified, because we have not opened these files. Each file should be a zip of one phone's full file system: Android and iPhone. Expect the standard layout in [schemas/README.md](schemas/README.md): one SQLite database per app, with the texts, calls, contacts and chat apps at the paths listed there. The [MSAB 2026 listings](msab-2026.md) show what a real iPhone and a real Android copy look like in practice.

## Fit for Alib.ai
- **Good:** the same people as 2023, so the two years together give a graph that spans two cases. The plot itself is an identity inconsistency: Sharon operates Otto's phone from 30 July.
- **Weak:** answer key unconfirmed; hard to download; contents unverified.
