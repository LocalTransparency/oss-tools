# Hamilton County School Referendum Tax Estimator

Neutral, sourced estimates of a Hamilton County homeowner's property tax bill if
their school district's November 3, 2026 operating referendum passes or fails,
under Indiana's SEA 1 (2025) rules. An entered address resolves to the correct
school district; the tool covers all five Hamilton County corporations with a
2026 referendum (Noblesville, Hamilton Southeastern, Carmel Clay, Westfield
Washington, Sheridan). Assessed values come from Hamilton County's public parcel
data at lookup time; nothing a visitor enters is stored or logged. Anonymous
page-view analytics only; user input never reaches analytics.

The tool infers a parcel's constitutional cap class (1% homestead / 2% other
residential & agricultural / 3% other, IC 6-1.1-20.6) from the county's
`PROPCLASS` and `hmstd_code` fields and lets a visitor correct it — the
county's public feed doesn't expose a parcel's true multi-class AV split, so
this is a dominant-class estimate, not an allocation. Where a district
publishes its own multi-year rate plan (currently Noblesville only), a
year-by-year projection through the referendum's full term shows the
referendum line growing against the district's own AV-growth assumption,
cross-checked to the cent against the district's published calculator (see
[`docs/district-calculator-comparison.md`](docs/district-calculator-comparison.md)).

- Spec: `docs/superpowers/specs/2026-07-15-referendum-tax-app-design.md`
- Statewide tax law (SEA 1 deductions, circuit breaker, homestead credit), with sources: `lib/tax/indiana/assumptions.ts`
- Per-district referendum data (rates, commitments, tax districts): `lib/tax/indiana/districts/`

## Sources

Every figure in the tool is traced to a primary source; the in-app "What this
referendum does" panel and methodology page link out to these directly. Full data
trail (per-figure): [`docs/hamilton-county-2026-referendum-data.md`](docs/hamilton-county-2026-referendum-data.md).

