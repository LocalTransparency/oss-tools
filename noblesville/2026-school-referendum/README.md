# Noblesville Referendum Tax Estimator

Neutral, sourced estimates of a Noblesville homeowner's property tax bill if the
November 2026 Noblesville Schools operating referendum passes or fails, under
Indiana's SEA 1 (2025) rules. Assessed values come from Hamilton County's public
parcel data at lookup time; nothing a visitor enters is stored or logged. Anonymous
page-view analytics only; user input never reaches analytics.

- Spec: `docs/superpowers/specs/2026-07-15-referendum-tax-app-design.md`
- Statewide tax law (SEA 1 deductions, circuit breaker, homestead credit), with sources: `lib/tax/indiana/assumptions.ts`
- Per-district referendum data (rates, commitments, tax districts): `lib/tax/indiana/districts/`

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

When 2027 rates certify (January 2027) or the district updates its commitments,
edit `lib/tax/indiana/districts/noblesville.ts` only — every figure carries its
source URL and a `confirmed | estimated | public-commitment` status that the UI
displays. Statewide law (deduction schedule, circuit breaker, homestead credit)
lives separately in `lib/tax/indiana/assumptions.ts` and only changes when the
legislature does.

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
