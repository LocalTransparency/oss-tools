# Noblesville Referendum Tax Estimator

Neutral, sourced estimates of a Noblesville homeowner's property tax bill if the
November 2026 Noblesville Schools operating referendum passes or fails, under
Indiana's SEA 1 (2025) rules. Assessed values come from Hamilton County's public
parcel data at lookup time; nothing a visitor enters is stored or logged. Anonymous
page-view analytics only; user input never reaches analytics.

- Spec: `docs/superpowers/specs/2026-07-15-referendum-tax-app-design.md`
- All tax rates/parameters with sources: `lib/tax/assumptions.ts`

## Develop

    npm install
    npm run dev        # http://localhost:3000/tools/2026-school-referendum
    npm run test       # Vitest unit tests (engine math is anchored to official figures)
    npm run e2e        # Playwright smoke test (county API mocked)

## Deploy

Runs as a container on AWS App Runner behind CloudFront (infrastructure defined in the
private `localtransparency/infrastructure` CDK repo). Every push to `main` that touches
this app builds the image in GitHub Actions (tests run first) and pushes it to ECR;
App Runner auto-deploys the new image. The app serves under its `basePath`
(`/tools/2026-school-referendum`); the domain root is handled by CloudFront.

## Updating numbers

When 2027 rates certify (January 2027) or the district updates its commitments,
edit `lib/tax/assumptions.ts` only — every figure carries its source URL and a
`confirmed | estimated | public-commitment` status that the UI displays.
