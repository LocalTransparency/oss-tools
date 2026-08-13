# Hamilton County 2026 school referendum data — sources

Research compiled 2026-07-17 for the multi-district build. **Every fiscal figure below is
traced to a primary source PDF.** The authoritative index of all Hamilton County Nov 3, 2026
school referendums is the DLGF referendum-information page:
<https://www.in.gov/dlgf/referendum-information/> — it lists exactly five corporations with a
November 3, 2026 operating referendum: **Noblesville, Hamilton Southeastern, Carmel Clay,
Sheridan, and Westfield Washington**. Hamilton Heights School Corporation has **no** 2026
referendum (absent from the DLGF list and the county rate sheet).

Real examples below are identified by parcel number, not street address, matching the
tool's own privacy posture and `docs/district-calculator-comparison.md`'s convention —
please keep new examples consistent with this.

## Shared sources

- **County rate sheet (current rates + certified district totals):** DLGF/Hamilton County
  "2026 Tax Rate … Per Taxing District" —
  <https://www.hamiltoncounty.in.gov/DocumentCenter/View/31240/2026-District-Rates-PDF>
  (its "Rates Exempt From Circuit Breaker" section lists each corp's current referendum rates).
- **Budget order (certified per-unit referendum funds):** DLGF 2026 Hamilton Budget Order —
  <https://www.in.gov/dlgf/files/2026-reports/2026-budget-orders/Hamilton-260115-2026-Budget-Order.pdf>
- **SEA 1 deduction/credit schedule (statewide law, already in `indiana/assumptions.ts`):**
  <https://www.in.gov/dlgf/files/2025-memos/250612-Cockerill-Memo-Legislation-Affecting-Deductions,-Exemptions,-and-Credits.pdf>

## Per-district referendum data (all from the DLGF Determination PDFs)

All five are **operating** referendums, **8 years** (pay-2027 through 2034), each on the
**Nov 3, 2026** ballot. "Current" rates are from the county rate sheet; "proposed max / max
levy" are from each district's DLGF determination.

| District | Current operating | Current 2nd component | Proposed max rate | Max annual levy | Replaces | Determination PDF |
|---|---|---|---|---|---|---|
| Noblesville | 0.3700 | Debt 0.0800 | 0.5700 | $43,842,578 | 2018 operating | `26-015-Noblesville-Schools-Operating-Determination.pdf` |
| Hamilton Southeastern | 0.1995 | Debt 0.0890 | 0.3600 | $47,500,000 | 2023 operating | `26-032-A-Hamilton-Southeastern-Schools-Operating-Determination.pdf` |
| Carmel Clay | 0.1900 | School Safety 0.0500 | 0.4274 | $61,981,519 | **both** existing referendums (op + safety) | `26-030-Carmel-Clay-Schools-Operating-Determination.pdf` |
| Westfield Washington | 0.1700 | Debt 0.0790 | 0.3941 | $38,000,000 | 2022 operating | `26-007-Westfield-Washington-Schools-Operating-Determination.pdf` |
| Sheridan Community | 0.2500 | — | 0.4000 | $2,900,000 | 2023 operating | `26-003-Sheridan-Community-School-Corporation-Operating-Determination.pdf` |

Determination PDFs live under
`https://www.in.gov/dlgf/files/referendum-documentation2/2026-november-referendum-documents/`.

### Modeling notes (how each maps to the pass/fail scenarios)

- **HSE / Westfield:** operating referendum is repealed & replaced; the existing **debt**
  referendum continues (like Noblesville). `currentOperating` + `debt` both set.
- **Carmel Clay:** the new question **repeals and replaces *both*** existing referendums
  (operating 0.19 **and** school safety 0.05). So the current referendum total being replaced
  is 0.24; there is no continuing component. Model `currentOperating = 0.24`, no `debt`.
  (Ballot language: "…by repealing and replacing its existing referendums, including
  supporting student safety…")
- **Sheridan:** operating only (current 0.25), no debt component.
- **No firm committed first-year rate** was published for HSE, Carmel, Westfield, or Sheridan.
  Each district's board sets the annual rate within the ceiling (DLGF spending plans project
  first-year levies well below the max, but no fixed *rate* is committed). Per the
  verified-only rule, leave `committed2027` **absent** for these four — the tool then shows
  the authorized maximum (our conditional rendering already handles this). Noblesville
  publicly revised its 2027 commitment **down from $0.41 to $0.385**, announced 2026-08-12
  (`districtAnnouncement2026_08_12` in `lib/tax/indiana/districts/noblesville.ts`); see the
  full multi-year schedule below.
  - HSE stated *plan* (~$0.22 rising to ~$0.33 by 2034) and Carmel secondary (~$0.31) are
    **approximate / not board-fixed** — do NOT encode as rates.

### Noblesville's published multi-year rate & growth schedule

Noblesville Schools is the only Hamilton County district with a published multi-year
plan; the other four districts' commitments are the single first-year figures (or
absence thereof) noted above. Source: the district's own published calculator,
<https://noblesvilleschoolsorg.finalsite.com/uploaded/NoblesvilleSchools_ReferendumCalculator.html>,
retrieved 2026-08-12. Status `public-commitment` throughout — a board vote sets the actual
rate every year, so nothing below is legally binding, and the schedule never exceeds the
$0.57 DLGF-authorized maximum.

