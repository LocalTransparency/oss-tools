# Noblesville referendum rate update + multi-year projection — design

**Date:** 2026-08-12
**Status:** Approved pending user review
**Scope:** `noblesville/2026-school-referendum/` — `lib/tax/`, `lib/lookup/`, `components/`,
`app/`, `docs/`; plus two posts in the `localtransparency/noblesville` CMS repo.
**Tracking:** `localtransparency/noblesville` issue #5
**Depends on:** `2026-07-17-indiana-tax-structure-design.md`, `2026-07-17-multi-district-support-design.md`

## Trigger

On 2026-08-12 Noblesville Schools announced via ParentSquare that it is lowering the
referendum rate it would levy in 2027 from $0.41 to **$0.385**, and lowering its
projected rates for the remaining years of the referendum. The announcement also
introduced a district-published calculator.

The tool's `committed2027` value is therefore stale. Separately, the announcement's
headline figure — "$1.88 more per month for a $350,000 median home, averaged over eight
years" — describes a quantity the tool currently has no way to represent, because the
tool models a single pay year (2027) and the claim spans 2027–2034.

## Confirmed new facts

The district's calculator is a static file at
`https://noblesvilleschoolsorg.finalsite.com/uploaded/NoblesvilleSchools_ReferendumCalculator.html`
(retrieved 2026-08-12). It is reached from `noblesvilleschools.org/referendum`, which
frames it but does not link it as a URL in page content. Its model is a hardcoded config
block; the following values are transcribed from that file.

**Per-year operating referendum rate** (per $100 net AV):

| 2026 | 2027 | 2028 | 2029 | 2030 | 2031 | 2032 | 2033 | 2034 |
|---|---|---|---|---|---|---|---|---|
| 0.37 | 0.385 | 0.425 | 0.465 | 0.505 | 0.545 | 0.545 | 0.545 | 0.545 |

The rate rises 1.5 cents for 2027, then 4.0 cents per year through 2031, then holds. It never reaches the
ballot-authorized maximum of $0.57.

**Assumed assessed-value growth:** 5.3% for 2027, 3.5% each year 2028–2034. The file's
own disclosure states the 5.3% reflects "the median annual growth of local existing
residential parcels from the Hamilton County 2026 to 2027 Certified Net Assessed Value
data sets."

**SEA 1 deduction schedule used by the district** (2026 → 2034):

| | 2026 | 2027 | 2028 | 2029 | 2030 | 2031+ |
|---|---|---|---|---|---|---|
| Homestead standard deduction | 48,000 | 40,000 | 30,000 | 20,000 | 10,000 | 0 |
| Supplemental homestead % | 0.40 | 0.46 | 0.52 | 0.57 | 0.62 | 0.667 |
| Cap 2 AV deduction % | 0.06 | 0.12 | 0.19 | 0.25 | 0.30 | 0.334 |

The 2026 and 2027 columns match this tool's existing `DEDUCTIONS` exactly. **The
2028–2034 columns are not yet verified against a primary source** — see Open items.

**Scope of the district's model.** It computes `netAV × rate ÷ 100` — the referendum
line only. It applies no non-referendum rate, no circuit breaker, and no supplemental
homestead credit. It takes three assessed-value inputs (`av1`, `av2`, `av3`) which the
user enters by hand after looking their value up at the DLGF assessed-value search.
Those inputs drive the Cap 2 AV deduction; they are not circuit-breaker cohorts.

## Replication findings

The district's model was reimplemented and run for a $350,000 homestead
(`av1 = 350000`, `av2 = av3 = 0`). Results:

| Year | Net AV | Rate | Annual | Monthly | vs 2026/mo |
|---|---|---|---|---|---|
| 2026 | 181,200 | 0.3700 | 670.44 | 55.87 | — |
| 2027 | 177,417 | 0.3850 | 683.06 | 56.92 | +1.05 |
| 2028 | 168,696 | 0.4250 | 716.96 | 59.75 | +3.88 |
| 2029 | 161,164 | 0.4650 | 749.41 | 62.45 | +6.58 |
| 2030 | 151,475 | 0.5050 | 764.95 | 63.75 | +7.88 |
| 2031 | 140,832 | 0.5450 | 767.54 | 63.96 | +8.09 |
| 2032 | 145,761 | 0.5450 | 794.40 | 66.20 | +10.33 |
| 2033 | 150,863 | 0.5450 | 822.20 | 68.52 | +12.65 |
| 2034 | 156,143 | 0.5450 | 850.98 | 70.92 | +15.05 |

Net AV falls from 2027 through 2031 because SEA 1's supplemental deduction percentage
rises faster than the assumed AV growth; it resumes rising once the schedule flattens
in 2031.

