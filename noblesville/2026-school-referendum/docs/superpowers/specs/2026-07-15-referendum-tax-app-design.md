# Noblesville Schools Referendum Tax Calculator — Design

**Date:** 2026-07-15
**Status:** Approved pending user review
**Scope:** Phase 1 (single-address lookup + comparison). Phase 2 (bulk computation + neighborhood map of average change) is out of scope here but informs architecture decisions, noted where relevant.

## Purpose

Noblesville Schools has an operating referendum on the November 3, 2026 ballot. Between the expiring 2018 referendum and the SEA 1 (2025) property tax overhaul, homeowners are confused about what passage or failure actually costs them. This tool lets a homeowner enter their address, pulls their assessed value from Hamilton County's public parcel data, and shows a neutral, fully-sourced comparison of their estimated tax bill under three scenarios. No visitor data is stored.

**Success criteria:** A homeowner gets a defensible dollar estimate in under 30 seconds; a skeptical reader can verify every number in the math from cited official sources; both sides of the debate could link to it without it reading as campaign material.

## Confirmed facts the tool is built on

All figures verified against DLGF, Hamilton County, and Noblesville Schools official sources (full citations in `lib/tax/assumptions.ts`):

- **On the ballot (Nov 3, 2026):** Operating referendum, max rate **$0.57 per $100 net AV**, max levy $43,842,578/yr, up to 8 years. Replaces the 2018 operating referendum. Source: DLGF Final Determination No. 26-015-REF.
- **District commitment:** the district has publicly committed to set a rate **no higher than $0.41 for 2027** (lower if assessed values come in above projections), and states it "will not use the maximum 57 cent rate for all eight years" — though later years may exceed $0.41. The 2027 commitment is public but not legally binding; the tool presents both the $0.41 committed rate and the $0.57 authorized max, clearly labeled (status: `public commitment` in assumptions, source: noblesvilleschools.org/referendum).
- **Expiring:** 2018 operating referendum, **$0.37**, last levy pay-2026.
- **Continuing either way:** 2010 referendum debt rate, **$0.08**, through 2032. "Fail" ≠ zero referendum tax.
- **Pay-2026 certified rates** (DLGF 2026 Hamilton County Budget Order): Noblesville City district 11 total **$2.5549** ($0.45 referendum); Noblesville Township $1.8444; Noblesville–Delaware/HSE $2.4813; Noblesville–Wayne $2.4737; Noblesville–Fall Creek $2.4503.
- **SEA 1 homestead mechanics:** standard deduction $48,000 (pay-2026) → $40,000 (pay-2027); supplemental deduction 40% (pay-2026) → 46% (pay-2027) of the post-standard remainder, capped at 75% of gross AV; new supplemental homestead credit = min(10% of liability, $300), applied after circuit-breaker credits, **excluding referendum taxes**; 1% homestead circuit-breaker cap unchanged, referendum rates outside the cap.
- **Validation anchor:** official ballot language states $955/yr increase for the median $350,000 residence — reproduced exactly by ($350,000 − $40,000) × (1 − 0.46) × 0.0057 = $954.18 → $955 (rounded up per statute).

## Requirements (locked in with user)

- **Property scope:** owner-occupied homesteads in Noblesville Schools district only. Non-homestead or out-of-district parcels get clear notices, not silent wrong answers.
- **Comparison:** three scenarios — current bill (pay-2026), referendum passes (pay-2027 est.), referendum fails (pay-2027 est.).
- **Amounts:** $/year and $/month; pass-vs-fail delta and current-vs-future deltas both shown.
- **Transparency:** expandable "How this was calculated" section showing every deduction, rate, cap, and credit applied, with source links; separate methodology/FAQ page.
- **Tone:** strictly neutral. No advocacy language, no red/green judgment coloring on outcome columns.
- **Fallback:** manual gross-AV entry when lookup fails or for users who prefer not to enter an address.
- **Privacy:** no addresses or lookups logged or stored, ever.
- **Data provenance:** all rates/parameters live in one config file; anything not confirmed from an official source is flagged `estimated` and surfaced in the UI.

## Architecture

Next.js (App Router, TypeScript), deployed via **AWS Amplify Hosting** in a new AWS account, with a custom domain registered and routed through Route53 + ACM.

Three units with clean boundaries:

### 1. Tax engine — `lib/tax/`

Pure TypeScript, zero I/O. Core signature:

```
computeBill(input: { grossAV: number; district: TaxDistrict; scenario: Scenario }): BillBreakdown
```

`BillBreakdown` includes: standard deduction, supplemental deduction (with 75% cap flag), net AV, per-unit gross tax, referendum vs. non-referendum split, circuit-breaker credit (1% × gross AV applied to non-referendum liability), supplemental homestead credit (min(10%, $300), non-referendum only), and total. Every intermediate value is returned so the UI renders the math without recomputing it.

Purity is a phase-2 requirement, not just style: the neighborhood-map iteration maps this same function over a bulk parcel pull.

### 2. Assumptions config — `lib/tax/assumptions.ts`

Single source of truth for every number: certified pay-2026 rates per taxing district (broken out referendum vs. non-referendum), SEA 1 deduction/credit schedule by pay year, both referendum rates, the $0.57 proposal and levy cap. Each entry carries `{ value, source: url, status: 'confirmed' | 'estimated', note? }`. The "show the math" UI reads from this file so displayed citations can never drift from computed values.

