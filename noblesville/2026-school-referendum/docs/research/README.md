# Research notes

Working research produced while building the multi-year projection and cap-class support
(GitHub issue #5, August 2026). These are **notes, not specifications** — they record what
was verified, what was only documented, and what could not be determined, so the next
person does not repeat the work.

Where a note says something is unverified, treat it as unverified.

| File | What it is |
|---|---|
| [`deduction-schedule-sourcing.md`](deduction-schedule-sourcing.md) | The primary source behind promoting the 2028–2034 SEA 1 deduction schedules from `estimated` to `confirmed`, including the assessment-date → pay-year shift that makes our table look off by a year until you know about it. Also records why the Cap 2 AV deduction schedule remains `estimated`. |
| [`state-data-sources.md`](state-data-sources.md) | What Indiana publishes and where: the Gateway portal, the DLGF Referendum Impact Calculator (which does **not** cover Hamilton County), and the four statutory county data files. |
| [`dlgf-parcel-file-spike.md`](dlgf-parcel-file-spike.md) | Feasibility spike, verified against real Hamilton County data: the per-parcel cap-class assessed-value split **is** published, in the state's statutory PARCEL file (50 IAC 26-20-4), and can be joined to this tool's live county lookup. Includes measured artifact sizes for shipping the dataset. |
| [`fetch_gateway.py`](fetch_gateway.py) | Working standard-library client that downloads those statutory files. Starting point for a refresh script. |

## Why these matter to the tool as it stands

This tool currently infers a parcel's **dominant** cap class and lets the visitor correct
the split by hand, because Hamilton County's public parcel service — the live ArcGIS feed
the address lookup queries — does not expose the per-class breakdown.

The spike establishes that the breakdown is not unknowable: Indiana's statutory PARCEL file
publishes it, and `STPRCLNO` with non-digits stripped joins the two sources exactly. Turning
that inference into a derivation is real work (annual ~183 MB fixed-width file, a parser
against 50 IAC 26-20-4, a refresh cadence tied to the spring compliance window) and belongs
in its own spec rather than bolted onto this one.

## Caveats worth carrying forward

- `fetch_gateway.py` must POST `button2`, not `button_download1`. The wrong button returns
  **HTTP 200 with a small wrong file** rather than an error — a failure shaped like success.
- The spike verified the **PARCEL** layout byte-for-byte against real records. The ADJMENTS
  circuit-breaker-credit angle is documented but **not** position-verified, and TAXDATA's
  column map was never obtained. The notes mark each accordingly.
- No legal review was done on redistributing the statutory files. The spike found no terms
  of use and notes the same public-record posture as the county GIS feed already in use, but
  that is an observation, not clearance.