**Derivation of $1.88.** The eight year-over-year changes in the monthly amount are
+1.05, +2.83, +2.70, +1.29, +0.22, +2.24, +2.32, +2.40. Their mean is **$1.8806**, which
rounds to $1.88. This is algebraically identical to `(2034 monthly − 2026 monthly) / 8`.

The same series under other definitions:

- 2027 increase over 2026: **$1.05/month**
- Mean increase over 2026, averaged across 2027–2034: **$8.19/month**
- Final-year (2034) increase over 2026: **$15.05/month**
- Cumulative referendum paid 2027–2034: **$6,149.49**, versus **$5,363.52** for eight
  years at the 2026 amount — a cumulative increase of **$785.97**.

$1.88 measures the average annual *step* in the monthly amount. It is not the average
amount by which the monthly bill exceeds the 2026 monthly bill. No year in 2027–2034
has an increase over 2026 close to $1.88 other than 2027 ($1.05).

**Difference against this tool, base homeowner.** For a $350,000 homestead in 2027 this
tool computes a referendum-operating line of **$644.49**; the district's calculator
computes **$683.06**. The $38.57 gap is attributable to the district applying 5.3% AV
growth to the entered value while this tool uses the entered value directly
(`644.49 × 1.053 = 678.65`; the $4.41 residual is deduction ordering on the grown
value). Net-AV mechanics otherwise agree exactly for 2026 and 2027.

**Parcel data.** Of 30,679 parcels in Noblesville-Schools taxing districts, 27,664 carry
`AVTAXYR = 2026` — so a looked-up gross AV is already the pay-2026 base, matching the
district's base year with no adjustment. Roughly 21,000 are homesteaded
(`hmstd_code = 1`). `hmstd_code` also takes the value `-1` on at least 1,295 parcels;
its meaning is unconfirmed. The layer exposes `PROPCLASS`, `PROPUSE`, `AVLAND`,
`AVIMPROVE`, and `DEEDACRES`, but no allocation of AV across circuit-breaker classes.

## Decisions

1. **Multi-year scope:** project the **referendum line only** for 2027–2034. Keep the
   existing four-scenario full-bill pay-2027 view as the primary answer. Rationale:
   `nonReferendumRate()` derives from the certified pay-2026 total and is already
   `estimated` for pay-2027; holding it flat for eight years would make the weakest
   input dominate every projected total.
2. **AV growth:** default to the district's 5.3% / 3.5%, sourced and labeled as *their*
   assumption, and let the visitor change it.
3. **Cohorts:** infer a default cap class from parcel data, and allow a manual
   three-bucket override. Never assert a within-parcel split.
4. **Charting:** hand-rolled inline SVG, no new runtime dependency.
5. **Neutrality:** code, tests, config, docs, issue, and PR carry findings and
   definitions only — no characterization of the district's choices. Commentary lives
   solely in blog post #2.

## Architecture

### Types — `lib/tax/types.ts`

```ts
export type CapClass = 1 | 2 | 3;

export interface AvBuckets {
  cap1: number;  // homestead
  cap2: number;  // other residential + agricultural land
  cap3: number;  // all other real & personal property
}
```

`ScenarioParams.payYear` widens from `2026 | 2027` to `number`.
`DistrictReferendumConfig.referendum` gains an optional block:

```ts
projection?: {
  operatingRates: Sourced<Record<number, number>>;  // 2026–2034
  avGrowth:       Sourced<Record<number, number>>;  // 2027–2034
};
```

Optional so the other four Hamilton County districts remain valid without a published
schedule; the multi-year view renders only when `projection` is present.

### Statewide assumptions — `lib/tax/indiana/assumptions.ts`

- `DEDUCTIONS` extends from 2 years to 9 (2026–2034).
- `CIRCUIT_BREAKER_RATE: Sourced<number>` becomes
  `CIRCUIT_BREAKER_RATES: Sourced<Record<CapClass, number>>` = `{1: 0.01, 2: 0.02, 3: 0.03}`.
- New `CAP2_AV_DEDUCTION: Sourced<Record<number, number>>` for SEA 1's phased
  non-homestead residential deduction.

**Sourcing rule:** out-year statutory values must come from the DLGF memo or the
statute. The district's calculator is a cross-check, never the source. Any year that
cannot be verified from a primary source ships as `status: 'estimated'`, citing the
calculator as the only attestation, and the UI displays that status as it does today.

### District config — `lib/tax/indiana/districts/noblesville.ts`

- `committed2027`: `0.41` → `0.385`; note and source updated to the 2026-08-12
  announcement; `status` stays `public-commitment`.