**Authoritative index** — [DLGF Referendum Information](https://www.in.gov/dlgf/referendum-information/)
(lists every Indiana school referendum and its determination documents).

**Per-district DLGF determinations** (proposed max rate, max annual levy, term, ballot language):

- Noblesville Schools — [26-015 Determination](https://www.in.gov/dlgf/files/referendum-documentation2/2026-november-referendum-documents/26-015-Noblesville-Schools-Operating-Determination.pdf)
- Hamilton Southeastern Schools — [26-032-A Determination](https://www.in.gov/dlgf/files/referendum-documentation2/2026-november-referendum-documents/26-032-A-Hamilton-Southeastern-Schools-Operating-Determination.pdf)
- Carmel Clay Schools — [26-030 Determination](https://www.in.gov/dlgf/files/referendum-documentation2/2026-november-referendum-documents/26-030-Carmel-Clay-Schools-Operating-Determination.pdf)
- Westfield Washington Schools — [26-007 Determination](https://www.in.gov/dlgf/files/referendum-documentation2/2026-november-referendum-documents/26-007-Westfield-Washington-Schools-Operating-Determination.pdf)
- Sheridan Community Schools — [26-003 Determination](https://www.in.gov/dlgf/files/referendum-documentation2/2026-november-referendum-documents/26-003-Sheridan-Community-School-Corporation-Operating-Determination.pdf)

**Current rates & certified totals** — [Hamilton County 2026 District Rates sheet](https://www.hamiltoncounty.in.gov/DocumentCenter/View/31240/2026-District-Rates-PDF)
(the "Rates Exempt From Circuit Breaker" section lists each corporation's current
referendum rates; the table gives every taxing district's certified total).

**Non-referendum rates (held at pay-2026 for pay-2027 estimates)** — [DLGF 2026 Hamilton Budget Order](https://www.in.gov/dlgf/files/2026-reports/2026-budget-orders/Hamilton-260115-2026-Budget-Order.pdf).

**Statewide deduction/credit schedule (SEA 1, 2025)** — [DLGF Cockerill memo](https://www.in.gov/dlgf/files/2025-memos/250612-Cockerill-Memo-Legislation-Affecting-Deductions,-Exemptions,-and-Credits.pdf).

Data-quality notes: the Carmel Clay official referendum page was showing pre-vote
content at last check (the DLGF determination is authoritative); Sheridan has no
confirmed official referendum page, so its config links to the determination only.

## Develop

    npm install
    npm run dev        # http://localhost:3000/tools/2026-school-referendum
    npm run test       # Vitest unit tests (engine math is anchored to official figures)
    npm run e2e        # Playwright smoke test (county API mocked)

## Deploy

Runs as a container on Amazon ECS Express Mode (Fargate) behind CloudFront (infrastructure
defined in the private `localtransparency/infrastructure` CDK repo). Every push to `main` that
touches this app builds the image in GitHub Actions (tests run first) and pushes it to ECR,
then rolls the ECS service (`aws ecs update-service … --force-new-deployment`) to re-pull it —
Express Mode does not auto-deploy on a push. The app serves under its `basePath`
(`/tools/2026-school-referendum`); the domain root is handled by CloudFront.

## Updating numbers

When 2027 rates certify (January 2027) or a district updates its commitments,
edit that district's file under `lib/tax/indiana/districts/` — every figure
carries its source URL and a `confirmed | estimated | public-commitment` status
that the UI displays. Statewide law (deduction schedule, circuit breaker,
homestead credit) lives separately in `lib/tax/indiana/assumptions.ts` and only
changes when the legislature does.

**The `projection` block** (currently only on `NOBLESVILLE.referendum.projection`
— the other four Hamilton districts have published no multi-year schedule, so
the multi-year view simply doesn't render for them) holds two `Sourced<Record<number, number>>`
maps, `operatingRates` and `avGrowth`, keyed by pay year. When the district
revises either schedule, update both maps together with a fresh `source` URL,
`status`, and retrieval-dated `note` — `projectReferendumLine` and the
multi-year UI (`components/Projection.tsx`) read these directly, so no other
code changes. `lib/tax/indiana/districts/noblesville.test.ts` asserts the block
is present and every year 2026–2034 is covered; extend that test if the term
length ever changes.

**Refreshing `districtCalculator.fixture.ts`** (test-only — never imported from
application code): when the district republishes its calculator, re-download
the HTML from the URL in the fixture's header comment, find its `<script>`
config block (the `av`/`rate`/deduction constants inline in the page), and
update `DISTRICT_AV_GROWTH`, `DISTRICT_RATES`, `DISTRICT_YEARS`, `DISTRICT_HD`,
`DISTRICT_SH_PCT`, and `DISTRICT_CAP2_PCT` to match exactly — this file is a
verbatim transcription, not a paraphrase, so partial or rounded updates will
silently break the cross-check. Update the "Retrieved" date in the same
comment. After updating, run `npm run test`:
`districtCalculator.test.ts`'s first two `it`s assert the *config* transcribes
the same constants (so `noblesville.ts`'s `projection` block and the fixture
can't silently drift apart), and the parametrized `it`s re-verify the $0.01
agreement described in
[`docs/district-calculator-comparison.md`](docs/district-calculator-comparison.md)
across six synthetic AV cases. If either district changes its formula (not
just its constants), the reduced `districtCalculatorAnnual` function itself
needs updating to match — re-derive it from the new page's script rather than
patching individual numbers.

## Adding a district

The tax engine and scenario math are statewide-law-plus-config: adding another
Indiana school-district referendum is a data change, not a code change.

1. Copy `lib/tax/indiana/districts/noblesville.ts` to a new file (e.g.
   `lib/tax/indiana/districts/<district>.ts`) and export a
   `DistrictReferendumConfig` for the new district — `id`, `name`, `county`,
   its own `sources` URLs, `referendum` rates (`proposedMax` is required;
   `currentOperating`, `debt`, `debtEndYear`, `committed2027` are optional),
   a `gisGate` regex that coarsely matches the district's ArcGIS
   `TAXDISTNAM` values, and the certified `taxDistricts` with their match
   patterns and pay-year total rates.
2. Fill in every rate with a real `Sourced<T>` value — `value`, `source` (an
   `https://` URL), `status`, and an optional `note`. No placeholder or fake
   district data ships in this codebase.
3. Register it in `lib/tax/indiana/districts/index.ts`'s `DISTRICTS` map.
4. Add a **verified** roster entry for the district in its county file
   (`lib/tax/indiana/counties/<county>.ts`) with a `configId` linking it to the
   config. Only add the entry once its `TAXDISTNAM` pattern is confirmed against
   real county parcels — a wrong name is worse than the generic "not covered"
   message. `resolveTaxDistrict` then matches parcels to the config automatically.
5. A new **county** needs a `CountyLookupSource` adapter under
   `lib/lookup/counties/` plus one entry in `lib/lookup/counties/index.ts`
   (`COUNTY_SOURCES`). Existing counties need no lookup changes. Address→county
   routing is still future work — today the API route consumes
   `COUNTY_SOURCES.hamilton` directly, so a second county also needs that
   routing wired in.

`buildScenarios`, `computeAllScenarios`, `findDistrict`, and `computeBill` all
take the config as a parameter, so no engine or scenario code needs to change.