| Pay year | Operating rate | AV growth assumed for that year |
|---|---|---|
| 2026 | $0.370 | — (base year) |
| 2027 | $0.385 | 5.3% |
| 2028 | $0.425 | 3.5% |
| 2029 | $0.465 | 3.5% |
| 2030 | $0.505 | 3.5% |
| 2031 | $0.545 | 3.5% |
| 2032 | $0.545 | 3.5% |
| 2033 | $0.545 | 3.5% |
| 2034 | $0.545 | 3.5% |

The rate rises 1.5 cents for 2027, then 4.0 cents per year through 2031, then holds at $0.545 — never reaching the
$0.57 authorized maximum. The district states its 2027 AV-growth figure (5.3%) as "the
median annual growth of local existing residential parcels between the Hamilton County 2026
and 2027 certified net assessed value data sets"; later years hold flat at 3.5%. This tool's
multi-year projection (`lib/tax/projection.ts`) uses this schedule as its default and lets a
visitor override the growth assumption. The referendum debt rate ($0.08, through 2032) is
**not** part of this schedule — the district's calculator does not model debt, and this
tool's projection keeps that scope for direct comparability (see
`docs/district-calculator-comparison.md`).

### Deduction schedule status

Statewide SEA 1 (2025) deduction figures live in `lib/tax/indiana/assumptions.ts`, each with
its own `Sourced` status:

- **Standard homestead deduction (IC 6-1.1-12-37) and supplemental homestead deduction
  (IC 6-1.1-12-37.5), pay years 2026–2034**, are `confirmed` — 2026–2027 against the DLGF
  Cockerill memo, 2028–2034 against a second primary source, the DLGF's April 30 2026
  "Report on Property Tax Exemptions, Deductions, and Abatements."
- **The Cap 2 AV deduction schedule (non-homestead residential and agricultural land) remains
  `estimated`, for the whole 2026–2034 record** — `CAP2_AV_DEDUCTION` in
  `lib/tax/indiana/assumptions.ts` carries a single status for the full table, not a per-year
  one like `DEDUCTIONS`. Its source is still the Cockerill memo, but the memo's coverage is
  strongest for the near-term (6% for 2026, 12% for 2027) figures; no primary source
  confirming the 2028–2034 phase-in (19%, 25%, 30%, 33.4%…) has been found. Do not present
  any part of this schedule as confirmed.

## ArcGIS ground truth — actual `TAXDISTNAM` values (Hamilton parcel service)

Distinct `TAXDISTCOD | TAXDISTNAM` (from
`services5.arcgis.com/.../Parcels_Current_Open_Data/FeatureServer/0`), with the county rate
sheet's certified 2026 total rate:

