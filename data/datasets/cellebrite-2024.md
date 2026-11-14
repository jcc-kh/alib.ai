# Cellebrite CTF 2024

Nothing in this dataset has been opened by us.

## The case
Continues 2023. Sharon, Felix and Russell return, and Abe took the blame for the 2023 crimes. Sharon and Russell work at a marketing firm. Russell introduces **Otto** to Sharon at a conference and they go on a Disney cruise. Otto goes missing, and his phone comes back on 10 days later. The story then moves to Salt Lake City.

## Files
Google Drive zips, one per suspect (Otto, Felix, Russell, Sharon). Zip password: `V@nD0wnByTh3R1veR`

- https://drive.google.com/file/d/1lONcY9BZ6srfvrQX6uGe-AXdK-6K0nLz/view
- https://drive.google.com/file/d/1hY8tk69mcz_VsXiUm0MxmOlf3edLMYX0/view
- https://drive.google.com/file/d/1PrGE-Z6jZTZzPPzAdQoQI3SHDE3fM0ku/view
- https://drive.google.com/file/d/1-6GzizR8X9kvGTBQUXOTl75n63_3vuF-/view
- https://drive.google.com/file/d/196nip4tvvepUFaF6uDibWkGSBz_ckWtX/view (`2024_CTF_CLBE.zip`: Cellebrite Physical Analyzer format, not needed)

MD5 values are on the CFReDS listing. The same Google Drive limits as 2023 apply.

## Answer key
The CFReDS listing says the backstory, questions and solutions are at https://cellebrite.com/the-101/resources/notebook/. We haven't confirmed that, and we found no written walkthrough.

## Data shape
Not verified, because we have not opened these files. Each file should be a zip of one phone's full file system: Android and iPhone. Expect the standard layout in [schemas/README.md](schemas/README.md): one SQLite database per app, with the texts, calls, contacts and chat apps at the paths listed there. The [MSAB 2026 listings](msab-2026.md) show what a real iPhone and a real Android copy look like in practice.

## Fit for Alib.ai
- **Good:** the same people as 2023, so the two years together give a graph that spans two cases.
- **Weak:** answer key unconfirmed; hard to download; contents unverified.
