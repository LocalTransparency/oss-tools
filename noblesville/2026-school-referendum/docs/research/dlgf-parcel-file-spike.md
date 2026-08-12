# Spike: Can Indiana Gateway property tax files replace the cap-class inference?

Status: **FEASIBLE** -- verified against real Hamilton County 2025-pay-2026 data.

## 1. Can the files be obtained without a browser?

**Yes.** `https://gateway.ifionline.org/public/download.aspx` is a classic ASP.NET
WebForms page and it works exactly as expected: single `<form name="aspnetForm">`
containing every control on the page (both the "Annual Financial Reports" section
and the "Property Files" section share one form/one postback).

Working flow (stdlib `urllib` only, cookie jar for session affinity):

1. `GET /public/download.aspx` -> parse `__VIEWSTATE`, `__VIEWSTATEGENERATOR`,
   `__EVENTVALIDATION`, and `ctl00_ContentPlaceHolder1_ScriptManager1_TSM` out of
   the hidden inputs (simple regex, no JS execution needed -- the selects are
   plain `<select>` elements, `rendermode="Lightweight"`, not RadComboBox client
   widgets, so no extra hidden client-state fields are required).
2. `POST` the same URL with those four hidden fields echoed back plus:
   - `ctl00$ContentPlaceHolder1$DropDownList1` = file type (`3`=Tax Bill/TAXDATA,
     `4`=Adjustments/ADJMENTS, `5`=Real Property/PARCEL, `6`=Personal
     Property/PERSPROP)
   - `ctl00$ContentPlaceHolder1$DropDownList2` = pay year, e.g. `2025` (= "2025
     pay 2026", the most recent available at time of spike)
   - `ctl00$ContentPlaceHolder1$DropDownList3` = county code, `29` = Hamilton
   - `ctl00$ContentPlaceHolder1$button2` = `Download`  **(the Property Files
     button -- see gotcha below)**
   - the AFR-section fields need *some* value present (defaults are fine) since
     they're part of the same form: `RadComboBox1`, `RadComboBox2`,
     `DropDownListUnitType`, `DropDownListYear`.

**One real gotcha:** the page has *two* submit buttons in one form --
`button_download1` (Annual Financial Reports section) and `button2` (Property
Files section). Posting with `button_download1` "succeeds" (HTTP 200) but
silently returns whatever the AFR dropdowns default to (a 46-byte empty
`afr_CapAssets_2026.txt`), not the property file. Using `button2` returns the
correct file. This is the kind of failure that looks like success (200 OK,
a file attached) unless you check the returned filename/size.

Verified downloads (single GET + single POST per file, ~1.5-3s pacing between
requests, custom UA identifying the request, 3 files total -- polite):

| File | HTTP | `Content-Disposition` filename | Size (zip) | Uncompressed | Records |
|---|---|---|---|---|---|
| TAXDATA (type 3) | 200 | `taxbill_Hamilton_29_2025p2026.zip` | 11.6 MB | 122.9 MB | 157,317 lines, 454 cols/record |
| ADJMENTS (type 4) | 200 | `taxadjustment_Hamilton_29_2025p2026.zip` | 2.98 MB | 40.3 MB | 424,034 lines, 94 cols/record |
| PARCEL / Real Property (type 5) | 200 | `realparcel_Hamilton_29_2025p2026.zip` | 12.2 MB | 182.9 MB | 148,280 lines, 1,286 cols/record |

No auth, no CAPTCHA, no rate-limit response encountered. `robots.txt` for the
host 404s (i.e., doesn't exist / imposes no crawl policy). Footer describes the
site as "a public access tool for citizens," a state-university partnership
(Indiana Business Research Center / Kelley School of Business) -- no terms-of-use
or license page was found linked from the download page itself.

Working script: `fetch_gateway.py` in this directory (stdlib only:
`urllib.request` + `http.cookiejar`). Usage: `python3 fetch_gateway.py <filetype 3-6> <pay_year e.g. 2025> <county_code e.g. 29>`.

## 2. File layout source, and how authoritative it is

- **50 IAC 26** is the governing rule. The legacy PDF link in the task
  (`in.gov/legislative/iac/T00500/A00260.PDF`) now 302-redirects into a
  React SPA (Indiana Register) that requires JS execution -- it could not be
  fetched as static text, and its underlying API returned HTTP 403 on the
  endpoints tried.
- **What worked:** a DLGF memo, *"210521-Wood-Memo-SDF-File-Specifications-
  Required-Fields-CHANGES.pdf"* (`in.gov/dlgf/files/memos/...`), reproduces the
  verbatim regulatory text of **50 IAC 26-20-4 ("Real property assessment
  data")**, including the full Column/Start/End/Length/Type table for the
  **PARCEL**, LAND, IMPROVE, DWELLING, BUILDING, APPEALS, and SALES DISCLOSURE
  files. This is a state-agency-published exact quotation of the current rule
  text (not a third-party summary) -- I treat it as authoritative for PARCEL.
- I could **not** locate an equivalent verbatim layout for **TAXDATA** or
  **ADJMENTS** in the time available (checked 50 IAC 26-20-5, -6, -7 via
  law.cornell.edu -- those sections cover personal property, mobile homes, and
  oil/gas respectively, not TAXDATA/ADJMENTS; the section that defines them
  wasn't identified). For ADJMENTS, what I do have is authoritative but partial:
  the **Property Tax Management System Code List Manual** (dlgf.in.gov,
  May 2026 edition, PDF, extracted from the raw PDF content streams myself --
  no `pdftotext`/`PyPDF2` available, so I wrote a small stdlib Flate-decode +
  `Tj`/`TJ` text extractor, `pdf_text.py`) documents the **code values** used
  in ADJMENTS' "Adjustment Code" field, but not that field's byte position.
- The header-row workbook (`../prop-doc.xlsx`) documents only the *header
  record* (file metadata: county, dates, vendor, assessment/pay year) common to
  all four files -- it does not document per-file data-record fields. Read via a
  small stdlib `.xlsx` reader (`read_xlsx.py`, zipfile + `xml.etree`), no
  `openpyxl` available. It did positively confirm (in its prose, not a table)
  that "ADJMENTS ... contains deduction, exemption, and credit amounts by tax
  bill" and "PARCEL ... contains real property assessment information" --
  consistent with what I found in the fields themselves.

## 3. Decisive question: does cap-class allocation exist, and where?

**Yes -- verified against real data -- but it lives in PARCEL, not in TAXDATA or
ADJMENTS.**

The **PARCEL** record (50 IAC 26-20-4(b), confirmed byte-for-byte against
`RealParcel_Hamilton_29_2025P2026.txt`) contains a *fully broken-out* allocation
of a parcel's assessed value across the three constitutional caps, split further
by land vs. improvement and by sub-category:

| Field | Columns (1-indexed) | Len | Type |
|---|---|---|---|
| AV - Land Eligible for 1% Circuit Breaker Cap | 541-552 | 12 | N |
| AV - Improvements Eligible for 1% Circuit Breaker Cap | 553-564 | 12 | N |
| AV - Non-Homestead Residential Land Subject to 2% Cap | 565-576 | 12 | N |
| AV - Non-Homestead Residential Improvements Subject to 2% Cap | 577-588 | 12 | N |
| AV - Commercial Apartment Land Subject to 2% Cap | 589-600 | 12 | N |
| AV - Commercial Apartment Improvements Subject to 2% Cap | 601-612 | 12 | N |
| AV - Long Term Care Facility Land Subject to 2% Cap | 613-624 | 12 | N |
| AV - Long Term Care Facility Improvements Subject to 2% Cap | 625-636 | 12 | N |
| AV - Farmland Subject to 2% Cap | 637-648 | 12 | N |
| AV - Mobile Home Land Subject to 2% Cap | 649-660 | 12 | N |
| AV - Land Subject to 3% Cap | 661-672 | 12 | N |
| AV - Improvements Subject to 3% Cap | 673-684 | 12 | N |
| AV - Classified Land | 685-696 | 12 | N |
| Legally Deeded Acreage | 697-708 | 12 | N (format 8.4, implied decimal) |

All numeric fields are zero-padded fixed-width integers (whole dollars, based on
observed values).

**This is not merely documented -- it is verified against live Hamilton County
records.** Example (from `RealParcel_Hamilton_29_2025P2026.txt`), a homestead on
more than one acre, exactly the case the tool cannot currently resolve:

- Parcel `290101000013000001`: Legally Deeded Acreage `000000021000` -> 2.1000 ac
  (format 8.4 confirmed: 8 integer digits + 4 implied decimal digits).
  `AV_Land_1pct` = 50,000; `AV_Improve_1pct` = 228,000; `AV_NonHmstdResiLand_2pct`
  = 15,400 -- i.e., the dwelling + 1 acre is captured at the 1% cap, and the AV of
  the remaining ~1.1 acres is separately captured at the 2% cap, on the same
  parcel record. Four more parcels with the identical >1-acre-homestead pattern
  were pulled and all showed the same split behavior (`AV_Land_1pct` fixed near
  50,000, i.e., the state's standard "acre-equivalent" land AV, with the
  remainder falling into `AV_NonHmstdResiLand_2pct`).

This directly and completely solves the stated problem: PARCEL gives the exact
per-cap-class AV split the tool currently infers/asks the user to correct.

Separately, **ADJMENTS**' "Adjustment Code" field (documented in the Code List
Manual, not yet position-verified -- see above) has three relevant codes that
would let a consumer cross-check or derive circuit-breaker *credit* amounts by
cap class, as a secondary signal:

- `61` -- CIRCUIT BREAKER CREDIT - HOMESTEAD RESIDENTIAL (statute 6-1.1-20.6-7.5)
- `62` -- CIRCUIT BREAKER CREDIT - NON-HOMESTEAD RESIDENTIAL (statute 6-1.1-20.6-7.5)
- `63` -- CIRCUIT BREAKER CREDIT - OTHER REAL AND PERSONAL PROPERTY (statute
  6-1.1-20.6-7.5)

I did not locate/verify the exact byte offsets of "Adjustment Code" and its
paired amount within the 94-column ADJMENTS record in the time available (see
"What I could not determine" below), so treat this ADJMENTS angle as
*documented, not verified* -- it's a bonus corroboration path, not the load-
bearing answer. **PARCEL alone answers the question.**

**TAXDATA** was inspected (454-column record) but I found no evidence -- neither
documented nor observed -- of a cap-class breakdown there; it appears to carry
bill-level totals (net taxable AV, gross tax, credits applied in aggregate,
etc.), not a per-cap allocation. I would call this a fairly confident negative
for TAXDATA specifically, though I did not obtain an authoritative field-by-
field layout for it to be fully certain which of its 454 columns are which.

## 4. What a production implementation would require

- **File sizes (Hamilton, this cycle):** TAXDATA 122.9 MB / 157k records,
  ADJMENTS 40.3 MB / 424k records (multiple adjustment lines per tax bill),
  PARCEL 182.9 MB / 148k records. Only PARCEL is actually needed for the cap-
  class problem, at ~183 MB uncompressed / ~12 MB zipped for one mid-size
  county. A join key (parcel number) ties records across files if TAXDATA is
  also wanted for bill totals.
- **Update cadence:** annual, one file set per pay-year. Header records showed
  this cycle's PARCEL file was generated 06/04/2025, while TAXDATA and ADJMENTS
  were generated 03/03/2026 and 03/11/2026 respectively, all for
  assessment_year 2025 / pay_year 2026 -- i.e., the county assembles these at
  different points in the cycle, and DLGF's own compliance-review process
  (per `prop-doc.xlsx`) typically completes "by the end of May" for a pay year.
  The Gateway UI back-years to "2020 pay 2021." A production pipeline would
  need to re-pull once a year (roughly spring, after the compliance window),
  detect the current pay year, and treat a fetch failure/short file as "county
  hasn't published yet" rather than an error.
- **Parsing effort:** straightforward fixed-width slicing (Python, one dict of
  `(name, start, end)` tuples), same order of effort as this spike's parser.
  148k PARCEL records parse and filter to any given parcel number in well under
  a second per county. The 1,286-column record is wide but flat.
  For the derivation itself: only 12 fields (541-708) matter for the
  Noblesville tool.
- **Licensing / terms of use:** none found. No robots.txt restriction (host
  404s), no visible ToS/license page linked from the download page, and the
  Gateway site explicitly frames itself as "a public access tool for citizens"
  built as a state/university partnership. This is a statutorily-mandated
  county-to-state data submission (IC 6-1.1-4-25) republished for public
  download -- the same posture as the county GIS layer already in use, so no
  new licensing risk is apparent, but this spike did not do a legal review and
  that should not be inferred as legal clearance.

## Confidence and what I could not determine

- **High confidence, verified:** scripted download works exactly as described
  (script included); PARCEL's cap-class AV fields exist at the stated columns
  and their values make sense on real Hamilton parcels, including a >1-acre
  homestead example that is exactly the scenario the tool can't currently
  resolve.
- **Medium confidence, documented but not position-verified:** ADJMENTS
  circuit-breaker-credit-by-cap-class via Adjustment Codes 61/62/63 -- the code
  meanings are from an authoritative DLGF manual, but I did not confirm the
  byte offset of the Adjustment Code / Adjustment Amount fields against the
  regulation text, only inferred them from eyeballing a handful of raw ADJMENTS
  lines (which do contain 2- or 3-digit codes like `61`/`62`/`63` in plausible
  positions, but I did not do a clean field-by-field decode the way I did for
  PARCEL -- don't treat this as confirmed).
- **Not determined:** exact TAXDATA field layout (I have real data and the
  record length, 454 cols, but no authoritative column map); the precise legal
  status of scraping vs. any unstated Gateway API terms (no ToS page was
  found, but I did not search exhaustively or contact DLGF); whether other
  counties' files are equally complete/well-formed (only Hamilton was tested,
  since that's the target county); behavior at scale (all-counties file,
  which the doc explicitly warns is "quite large" for Marion/Lake/Allen) --
  not attempted, out of scope for "Hamilton, most recent year."

## Files in this directory

- `fetch_gateway.py` -- the working scripted-download client (stdlib only).
- `pdf_text.py` -- minimal stdlib PDF text extractor (no `pdftotext`/PyPDF2
  available in this environment).
- `read_xlsx.py` -- minimal stdlib `.xlsx` reader (no `openpyxl` available).
- `codelist.txt`, `sdf-memo.txt` -- extracted text of the two source PDFs.
- `TAXDATA_HAMILTON_29_2025p2026.txt`, `ADJMENTS_HAMILTON_29_2025p2026.txt`,
  `RealParcel_Hamilton_29_2025P2026.txt` -- the raw downloaded fixed-width
  files (large; scratch-only).

---

# Addendum: shipped-artifact design (measured, 2026-08-12)

Design proposed: trim PARCEL to a handful of fields, key by parcel number, ship a
compressed database with the project. Keep address search on the live county GIS; join to
the shipped artifact by parcel number. Measurements below are from the real Hamilton
2025-pay-2026 PARCEL file.

## The join key works — verified

Hamilton GIS `STPRCLNO` with non-digit characters stripped is an exact 18-digit match for
the PARCEL file's first field.

    GIS "29-11-06-000-014.201-013"  ->  "291106000014201013"  ->  1 match
    GIS "29-11-06-314-005.000-013"  ->  "291106314005000013"  ->  1 match
    GIS "29-11-06-313-018.001-013"  ->  "291106313018001013"  ->  1 match
    GIS "29-11-07-000-009.003-013"  ->  "291107000009003013"  ->  1 match

4/4 on the first four Noblesville City parcels tried. `STPRCLNO` is already in the tool's
`OUT_FIELDS` and on `ParcelCandidate` as `stateParcelNo`, so no lookup change is needed to
obtain the key.

## Sparsity: most parcels need no data at all

Of 148,278 records, 140,001 carry any assessed value. Collapsing the 12 statutory fields
into cap1 / cap2 / cap3 totals:

    parcels spanning MORE THAN ONE cap class:  11,707  (8.4%)

The other 91.6% sit entirely in one class, where the existing inference is already correct.
The genuinely hard case — a homestead whose land spills into the 2% cap — is 4,702 parcels
(3.2%). Long-term-care (41) and mobile-home land (29) are effectively nonexistent here.

## Measured artifact sizes

| Artifact | Rows | CSV | CSV.gz | SQLite | SQLite.gz |
|---|---|---|---|---|---|
| all parcels with AV | 140,001 | 4.90 MB | **0.93 MB** | 8.71 MB | 2.15 MB |
| only >1-cap parcels | 11,707 | 0.47 MB | **0.12 MB** | 0.76 MB | 0.26 MB |

Schema measured: `(key TEXT PRIMARY KEY, cap1 INT, cap2 INT, cap3 INT, acres INT)`.

The whole county fits under 1 MB gzipped as CSV. Shipping all 140k is cheap enough that it
also lets us VALIDATE the inference on every parcel, not just correct the 8.4%.

## Runtime shape — no new npm dependency required

SQLite would mean `better-sqlite3` (native build in the Fargate image). Two lighter options
keep the app's current three-runtime-dependency posture:
- a gzipped CSV/binary loaded once into a `Map` at server start (~140k entries), or
- Node's built-in `node:sqlite` — no npm package, but check the container's Node major
  before relying on it.

## The staleness question — store PROPORTIONS, not dollars

This is the one design point worth deciding early. The shipped file is a snapshot (2025 pay
2026) while the GIS assessed value is live. If absolute dollars are shipped, they drift out
of agreement with the live AV at the next reassessment and the tool would show a split that
does not sum to the value it just displayed.

Storing each parcel's cap split as PROPORTIONS of its total, then applying those to the
live `AVTOTGROSS`, degrades gracefully: a uniform revaluation stays correct, and only a
non-uniform one (land revalued differently from improvements) introduces error.

## Open, verify before building
1. Does the PARCEL cap-field sum equal the GIS `AVTOTGROSS` for the same parcel? If they
   differ systematically, proportions are mandatory rather than merely safer.
2. Match rate across ALL Hamilton parcels, not the 4 spot-checked — and behavior for
   parcels present in GIS but absent from PARCEL (new splits, annexations).
3. Refresh cadence: files are annual, assembled around the spring compliance window.

## DECISION (user, 2026-08-12): ship the full dataset

Ship the complete Hamilton dataset — all 140,001 parcels carrying assessed value, ~0.93 MB
gzipped CSV — rather than only the 11,707 multi-cap parcels. Rationale: having the full
dataset present is worth more than the ~800 KB saved, and it lets the shipped data validate
the cap-class inference on every parcel rather than only correct the 8.4% that span classes.

Paired decision: write a fetch-and-parse script so the dataset can be regenerated from the
statutory source when a refresh is wanted. `spike-dlgf/fetch_gateway.py` is a working
starting point (stdlib only; remember to POST `button2`, not `button_download1`).

Still to decide when that spec is written: proportions vs absolute dollars (see the
staleness section above — proportions degrade more gracefully across reassessments), and
the runtime shape (gzipped CSV into a Map needs no new dependency; SQLite is 2.3x larger
and `better-sqlite3` is a native build).