| Code | Real `TAXDISTNAM` (GIS) | Rate-sheet total | Likely school corp |
|---|---|---|---|
| 11 | `Noblesville City` | 2.5549 | Noblesville |
| 10 | `Noblesville Twp` | 1.8444 | Noblesville |
| 21 | `Noblesville FC` | 2.4503 | Noblesville |
| 20 | `Nob Wayne` | 2.4737 | Noblesville |
| 18 | `Noblesville SE` | 2.4813 | Noblesville |
| 15 | `Fishers` | 2.1994 | HSE (core) |
| 19 | `Fishers FC` | 2.1684 | HSE (core) |
| 19E | `Fishers FC MTE` | — | HSE (edge/abatement) |
| 14 | `Delaware` | 1.7871 | HSE (Delaware Twp, non-Noblesville portion) |
| 13 | `Fall Creek` | 1.7245 | HSE (Fall Creek Twp, non-Noblesville portion) |
| 16 | `Carmel` | 2.0167 | Carmel Clay (core) |
| 09Z | `Carmel Washington` | 2.4068 | Carmel Clay (core) |
| 22 | `Carmel County TIF` | 2.0167 | Carmel Clay (core) |
| 09 | `Westfield` | 2.3448 | Westfield (core) |
| 08 | `Westfield Washington Twp` | 1.9372 | Westfield (core) |
| 09A | `Westfield Ag Abated` | 1.6285 | Westfield (edge/abatement) |
| 02 | `Sheridan` | 2.7455 | Sheridan (core) |
| 01 | `Sheridan Rural` | 1.9409 | Sheridan (core) |
| 02A | `Sheridan Ag Abated MTE` | 1.9409 | Sheridan (edge/abatement) |
| 03 | `Jackson` | 1.7596 | Hamilton Heights (no referendum) |
| 04 | `Arcadia` | 2.3933 | Hamilton Heights (no referendum) |
| 05 | `Cicero` | 2.0276 | Hamilton Heights (no referendum) |
| 06 | `Atlanta` | 2.2155 | Hamilton Heights (no referendum) |
| 07 | `White River` | 1.5611 | **UNRESOLVED** — attribution not verified |
| 12 | `Wayne` | 1.6906 | **UNRESOLVED** — bare "Wayne" vs "Nob Wayne" |

### CONFIRMED BUG in the existing Noblesville config

The current `noblesville.ts` match patterns were written from DLGF rate-sheet labels, not the
real GIS `TAXDISTNAM` strings. Verified against live parcels, **three of five districts never
match**:

| Config entry | Config `match` | Real GIS `TAXDISTNAM` | Result |
|---|---|---|---|
| Noblesville–Fall Creek | `/fall\s*creek/i` | `Noblesville FC` | ❌ no match → "not covered" |
| Noblesville–Delaware | `/delaware/i` | `Noblesville SE` | ❌ no match → "not covered" |
| Noblesville–Wayne | `/wayne/i` | `Nob Wayne` | ❌ gate `/noblesville/i` rejects "Nob Wayne" |
| Noblesville City | `/city/i` | `Noblesville City` | ✅ |
| Noblesville Township | `/township\|twp/i` | `Noblesville Twp` | ✅ |

Real affected parcels (sampled, identified by parcel number — see convention note above):
parcel `1311230000004401` (Noblesville FC), parcel `1211150000004000` (Nob Wayne — this
one's street address is shared by 21 distinct parcels across four tax districts, a common
pattern for platted-but-unaddressed Hamilton County lots, so it doesn't resolve 1:1 the way
the other two do; `1211150000004000` is one of seven parcels at that address confirmed
`Nob Wayne`), and parcel `1811190000007002` (Noblesville SE). The existing test passed only
because it fed fabricated inputs (`"Noblesville Delaware"` etc.) instead of the real GIS
values.

**Fix:** match on the real `TAXDISTNAM` values, broaden the gisGate to admit `Nob Wayne`, and
replace the test's fabricated inputs with real values.

### Attribution caveat (why boundary districts need care)

Mailing city (`LOCCITY`) is **not** a reliable proxy for school corporation — e.g. the
`Westfield` taxing district samples to a Carmel mailing city; `White River` to Noblesville;
`Fall Creek` to both Fishers and Noblesville. Attribution therefore rests on the taxing-district
**name** (reliable for cores whose name is the corp's town) plus the Noblesville-split logic
(the Noblesville portions of Fall Creek/Delaware townships are named `Noblesville FC`/
`Noblesville SE`; the bare `Fall Creek`/`Delaware` districts are the HSE portions). `White River`
(07) and bare `Wayne` (12) remain **unresolved** and should be omitted from configs (those
residents get a safe "not covered" message) until an authoritative crosswalk confirms them.
