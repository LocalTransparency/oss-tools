# Noblesville Referendum Tax Estimator

Neutral, sourced estimates of a Noblesville homeowner's property tax bill if the
November 2026 Noblesville Schools operating referendum passes or fails, under
Indiana's SEA 1 (2025) rules. Assessed values come from Hamilton County's public
parcel data at lookup time; nothing a visitor enters is stored or logged.

- Spec: `docs/superpowers/specs/2026-07-15-referendum-tax-app-design.md`
- All tax rates/parameters with sources: `lib/tax/assumptions.ts`

## Develop

    npm install
    npm run dev        # http://localhost:3000
    npm run test       # Vitest unit tests (engine math is anchored to official figures)
    npm run e2e        # Playwright smoke test (county API mocked)

## Deploy (AWS Amplify Hosting)

One-time, in the AWS console for the hosting account:

1. Push this repo to GitHub (or CodeCommit).
2. Amplify → Create new app → Host web app → connect the repo/branch.
   Amplify auto-detects Next.js and uses `amplify.yml` (which runs unit tests before build).
3. Domain: create a Route53 hosted zone for your domain (the registrar can be
   external — e.g. Gandi — just point the domain's nameservers at the zone's
   NS records). Then Amplify → Domain management → Add domain → enter the
   subdomain you want (e.g. `noblesville.example.com`); Amplify provisions the
   ACM certificate and DNS records in the zone automatically.

Every push to the connected branch redeploys. Unit tests failing fails the build.

## Updating numbers

When 2027 rates certify (January 2027) or the district updates its commitments,
edit `lib/tax/assumptions.ts` only — every figure carries its source URL and a
`confirmed | estimated | public-commitment` status that the UI displays.