### 3. Lookup API — `app/api/lookup/route.ts`

Proxies address search to Hamilton County's public ArcGIS parcel endpoint (`services5.arcgis.com/.../Parcels_Current_Open_Data/FeatureServer/0/query` — verified live, no key). Sanitizes input into a `LOCADDRESS LIKE` query, filters to Noblesville Schools taxing districts, returns up to 10 candidates with: situs address, parcel number, gross AV (`AVTOTGROSS`), assessment year (`AVTAXYR`), homestead flag (`HOMESTEAD`/`hmstd_code`), taxing district (`TAXDISTCOD`), and the county property-report deep link. Short-lived response cache; request logging disabled for this route.

**Terms-of-use note:** the county publishes this endpoint on its open-data GeoHub with no stated license. Per-address queries at civic-tool volume are low risk; phase 2's bulk pull should revisit this (and consider asking the county GIS office).

## Scenario definitions

| Parameter | Current (pay-2026) | Passes (pay-2027 est.) | Fails (pay-2027 est.) |
|---|---|---|---|
| Standard homestead deduction | $48,000 | $40,000 | $40,000 |
| Supplemental deduction | 40% | 46% | 46% |
| School referendum rates | $0.37 op + $0.08 debt | **$0.41 op** (committed for 2027) / $0.57 op (authorized max) + $0.08 debt | $0.08 debt only |
| Non-referendum district rates | Certified 2026 | Held at 2026 levels *(estimated)* | Held at 2026 levels *(estimated)* |
| Supplemental homestead credit | min(10%, $300), non-referendum base | same | same |
| Circuit breaker | 1% × gross AV, referendum outside | same | same |

Disclosed caveats (rendered in the UI, not buried):
1. Pay-2027 non-referendum rates aren't certified until January 2027; holding them at pay-2026 levels is an assumption and is flagged as such.
2. The "passes" column is computed at **$0.41**, the rate the district has publicly committed not to exceed **for 2027** — with a secondary line in the same column showing the bill at the full **$0.57** ballot authorization ("legal maximum if fully levied"). The commitment is not legally binding and applies to 2027 only (later years may be higher, up to $0.57), which is why both are always shown. This also explains the messaging gap voters see: the ballot's statutorily-required "$955/year for a median $350,000 home" is computed at the $0.57 max, while the district's "$2.30/month average increase" framing assumes rates below the max across the eight years.
3. Gross AV from the county's current layer is the 2026 assessment (pay-2027 basis). The "current" column applies pay-2026 parameters to that same AV, so it may differ slightly from the owner's actual 2026 bill (which used the 2025 assessment). Labeled as an estimate.
4. Results are estimates, not bills; link to the county's official property report for the parcel.

## User experience

1. Landing page: one-sentence neutral framing, address search box, manual gross-AV entry link directly beneath it.
2. Multiple matches → candidate picker (address + parcel number).
3. Results: three-column table (Current / If it passes / If it fails), annual and monthly totals, pass-vs-fail difference prominent, current-vs-future deltas for both outcomes.
4. Collapsible "How this was calculated": full `BillBreakdown` walk-through with each parameter's value, source link, and confirmed/estimated badge.
5. Methodology/FAQ page: SEA 1 summary, why "fail" still includes $0.08, why the district says it needs more than 37¢ (net-AV shrinkage), why the ballot says "$955/year" while the district says "$2.30/month average" ($0.57 statutory-max math vs. the district's below-max rate plan starting at $0.41 in 2027), all sources.
6. Footer: not affiliated with the district or any campaign; no data stored.

## Error handling

- **No GIS match / endpoint down:** friendly failure → manual AV entry with instructions for finding gross AV on the county property site.
- **No homestead flag on parcel:** show results with a prominent notice that the estimate assumes an owner-occupied homestead and won't match bills for rentals/second homes.
- **Parcel outside Noblesville Schools:** explain the tool's coverage; no numbers shown.
- **Engine edge cases:** 1% cap binding (high AV), 75% supplemental-deduction ceiling (low AV), $300 credit ceiling, $0 / absurd manual inputs validated.

## Testing

- **Engine unit tests (credibility backbone):**
  - Reproduces the official ballot figure: median $350k home at the $0.57 authorized max ≈ $954.18/yr referendum tax.
  - Committed-rate variant: same home at $0.41 ≈ $686.34/yr, and the pass column renders both values.
  - Reproduces the pay-2026 worked example: $350k Noblesville City homestead ≈ $4,015 total.
  - Cap boundaries: high-AV home where the 1% cap binds; low-AV home where the 75% supplemental ceiling binds; credit capped at $300; referendum tax correctly excluded from cap and credit.
  - All five taxing districts produce distinct, correct totals.
- **API route:** mocked ArcGIS responses — happy path, multiple matches, no match, malformed/injection-attempt input, upstream timeout.
- **E2E:** one Playwright smoke test — enter address → pick candidate → table renders → math section expands.

## Out of scope (phase 2 and beyond)

- Bulk computation over all district parcels and a neighborhood map of average change (phase 2 — enabled by the pure engine + ArcGIS geometry fields, but designed and specced separately, including revisiting bulk-access terms with the county).
- Non-homestead property classes (2%/3% caps).
- Multi-year projections beyond pay-2027.
- Accounts, saved lookups, analytics on addresses.
