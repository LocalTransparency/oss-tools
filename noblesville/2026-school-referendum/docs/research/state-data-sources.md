# State data sources — recon, 2026-08-12

Question asked: can we get cap-class depth (the 2% and 3% situations) from the state,
via a dataset or API, rather than driving the DLGF calculator's web form?

Answer: **yes via bulk statutory files, no via API.** Details below.

## The state referendum calculator is NOT extractable

`https://gateway.ifionline.org/CalculatorsDLGF/RefCalculator.aspx`

- Its math is server-side. The page references `../js/ReferendumCalculator.js`, but that
  path 404s at every variant tried (`/js/`, `/CalculatorsDLGF/js/`, etc.) — a stale
  reference. Unlike the district's calculator, there is no client-side model to read.
- Inputs are ASP.NET postbacks (`__doPostBack` on `ddl_RefCounties`, `ddl_Referendums`,
  `ddl_PropertyTypes`), so scripted use needs viewstate handling. Practical for a handful
  of manual spot-checks, not for a harness.
- `https://gateway.ifionline.org/public/api.aspx` is linked from the site's own navigation
  but returns **404**. There is no public Gateway API.

### What it did give us, free
Its property-type dropdown encodes the cap rates directly as option values — an
authoritative state definition of the three classes:

| value | label |
|---|---|
| `0.01` | Homestead (Owner-occupied residence) |
| `0.02` | Residential Rental, Non-Homestead Residential, and Agricultural |
| `0.03` | Other |

This independently confirms `CIRCUIT_BREAKER_RATES` = {1: .01, 2: .02, 3: .03}, and the
class-2 wording is a better, citable definition than the one currently in our code.

Stated methodology: *"the calculator is using the maximum rate for which the unit is
seeking approval through the referendum"* — i.e. DLGF computes at $0.57, not the
district's committed schedule.

## The real prize: four statutory per-county files

Counties must submit these annually under **IC 6-1.1-4-25**; Gateway republishes them.
Downloadable per county or all counties, **2011 pay 2012 forward**.

| File | Contents |
|---|---|
| **TAXDATA** (Tax Bill) | tax bill information |
| **ADJMENTS** (Adjustments) | deductions, exemptions, credits |
| **PARCEL** (Real Property) | real property assessment |
| **PERSPROP** (Personal Property) | personal property |

Per DLGF: TAXDATA and ADJMENTS "contain a complete inventory of all property records —
inclusive of assessed values, deductions, exemptions, and credits — in the county's
software system that had a tax liability calculated against them for the particular pay
cycle." PARCEL and TAXDATA should contain the same real property records.

**Why this matters more than the calculator:** these carry per-parcel deductions and
credits actually applied. That is the data that could resolve the one thing we currently
declare unknowable — the allocation of a single parcel's AV across cap classes. Today we
infer a dominant class and offer a manual override because Hamilton County's open parcel
layer publishes no allocation. If TAXDATA/ADJMENTS carry applied credits per cap, the
inference could become a derivation.

### Format and access
- **Positional flat files**, not CSV. Layout is specified by **50 IAC 26**:
  `http://www.in.gov/legislative/iac/T00500/A00260.PDF`
- Field codes: **Property Tax Management System Code List Manual** (2026 ed.):
  `https://www.in.gov/dlgf/files/2026-memos/Property-Tax-Management-System-Code-List-Manual-260514.pdf`
  This is also a **primary source for property class codes** — directly relevant to the
  `PROPCLASS` mapping in the cap-class inference, which currently relies on the
  conventional 1xx/5xx = residential+ag reading without a citation.
- Download UI: `https://gateway.ifionline.org/public/download.aspx`, "Property Files"
  section. ASP.NET postback (`button_download1`, `DropDownList1..3`, `RadComboBox1..2`) —
  no direct URLs; a scripted fetch must round-trip viewstate.
- Contact for data questions: `data@dlgf.in.gov`, Gateway: `Gateway@dlgf.in.gov`

## Lead on the open `estimated` question
`https://www.in.gov/dlgf/files/2026-Exemptions-and-Deductions-Report.pdf`
"Report on Property Tax Exemptions, Deductions, and Abatements," April 30 2026. Not yet
read. This is the most promising candidate seen so far for a primary source covering the
2028–2034 SEA 1 deduction schedule, which currently ships `status: 'estimated'`.

## Recommended follow-on scope (NOT in the current plan)
1. Read the 2026 Exemptions and Deductions Report; if it carries the out-year schedule,
   promote `DEDUCTIONS[2028..2034]` and `CAP2_AV_DEDUCTION` to `confirmed`.
2. Cite the Code List Manual in `capClass.ts` for the property-class mapping.
3. Adopt the state's class-2 wording ("Residential Rental, Non-Homestead Residential, and
   Agricultural") in the UI.
4. Spike a Hamilton County TAXDATA/ADJMENTS download + positional parser against 50 IAC 26
   to test whether per-parcel cap allocation is recoverable. This is the only path seen to
   turning cap-class inference into derivation, and is a meaningful piece of work on its
   own — a separate spec, not an addition to this branch.