- New `projection` block carrying both maps, sourced to the calculator file with its
  retrieval date, `status: 'public-commitment'`.
- `explainer` rewritten to state the committed 2027 rate, the published path to $0.545,
  and that $0.57 remains the authorized maximum.

**Drift guard:** a unit test asserts `projection.operatingRates[2027] === committed2027.value`
and `projection.operatingRates[2026] === currentOperating.value`. If the district revises
one figure and not the other, CI fails rather than the site disagreeing with itself.

### Engine — `lib/tax/engine.ts`

- `computeNetAV(buckets, year)` applies the homestead standard and supplemental
  deductions to `cap1` only, the Cap 2 AV deduction to `cap2`, and nothing to `cap3`.
- `computeBill` applies each class's circuit-breaker cap to that class's gross AV rather
  than a single blanket 1%.
- Signature changes ripple to `components/Calculator.tsx`, `components/Results.tsx`,
  `app/methodology/page.tsx`, and the existing test files. This is a refactor, not an
  additive change.

### Projection — `lib/tax/projection.ts` (new)

```ts
projectReferendumLine(
  buckets: AvBuckets,
  config: DistrictReferendumConfig,
  opts: { avGrowth: Record<number, number>; years: number[] },
): ProjectionRow[]
```

Each row carries `year`, `growthFactor`, `grossAV`, `netAV`, `operatingRate`,
`operatingTax`, `debtRate`, `debtTax`, `annual`, `monthly`. The entered AV is treated as
the 2026 base (consistent with `AVTAXYR = 2026`), and 2027 is the first grown year.

The referendum **debt** rate ($0.08 through `debtEndYear` 2032) is carried as its own
row. The district's calculator omits it; it is on the bill either way and outside this
vote, and is labeled as such.

Four headline statistics are computed and each is defined explicitly in code and on the
methodology page:

| Statistic | Definition |
|---|---|
| 2027 change | 2027 monthly − 2026 monthly |
| Average increase vs today | mean over 2027–2034 of (year monthly − 2026 monthly) |
| Final-year increase | 2034 monthly − 2026 monthly |
| Average year-over-year step | mean of the eight successive monthly differences |

All four are stated as arithmetic. The tool does not rank or characterize them.

### Lookup — `lib/lookup/arcgis.ts`

Add `PROPCLASS`, `AVLAND`, `AVIMPROVE`, `DEEDACRES` to `OUT_FIELDS`. `ParcelCandidate`
gains `propertyClass`, `avLand`, `avImprove`, `deededAcres`, `capClass`, and
`capClassConfidence`.

### Cap-class inference — `lib/tax/indiana/capClass.ts` (new)

Kept out of the ArcGIS adapter because the mapping is Indiana statute, not county schema.

| Signal | Result | Confidence |
|---|---|---|
| `hmstd_code = 1` | cap 1 | high |
| non-homestead, `PROPCLASS` 5xx or 1xx | cap 2 | high |
| non-homestead, other `PROPCLASS` | cap 3 | high |
| `hmstd_code = -1` | cap 2 or 3 by class | **low**, flagged in UI |
| `AVTAXYR ≠ 2026` | class inferred as normal | **low**, base-year caveat shown |

`hmstd_code = -1` gets an explicit named branch with a documented "meaning unconfirmed
with Hamilton County" note, replacing today's silent fall-through at `arcgis.ts:100`.

### UI — `components/`

1. **Cap-class panel.** Shows the inferred class and AV after lookup, with an "adjust"
   control opening three pre-filled bucket inputs.
2. **Mixed-parcel hint.** Where a homesteaded parcel has `DEEDACRES > 1`, show a factual
   note that Indiana's homestead covers the dwelling plus one acre and that part of the
   land value is likely assessed under the 2% cap, pointing at the override. No guessed
   split is computed or displayed.
3. **AV growth control.** Defaults to 5.3% / 3.5%, labeled as the district's assumption
   with its source, adjustable, with a reset link.
4. **Multi-year table** for 2027–2034, with the debt row ending after 2032, and the four
   headline statistics with their definitions visible.
5. **Chart:** inline SVG, design-token colors, `aria-hidden` with the adjacent table as
   the accessible representation of the same data.

The methodology page gains a projection section: rate source, growth assumption, the
four statistic definitions, and an explicit list of what is not modeled — non-referendum
rates beyond 2027, and AV allocation across cap classes within a parcel.

## Testing

Built in this order:

1. **Parity regression, before any refactor.** Every existing case in `engine.test.ts`
   and `scenarios.test.ts` must produce identical output routed through the new
   `AvBuckets` path as cap-1-only input.
2. **District cross-check harness.** The district's five constant arrays are vendored
   into a fixture with source URL and retrieval date; their arithmetic is reimplemented
   in the test. Given identical buckets, growth assumptions, and deduction schedule,
   `projectReferendumLine` must agree **to within $0.01 per year**, because after this
   change both models apply growth to the same 2026 base with the same formula.

   Two divergences are expected, must be asserted explicitly rather than absorbed by
   tolerance, and must be exercised by their own cases: this engine applies
   `SUPP_DEDUCTION_CAP_RATE` (75% of gross AV) and clamps net AV at zero, and the
   district's model does neither. Any *other* divergence is a defect, not a tolerance
   question.
3. **Cap-class inference table tests**, covering the `-1` and `AVTAXYR ≠ 2026` branches.
4. **Statistic definition tests**, pinning each of the four definitions — including that
   the average year-over-year step for a $350,000 homestead is $1.88.
5. **Playwright e2e** with the county API mocked: lookup → inferred cohort → multi-year
   table → override recomputes.

## Implementation phasing

Issue #5 is deliberately tracked as one ticket, but the work has a required order and
two natural stopping points. The implementation plan should follow it:

1. **Data only** — `committed2027` → 0.385, `projection` block, extended `DEDUCTIONS`,
   drift-guard test. Ships a correct 2027 number on its own.
2. **Engine generalization** — `AvBuckets`, per-class circuit breaker, Cap 2 deduction,
   behind the parity regression from Testing step 1.
3. **Projection + cross-check harness** — `projection.ts` and the district fixture.
4. **Lookup + inference** — new `OUT_FIELDS`, `capClass.ts`.
5. **UI** — cap-class panel, growth control, multi-year table, SVG chart, methodology.
6. **Comparison artifact + posts.**

Phase 1 is independently shippable and should be, since the stale $0.41 is live now.

## Deliverables

- `docs/district-calculator-comparison.md` — approximately eight real Noblesville
  parcels spanning homesteaded 510, multi-acre homesteaded 511, non-homestead
  residential, and commercial; each run through both tools with ours, theirs, the delta,
  and the cause of the delta. Identified by parcel number and AV, never street address,
  consistent with the tool's privacy posture.
- `docs/hamilton-county-2026-referendum-data.md` — updated with the new rate schedule,
  growth assumptions, and their provenance.
- `README.md` — "Updating numbers" section updated for the `projection` block.

## Blog posts (CMS repo)

**Post 1 — release note.** Factual and short: the district revised its 2027 rate to
38.5¢; the tool now models the published 2027–2034 schedule, supports the 2% and 3%
cohorts, and exposes the growth assumption as an adjustable input. No argument.

**Post 2 — analysis, with a clear voice.** Sections:

1. The published rate schedule as a table.
2. The derivation of $1.88, and the same series under the other three definitions.
3. What using the district's calculator requires: a separate DLGF lookup, then a manual
   three-way split of your own assessed value.
4. The constraints the district is operating under — it cannot publish a figure that
   reads as a promise it lacks authority to keep, and modeling the circuit-breaker
   offset would require asserting non-referendum rates it does not control. This is the
   likely reason the offset is absent, and it is a defensible choice.
5. That the eight-year rate schedule — the single most decision-relevant fact for a
   voter — is published inside the calculator file and not in the referendum
   information alongside it.

### Publishing

Markdown drafts committed to the CMS repo, plus `scripts/publish-post.mjs` which logs in
via `POST /api/users/login`, converts with `convertMarkdownToLexical` (available in
`@payloadcms/richtext-lexical` 3.86.0), and upserts by slug. Credentials from environment
only, never committed.

The script defaults to dry-run and requires an explicit flag to write. Publishing to
production is a manual, user-initiated step.

## Open items

1. **Verify the 2028–2034 SEA 1 deduction schedule against a primary source** (DLGF
   Cockerill memo or the statute). Until verified, those years ship as `estimated`. This
   blocks nothing but changes displayed status.
2. **Confirm the meaning of `hmstd_code = -1`** with Hamilton County. Until confirmed,
   affected parcels are treated as non-homestead with low confidence surfaced in the UI.
3. **The ~3,000 parcels without `AVTAXYR = 2026`** need a defined fallback; current plan
   is to show the base-year caveat and proceed.
4. **The district's calculator may change.** The vendored fixture records a retrieval
   date; refreshing it is a manual step documented in the README.

## Out of scope

- Projecting non-referendum rates or full tax bills beyond pay-2027.
- Multi-year projections for the other four Hamilton County districts (no published
  schedules exist).
- Computing an AV split across cap classes within a single parcel.
- Address→county routing, still handled as in the multi-district spec.
