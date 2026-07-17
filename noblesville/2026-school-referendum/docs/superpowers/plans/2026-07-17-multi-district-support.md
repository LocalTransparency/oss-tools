# Multi-District Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve a user's entered address to the correct school district's referendum config automatically, and make every result clearly specific to that district — replacing the hardcoded `NOBLESVILLE` in the lookup and render paths.

**Architecture:** Two resolution seams. (1) A `CountyLookupSource` abstraction in `lib/lookup/` with a Hamilton adapter (today's ArcGIS logic, minus the hardcoded `%NOBLESVILLE%` filter, so it returns any Hamilton County parcel). (2) A `resolveTaxDistrict(taxDistrictName)` resolver in the tax layer that scans the district registry via each config's existing `gisGate`. A per-county roster names districts we don't cover yet, but only where the `TAXDISTNAM`→school-corp mapping is verified. `Results.tsx` takes `config` as a prop and renders optional referendum fields conditionally, which finally removes the non-null-assertion seam.

**Tech Stack:** Next.js 16 (App Router), React, TypeScript (strict), Tailwind v4, Vitest + Testing Library.

## Global Constraints

- **Next.js 16 has breaking changes** — read the relevant guide in `node_modules/next/dist/docs/` before writing any Next-specific code (route handlers, metadata). Heed deprecation notices. (from AGENTS.md)
- **Boundary discipline:** `lib/tax/` must never import from `lib/lookup/` or any GIS code; `lib/lookup/` must never import referendum math. The parcel→config glue lives in the tax layer keyed on `gisGate`.
- **Privacy:** the lookup path must never log the query, address, or results. Do not add logging.
- **Noblesville numeric outputs must stay identical** — all existing anchored dollar-figure tests ($4,015.40 / $4,020.26 / $4,288.10 / $3,333.92, etc.) must continue to pass unchanged.
- **Uncovered-district naming accuracy:** populate roster entries only where the `TAXDISTNAM`→school-corporation mapping is verified. Today that is Noblesville alone. A wrong name is worse than a generic message.
- **Design tokens only:** use the existing Tailwind token classes (`bg-surface`, `border-border`, `text-muted`, `text-accent`, `bg-warning-bg`, etc.) — no raw hex or ad-hoc colors.
- TDD, one logical change per commit, exact paths always.

Run tests from the tool directory: `cd noblesville/2026-school-referendum`. Full suite: `npm test`. Single file: `npx vitest run <path>`.

---

### Task 1: Make the ArcGIS query county-wide (drop the Noblesville filter)

**Files:**
- Modify: `lib/lookup/arcgis.ts` (`buildQueryUrl`)
- Test: `lib/lookup/arcgis.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `buildQueryUrl(term: string, normalizedTerm?: string): string` — now emits an address-only `where` clause (no `TAXDISTNAM` filter). `searchParcels(term: string): Promise<ParcelCandidate[]>` unchanged in signature; its query is now county-wide.

The Hamilton County ArcGIS service is already scoped to Hamilton County, so removing the school-district filter is what widens the lookup from "Noblesville only" to "anywhere in the county." The address `LIKE` clause still narrows by street, and `resultRecordCount: 10` still caps results.

- [ ] **Step 1: Update the `buildQueryUrl` tests to expect no district filter**

In `lib/lookup/arcgis.test.ts`, replace the entire `describe('buildQueryUrl', ...)` block (lines 47–69) with:

```ts
describe('buildQueryUrl', () => {
  it('targets the county FeatureServer with an address-only LIKE clause', () => {
    const url = new URL(buildQueryUrl('1234 CONNER ST'));
    expect(url.hostname).toBe('services5.arcgis.com');
    const where = url.searchParams.get('where')!;
    expect(where).toContain("LIKE '%1234 CONNER ST%'");
    expect(where).not.toContain('TAXDISTNAM'); // county-wide now — no school-district filter
    expect(where.match(/'/g)).toHaveLength(2); // one address pattern, two delimiting quotes
    expect(url.searchParams.get('resultRecordCount')).toBe('10');
    expect(url.searchParams.get('returnGeometry')).toBe('false');
  });
  it('matches either variant when a normalized alternative differs from the raw term', () => {
    const url = new URL(buildQueryUrl('1234 CONNER STREET', '1234 CONNER ST'));
    const where = url.searchParams.get('where')!;
    expect(where).toContain("(UPPER(LOCADDRESS) LIKE '%1234 CONNER STREET%' OR UPPER(LOCADDRESS) LIKE '%1234 CONNER ST%')");
    expect(where).not.toContain('TAXDISTNAM');
    expect(where.match(/'/g)).toHaveLength(4);
  });
  it('keeps the single-condition clause when the normalized term is identical', () => {
    const url = new URL(buildQueryUrl('1234 CONNER ST', '1234 CONNER ST'));
    const where = url.searchParams.get('where')!;
    expect(where.match(/LOCADDRESS/g)).toHaveLength(1);
    expect(where.match(/'/g)).toHaveLength(2);
  });
});
```

Also update the four `searchParcels` quote-count assertions in the same file to match the filter-free clause:
- In `'sanitizes the term before building the query URL'` (single clause): change `toHaveLength(4)` to `toHaveLength(2)`.
- In `'queries both the raw term and the suffix-normalized term when they differ'` (OR clause): change `toHaveLength(6)` to `toHaveLength(4)` and remove any `TAXDISTNAM` expectation (there is none there, just the quote count).
- In `'keeps a single LOCADDRESS condition when normalization is a no-op'`: change `toHaveLength(4)` to `toHaveLength(2)`.
- In `'sanitizes injection attempts even when the OR-variant clause is used'`: change `toHaveLength(6)` to `toHaveLength(4)`.

Leave the `parseResponse` test asserting `taxDistrictName` matches `/noblesville/i` — the fixture is Noblesville parcels; that assertion is about the fixture, not the filter.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/lookup/arcgis.test.ts`
Expected: FAIL — current `buildQueryUrl` still appends `AND UPPER(TAXDISTNAM) LIKE '%NOBLESVILLE%'`, so `not.toContain('TAXDISTNAM')` and the quote counts fail.

- [ ] **Step 3: Remove the district filter from `buildQueryUrl`**

In `lib/lookup/arcgis.ts`, replace the `buildQueryUrl` function (and update its doc comment) so the `where` clause is address-only:

```ts
/**
 * When a suffix-normalized variant of the term is provided and differs from
 * the raw term, match EITHER variant, so input typed exactly as the county
 * stores it can never do worse than a plain substring search.
 *
 * The Hamilton County FeatureServer is already scoped to Hamilton County, so
 * no school-district filter is applied here — district resolution happens
 * after lookup, per candidate (see resolveTaxDistrict).
 */
export function buildQueryUrl(term: string, normalizedTerm: string = term): string {
  const where =
    normalizedTerm !== term
      ? `(UPPER(LOCADDRESS) LIKE '%${term}%' OR UPPER(LOCADDRESS) LIKE '%${normalizedTerm}%')`
      : `UPPER(LOCADDRESS) LIKE '%${term}%'`;
  const params = new URLSearchParams({
    where,
    outFields: OUT_FIELDS,
    resultRecordCount: '10',
    returnGeometry: 'false',
    f: 'json',
  });
  return `${ENDPOINT}?${params}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/lookup/arcgis.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add lib/lookup/arcgis.ts lib/lookup/arcgis.test.ts
git commit -m "feat(lookup): widen parcel query to all of Hamilton County"
```

---

### Task 2: County lookup seam — `CountyLookupSource`, Hamilton adapter, registry, route

**Files:**
- Create: `lib/lookup/types.ts`
- Create: `lib/lookup/counties/hamilton.ts`
- Create: `lib/lookup/counties/index.ts`
- Modify: `app/api/lookup/route.ts`
- Test: `lib/lookup/counties/hamilton.test.ts`
- Modify: `app/api/lookup/route.test.ts`

**Interfaces:**
- Consumes: `searchParcels`, `ParcelCandidate` from `./arcgis` (Task 1).
- Produces:
  - `interface CountyLookupSource { county: string; search(term: string): Promise<ParcelCandidate[]> }`
  - `export const hamilton: CountyLookupSource`
  - `export const COUNTY_SOURCES = { hamilton } as const`

- [ ] **Step 1: Write the failing test for the Hamilton adapter**

Create `lib/lookup/counties/hamilton.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { hamilton } from './hamilton';

describe('hamilton lookup source', () => {
  afterEach(() => vi.restoreAllMocks());

  it('identifies its county', () => {
    expect(hamilton.county).toBe('Hamilton');
  });

  it('delegates search to the county ArcGIS service and returns parsed candidates', async () => {
    const feature = {
      attributes: {
        PARCELNO: '160', STPRCLNO: '29', LOCADDRESS: '1234 CONNER ST', LOCCITY: 'Noblesville',
        LOCZIP: '46060', AVTOTGROSS: 350000, AVTAXYR: 2026, hmstd_code: 1,
        TAXDISTNAM: 'Noblesville City', PROPERTYREPORT: 'https://example.test/r',
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ features: [feature] }), { status: 200 }),
    ));
    const candidates = await hamilton.search('1234 conner st');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].taxDistrictName).toBe('Noblesville City');
    expect(candidates[0].grossAV).toBe(350000);
  });

  it('propagates upstream failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 500 })));
    await expect(hamilton.search('123 main st')).rejects.toThrow('upstream');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/lookup/counties/hamilton.test.ts`
Expected: FAIL — `./hamilton` does not exist.

- [ ] **Step 3: Create the interface, adapter, and registry**

Create `lib/lookup/types.ts`:

```ts
import type { ParcelCandidate } from './arcgis';

/**
 * A per-county parcel lookup source. Each county's GIS has its own endpoint,
 * field names, and query conventions; an adapter hides those behind a uniform
 * search(). Adding a county = one adapter + one registry entry.
 */
export interface CountyLookupSource {
  county: string;
  search(term: string): Promise<ParcelCandidate[]>;
}
```

Create `lib/lookup/counties/hamilton.ts`:

```ts
import type { CountyLookupSource } from '../types';
import { searchParcels } from '../arcgis';

/** Hamilton County, Indiana — backed by the county's public parcel FeatureServer. */
export const hamilton: CountyLookupSource = {
  county: 'Hamilton',
  search: (term) => searchParcels(term),
};
```

Create `lib/lookup/counties/index.ts`:

```ts
import { hamilton } from './hamilton';

/** Registry of county lookup sources. Add a county by adding one entry here. */
export const COUNTY_SOURCES = { hamilton } as const;

export type CountyId = keyof typeof COUNTY_SOURCES;
```

- [ ] **Step 4: Run to verify the adapter test passes**

Run: `npx vitest run lib/lookup/counties/hamilton.test.ts`
Expected: PASS.

- [ ] **Step 5: Point the API route at the county source**

In `app/api/lookup/route.ts`, replace the `searchParcels` import and its call with the county source. Change the import line:

```ts
import { sanitizeSearchTerm } from '@/lib/lookup/arcgis';
import { COUNTY_SOURCES } from '@/lib/lookup/counties';
import { getCached, setCached } from '@/lib/lookup/cache';
```

and change the `try` body's search call from `await searchParcels(term)` to:

```ts
    const candidates = await COUNTY_SOURCES.hamilton.search(term);
```

Leave everything else (privacy comment, sanitize, length gate, cache, error mapping) unchanged.

- [ ] **Step 6: Update the route test to mock at the county-source seam**

In `app/api/lookup/route.test.ts`, replace the mock setup (lines 3–11) with a mock of the county registry:

```ts
vi.mock('@/lib/lookup/counties', () => ({
  COUNTY_SOURCES: { hamilton: { county: 'Hamilton', search: vi.fn() } },
}));

import { POST } from './route';
import { COUNTY_SOURCES } from '@/lib/lookup/counties';

const mockSearch = vi.mocked(COUNTY_SOURCES.hamilton.search);
```

The rest of the file is unchanged — every `mockSearch` reference still resolves, and the route still sanitizes the term before calling `search`, so `expect(mockSearch).toHaveBeenCalledWith('1234 CONNER ST')` still holds.

- [ ] **Step 7: Run the route + lookup tests**

Run: `npx vitest run app/api/lookup lib/lookup`
Expected: PASS (route caching, error mapping, adapter, arcgis).

- [ ] **Step 8: Commit**

```bash
git add lib/lookup/types.ts lib/lookup/counties app/api/lookup/route.ts app/api/lookup/route.test.ts
git commit -m "feat(lookup): add CountyLookupSource seam with Hamilton adapter"
```

---

### Task 3: District resolver — `resolveTaxDistrict`

**Files:**
- Create: `lib/tax/indiana/districts/resolve.ts`
- Test: `lib/tax/indiana/districts/resolve.test.ts`

**Interfaces:**
- Consumes: `DISTRICTS` from `./index`, `findDistrict` from `../../engine`, `DistrictReferendumConfig`/`TaxDistrict` from `../../types`.
- Produces: `resolveTaxDistrict(taxDistrictName: string): { config: DistrictReferendumConfig; district: TaxDistrict } | null`.

- [ ] **Step 1: Write the failing test**

Create `lib/tax/indiana/districts/resolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveTaxDistrict } from './resolve';

describe('resolveTaxDistrict', () => {
  it('resolves a Noblesville taxing-district name to its config and rate row', () => {
    const r = resolveTaxDistrict('11 - Noblesville City');
    expect(r).not.toBeNull();
    expect(r!.config.id).toBe('noblesville');
    expect(r!.district.name).toBe('Noblesville City');
  });

  it('resolves GIS name variants (whitespace, casing)', () => {
    expect(resolveTaxDistrict('NOBLESVILLE TOWNSHIP')!.district.name).toBe('Noblesville Township');
    expect(resolveTaxDistrict('Noblesville Fall Creek')!.district.name).toBe('Noblesville–Fall Creek');
  });

  it('returns null for a district with no config (uncovered)', () => {
    expect(resolveTaxDistrict('Clay Township')).toBeNull();
    expect(resolveTaxDistrict('Carmel City')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/tax/indiana/districts/resolve.test.ts`
Expected: FAIL — `./resolve` does not exist.

- [ ] **Step 3: Implement the resolver**

Create `lib/tax/indiana/districts/resolve.ts`:

```ts
import type { DistrictReferendumConfig, TaxDistrict } from '../../types';
import { findDistrict } from '../../engine';
import { DISTRICTS } from './index';

/**
 * Resolve an ArcGIS TAXDISTNAM to the district config that owns it and the
 * specific tax-district rate row within that config. Returns null when no
 * registered district covers the name (an uncovered parcel).
 */
export function resolveTaxDistrict(
  taxDistrictName: string,
): { config: DistrictReferendumConfig; district: TaxDistrict } | null {
  for (const config of Object.values(DISTRICTS)) {
    const district = findDistrict(config, taxDistrictName);
    if (district) return { config, district };
  }
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/tax/indiana/districts/resolve.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tax/indiana/districts/resolve.ts lib/tax/indiana/districts/resolve.test.ts
git commit -m "feat(tax): add resolveTaxDistrict registry lookup"
```

---

### Task 4: County roster — naming uncovered districts (verified-only)

**Files:**
- Create: `lib/tax/indiana/counties/hamilton.ts`
- Create: `lib/tax/indiana/counties/index.ts`
- Test: `lib/tax/indiana/counties/hamilton.test.ts`

**Interfaces:**
- Consumes: `DistrictId`, `DISTRICTS` from `../districts`.
- Produces:
  - `interface CountySchoolDistrict { name: string; gisGate: RegExp; configId?: DistrictId }`
  - `export const HAMILTON: { name: string; schoolDistricts: CountySchoolDistrict[] }`
  - `export function nameUncoveredDistrict(taxDistrictName: string): string | null`
  - `export const COUNTIES = { hamilton: HAMILTON } as const`

Per the accuracy rule, the roster holds only verified entries — today, Noblesville alone. `nameUncoveredDistrict` therefore returns `null` for every non-Noblesville name (generic fallback in the UI), and Noblesville itself is always resolved by `resolveTaxDistrict` before this is consulted. The roster is the extension point: verified entries get added here as each district's `TAXDISTNAM` patterns are confirmed.

- [ ] **Step 1: Write the failing test**

Create `lib/tax/indiana/counties/hamilton.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HAMILTON, nameUncoveredDistrict } from './hamilton';
import { DISTRICTS } from '../districts';

describe('Hamilton county roster', () => {
  it('names the county', () => {
    expect(HAMILTON.name).toBe('Hamilton');
  });

  it('every roster configId points to a registered district config', () => {
    for (const d of HAMILTON.schoolDistricts) {
      if (d.configId) expect(DISTRICTS[d.configId]).toBeDefined();
    }
  });

  it('names a verified district from its TAXDISTNAM', () => {
    expect(nameUncoveredDistrict('11 - Noblesville City')).toBe('Noblesville Schools');
  });

  it('returns null for an unverified/unknown district (generic fallback)', () => {
    expect(nameUncoveredDistrict('Clay Township')).toBeNull();
    expect(nameUncoveredDistrict('Carmel City')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/tax/indiana/counties/hamilton.test.ts`
Expected: FAIL — `./hamilton` does not exist.

- [ ] **Step 3: Implement the roster**

Create `lib/tax/indiana/counties/hamilton.ts`:

```ts
import type { DistrictId } from '../districts';

export interface CountySchoolDistrict {
  name: string;          // public-facing school corporation name
  gisGate: RegExp;       // matched against ArcGIS TAXDISTNAM
  configId?: DistrictId; // present when full referendum data exists
}

/**
 * Hamilton County's school districts. Entries are added only once their
 * TAXDISTNAM → school-corporation mapping is verified against county parcel
 * data — a wrong name is worse than a generic "not covered" message, so
 * unverified districts are intentionally omitted (they fall through to the
 * generic message via nameUncoveredDistrict returning null).
 */
export const HAMILTON = {
  name: 'Hamilton',
  schoolDistricts: [
    { name: 'Noblesville Schools', gisGate: /noblesville/i, configId: 'noblesville' },
  ] as CountySchoolDistrict[],
};

/**
 * Friendly name for the school district a TAXDISTNAM belongs to, or null when
 * it isn't a verified Hamilton County district (caller shows a generic message).
 */
export function nameUncoveredDistrict(taxDistrictName: string): string | null {
  const match = HAMILTON.schoolDistricts.find((d) => d.gisGate.test(taxDistrictName));
  return match ? match.name : null;
}
```

Create `lib/tax/indiana/counties/index.ts`:

```ts
import { HAMILTON } from './hamilton';

/** Registry of Indiana counties covered by this tool. */
export const COUNTIES = { hamilton: HAMILTON } as const;

export type CountyId = keyof typeof COUNTIES;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/tax/indiana/counties/hamilton.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tax/indiana/counties
git commit -m "feat(tax): add Hamilton county roster for uncovered-district naming"
```

---

### Task 5: `Results.tsx` takes a config prop and renders optional fields conditionally

**Files:**
- Modify: `components/Results.tsx` (full rewrite of props + optional-field handling + district header)
- Test: `components/Results.test.tsx`

**Interfaces:**
- Consumes: `DistrictReferendumConfig`, `TaxDistrict`, `BillBreakdown` from `@/lib/tax/types`; `buildScenarios`, `computeAllScenarios` from `@/lib/tax/scenarios`; `CIRCUIT_BREAKER_RATE`, `HOMESTEAD_CREDIT` from `@/lib/tax/indiana/assumptions`.
- Produces: `Results` default export with props `{ config: DistrictReferendumConfig; addressLabel: string | null; grossAV: number; district: TaxDistrict; homestead: boolean; assessmentYear: number | null; propertyReportUrl: string | null }`.

This removes the module-level `NOBLESVILLE` constants and the `!` non-null assertions. Because `debt`/`debtEndYear`/`committed2027` are optional on the config, the debt math row, the committed-rate copy, and the committed footnote render only when present. `buildScenarios` already makes `passCommitted` fall back to `proposedMax` when there's no commitment, so the pass-card total and pass-vs-fail delta work unchanged either way — only the explanatory copy branches on `committed`.

- [ ] **Step 1: Update the Results tests (config prop + district header + minimal-config render)**

Replace `components/Results.test.tsx` with:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Results from './Results';
import { findDistrict } from '@/lib/tax/engine';
import { NOBLESVILLE } from '@/lib/tax/indiana/districts/noblesville';
import type { DistrictReferendumConfig } from '@/lib/tax/types';

const city = findDistrict(NOBLESVILLE, 'Noblesville City')!;

function renderCity(extra: Partial<React.ComponentProps<typeof Results>> = {}) {
  return render(
    <Results
      config={NOBLESVILLE}
      addressLabel="1234 Conner St"
      grossAV={350000}
      district={city}
      homestead={true}
      assessmentYear={2026}
      propertyReportUrl={null}
      {...extra}
    />,
  );
}

describe('<Results>', () => {
  it('leads with a district-specific header naming the address and district', () => {
    renderCity();
    expect(screen.getByRole('heading', { name: /1234 Conner St.*Noblesville Schools/i })).toBeInTheDocument();
  });

  it('renders all three scenario totals for a $350k city homestead', () => {
    renderCity();
    expect(screen.getByText('$4,015')).toBeInTheDocument();   // current
    expect(screen.getByText('$4,020')).toBeInTheDocument();   // pass at committed 0.41
    expect(screen.getByText('$3,334')).toBeInTheDocument();   // fail
    expect(screen.getAllByText(/\$4,288/).length).toBeGreaterThan(0);  // pass at authorized max
  });

  it('shows the pass-vs-fail difference in $/yr and $/mo', () => {
    renderCity();
    expect(screen.getByText(/\+\$686/)).toBeInTheDocument();      // 686.34/yr
    expect(screen.getByText(/\$57\.20/)).toBeInTheDocument();     // per month
  });

  it('shows a non-homestead notice when homestead is false', () => {
    renderCity({ homestead: false });
    expect(screen.getByText(/assumes an owner-occupied homestead/i)).toBeInTheDocument();
  });

  it('exposes the math breakdown with net AV and cap figures', () => {
    renderCity();
    expect(screen.getByText(/how this was calculated/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\$181,200/).length).toBeGreaterThan(0); // pay-2026 net AV
    expect(screen.getAllByText(/\$167,400/).length).toBeGreaterThan(0); // pay-2027 net AV
  });

  it('renders a minimal config (no debt, no committed2027) without crashing or a debt row', () => {
    const minimal: DistrictReferendumConfig = {
      id: 'minimal', name: 'Minimal Schools', county: 'Test', sources: {},
      referendum: { proposedMax: { value: 0.25, source: 'https://example.test/ballot', status: 'confirmed' } },
      gisGate: /minimal/i,
      taxDistricts: [{ name: 'Minimal Township', match: /township/i, totalRate2026: 2.0 }],
    };
    render(
      <Results
        config={minimal}
        addressLabel={null}
        grossAV={350000}
        district={minimal.taxDistricts[0]}
        homestead={true}
        assessmentYear={null}
        propertyReportUrl={null}
      />,
    );
    expect(screen.getByRole('heading', { name: /Minimal Schools/i })).toBeInTheDocument();
    expect(screen.queryByText(/referendum debt tax/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/committed 2027 rate/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/Results.test.tsx`
Expected: FAIL — `Results` doesn't accept `config`/`addressLabel` and has no header heading.

- [ ] **Step 3: Rewrite `components/Results.tsx`**

Replace the whole file with:

```tsx
import type { BillBreakdown, DistrictReferendumConfig, TaxDistrict } from '@/lib/tax/types';
import { buildScenarios, computeAllScenarios } from '@/lib/tax/scenarios';
import { CIRCUIT_BREAKER_RATE, HOMESTEAD_CREDIT } from '@/lib/tax/indiana/assumptions';
import { fmtCents, fmtDelta, fmtDollars } from '@/lib/format';

interface Props {
  config: DistrictReferendumConfig;
  addressLabel: string | null;
  grossAV: number;
  district: TaxDistrict;
  homestead: boolean;
  assessmentYear: number | null;
  propertyReportUrl: string | null;
}

function MathRows({ b, config }: { b: BillBreakdown; config: DistrictReferendumConfig }) {
  const { debt, debtEndYear } = config.referendum;
  const rows: Array<[string, string]> = [
    ['Gross assessed value', fmtCents(b.grossAV)],
    ['− Standard homestead deduction', fmtCents(b.standardDeduction)],
    ['− Supplemental homestead deduction', fmtCents(b.supplementalDeduction)],
    ['= Net assessed value', fmtCents(b.netAV)],
    [`Non-referendum tax (rate ${b.nonReferendumRate.toFixed(4)} per $100)`, fmtCents(b.nonReferendumGross)],
    [`Circuit breaker cap (${CIRCUIT_BREAKER_RATE.value * 100}% of gross AV)`, fmtCents(b.circuitBreakerCap)],
    ['− Circuit breaker credit', fmtCents(b.circuitBreakerCredit)],
    [`− Supplemental homestead credit (${HOMESTEAD_CREDIT.value.rate * 100}%, max $${HOMESTEAD_CREDIT.value.max})`, fmtCents(b.supplementalHomesteadCredit)],
    ['= Non-referendum tax after credits', fmtCents(b.nonReferendumNet)],
    ['+ School referendum operating tax', fmtCents(b.referendumOperatingTax)],
  ];
  if (debt) {
    const through = debtEndYear ? `, through ${debtEndYear.value}` : '';
    rows.push([`+ School referendum debt tax ($${debt.value.toFixed(2)}${through})`, fmtCents(b.referendumDebtTax)]);
  }
  rows.push(['Total estimated bill', fmtCents(b.total)]);
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-border">
            <td className="py-1 pr-4">{label}</td>
            <td className="py-1 text-right font-mono tabular-nums">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Results({
  config, addressLabel, grossAV, district, homestead, assessmentYear, propertyReportUrl,
}: Props) {
  const REFERENDUM = config.referendum;
  const SOURCES = config.sources;
  const SCENARIOS = buildScenarios(config);
  const committed = REFERENDUM.committed2027;
  const r = computeAllScenarios(grossAV, district, config);
  const passVsFail = r.passCommitted.total - r.fail.total;
  const passVsFailMax = r.passMax.total - r.fail.total;

  return (
    <section aria-label="Estimated property tax comparison" className="space-y-6">
      <header className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">
          {addressLabel
            ? `Estimated property taxes for ${addressLabel} — ${config.name}`
            : `Estimated property taxes — ${config.name}`}
        </h2>
        <p className="mt-1 text-xs text-muted">
          These figures are specific to the {config.name} district ({config.county} County). An address in
          a different district would see different rates and a different result.
        </p>
      </header>

      {!homestead && (
        <p className="rounded-md border border-warning-border bg-warning-bg p-3 text-sm text-warning-fg">
          County records do not show a homestead deduction for this parcel. This estimate
          assumes an owner-occupied homestead and will not match bills for rentals or second homes.
        </p>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <li className="rounded-md border border-border bg-surface p-4">
          <div className="font-medium">Current<br /><span className="font-normal text-xs text-muted">pay-2026</span></div>
          <p className="mt-2 text-xs text-muted">Estimated annual bill</p>
          <div className="text-lg font-mono tabular-nums">{fmtDollars(r.current.total)}</div>
          <p className="mt-2 text-xs text-muted">Change vs. current bill</p>
          <div className="font-mono tabular-nums">—</div>
        </li>
        <li className="rounded-md border border-border bg-surface p-4">
          <div className="font-medium">If it passes<br /><span className="font-normal text-xs text-muted">pay-2027 est.</span></div>
          <p className="mt-2 text-xs text-muted">Estimated annual bill</p>
          <div className="text-lg font-mono tabular-nums">{fmtDollars(r.passCommitted.total)}</div>
          <div className="mt-1 text-xs text-muted">
            {committed
              ? <>at {config.name}&rsquo;s committed 2027 rate (${committed.value.toFixed(2)}); up to {fmtDollars(r.passMax.total)} if the full authorized ${REFERENDUM.proposedMax.value.toFixed(2)} were levied</>
              : <>at the authorized maximum rate (${REFERENDUM.proposedMax.value.toFixed(2)})</>}
          </div>
          <p className="mt-2 text-xs text-muted">Change vs. current bill</p>
          <div className="font-mono tabular-nums">{fmtDelta(r.passCommitted.total - r.current.total)}/yr</div>
        </li>
        <li className="rounded-md border border-border bg-surface p-4">
          <div className="font-medium">If it fails<br /><span className="font-normal text-xs text-muted">pay-2027 est.</span></div>
          <p className="mt-2 text-xs text-muted">Estimated annual bill</p>
          <div className="text-lg font-mono tabular-nums">{fmtDollars(r.fail.total)}</div>
          <p className="mt-2 text-xs text-muted">Change vs. current bill</p>
          <div className="font-mono tabular-nums">{fmtDelta(r.fail.total - r.current.total)}/yr</div>
        </li>
      </ul>

      <div className="rounded-md border border-border bg-surface p-4">
        <h2 className="font-medium">Difference between {config.name} passing and failing</h2>
        <p className="mt-1 tabular-nums">
          {committed
            ? <><span className="text-lg font-mono">{fmtDelta(passVsFail)}/yr</span>{' '}({fmtCents(passVsFail / 12)}/mo) at the committed 2027 rate;{' '}{fmtDelta(passVsFailMax)}/yr ({fmtCents(passVsFailMax / 12)}/mo) at the authorized maximum.</>
            : <><span className="text-lg font-mono">{fmtDelta(passVsFailMax)}/yr</span>{' '}({fmtCents(passVsFailMax / 12)}/mo) at the authorized maximum rate.</>}
        </p>
      </div>

      <details className="rounded-md border border-border bg-surface p-4">
        <summary className="cursor-pointer font-medium">How this was calculated</summary>
        <div className="mt-4 space-y-6">
          {([r.current, r.passCommitted, r.passMax, r.fail] as const).map((b) => (
            <div key={b.scenario}>
              <h3 className="mb-2 font-medium">{SCENARIOS[b.scenario].label}</h3>
              <MathRows b={b} config={config} />
            </div>
          ))}
          <div className="text-xs text-muted space-y-1">
            <p>
              These figures come from the {config.name} referendum determination and the district&rsquo;s
              published rates and commitments.
            </p>
            {committed && (
              <p>
                The ${committed.value.toFixed(2)} figure is the district&rsquo;s public commitment for 2027 only — it is not legally
                binding, and later years may be set higher, up to the authorized ${REFERENDUM.proposedMax.value.toFixed(2)}.{' '}
                <a className="text-accent underline" href={committed.source}>Source</a>.
              </p>
            )}
            <p>
              Pay-2027 non-referendum rates are not certified until January 2027; this estimate holds them
              at certified pay-2026 levels.
              {SOURCES.budgetOrder2026 ? <> <a className="text-accent underline" href={SOURCES.budgetOrder2026}>2026 budget order</a>.</> : null}
            </p>
            {assessmentYear != null && (
              <p>
                County gross assessed value is from the {assessmentYear} assessment. The &ldquo;current&rdquo;
                column applies pay-2026 rules to that value, so it may differ slightly from your actual 2026 bill.
              </p>
            )}
            {propertyReportUrl && (
              <p><a className="text-accent underline" href={propertyReportUrl}>Official county property report for this parcel</a></p>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run components/Results.test.tsx`
Expected: PASS (including the minimal-config render).

- [ ] **Step 5: Commit**

```bash
git add components/Results.tsx components/Results.test.tsx
git commit -m "feat(ui): Results takes a district config prop and names the district"
```

---

### Task 6: `Calculator.tsx` resolves the district and shows the covered/uncovered states

**Files:**
- Modify: `components/Calculator.tsx`

**Interfaces:**
- Consumes: `resolveTaxDistrict` from `@/lib/tax/indiana/districts/resolve`; `nameUncoveredDistrict` from `@/lib/tax/indiana/counties/hamilton`; `NOBLESVILLE` from `@/lib/tax/indiana/districts/noblesville` (manual path only); `ParcelCandidate` from `@/lib/lookup/arcgis`; `DistrictReferendumConfig`, `TaxDistrict` from `@/lib/tax/types`; `Results` (Task 5).
- Produces: no new exports; wires resolution into the existing lookup/manual flow.

There are no component tests for `Calculator` today; this task is verified by typecheck, the existing suite staying green, and a manual smoke in Task 7's verification. Keep changes minimal and mechanical.

- [ ] **Step 1: Update imports and the `Selection` type**

In `components/Calculator.tsx`, replace the import block (lines 3–9) with:

```tsx
import { useState } from 'react';
import type { ParcelCandidate } from '@/lib/lookup/arcgis';
import { resolveTaxDistrict } from '@/lib/tax/indiana/districts/resolve';
import { nameUncoveredDistrict } from '@/lib/tax/indiana/counties/hamilton';
import { NOBLESVILLE } from '@/lib/tax/indiana/districts/noblesville';
import type { DistrictReferendumConfig, TaxDistrict } from '@/lib/tax/types';
import { fmtDollars } from '@/lib/format';
import Results from './Results';
```

Replace the `Selection` type (lines 11–13) so each selection carries its resolved config:

```tsx
type Selection =
  | { kind: 'parcel'; parcel: ParcelCandidate; config: DistrictReferendumConfig; district: TaxDistrict }
  | { kind: 'manual'; grossAV: number; config: DistrictReferendumConfig; district: TaxDistrict };
```

- [ ] **Step 2: Replace the `outOfDistrict` boolean state with an uncovered-district state**

Replace the state declaration `const [outOfDistrict, setOutOfDistrict] = useState(false);` (line 24) with:

```tsx
  // null = covered/none; { name } = uncovered (name is the district name when
  // verified, or null for the generic "not covered" message).
  const [uncovered, setUncovered] = useState<{ name: string | null } | null>(null);
```

Then update the reset at the top of `lookup` (line 28): change `setOutOfDistrict(false);` to `setUncovered(null);`.

- [ ] **Step 3: Rewrite `select` to resolve the district and set the page title**

Replace the `select` function (lines 54–59) with:

```tsx
  function select(parcel: ParcelCandidate) {
    const resolved = resolveTaxDistrict(parcel.taxDistrictName);
    if (!resolved) {
      setUncovered({ name: nameUncoveredDistrict(parcel.taxDistrictName) });
      setSelection(null);
      return;
    }
    setUncovered(null);
    setSelection({ kind: 'parcel', parcel, config: resolved.config, district: resolved.district });
    document.title = `${resolved.config.name} referendum — property tax estimate`;
  }
```

- [ ] **Step 4: Update `calculateManual` to carry the Noblesville config**

In `calculateManual` (lines 61–72), the manual path stays Noblesville-scoped (only district with data). Update the two `setOutOfDistrict(false)` calls to `setUncovered(null)`, and set the selection with the config:

```tsx
  function calculateManual(e: React.FormEvent) {
    e.preventDefault();
    const grossAV = Number(manualAV.replace(/[,$\s]/g, ''));
    const district = NOBLESVILLE.taxDistricts.find((d) => d.name === manualDistrict);
    if (!Number.isFinite(grossAV) || grossAV <= 0 || grossAV > 50_000_000 || !district) {
      setError('Enter a gross assessed value between $1 and $50,000,000.');
      setUncovered(null); setSelection(null);
      return;
    }
    setError(null); setUncovered(null);
    setSelection({ kind: 'manual', grossAV, config: NOBLESVILLE, district });
  }
```

- [ ] **Step 5: Generalize the "no matches" copy and the uncovered message, and pass config to `Results`**

Replace the "no matching parcels" paragraph (lines 122–127) with county-level copy:

```tsx
      {candidates && candidates.length === 0 && (
        <p className="text-sm">
          No matching parcels found in Hamilton County. Check the spelling, try just the street
          number and name, or enter your assessed value manually above.
        </p>
      )}
```

Replace the `outOfDistrict` block (lines 141–147) with the uncovered block:

```tsx
      {uncovered && (
        <p role="alert" className="rounded-md border border-border bg-surface p-3 text-sm">
          {uncovered.name
            ? `We found your parcel, but it's in the ${uncovered.name} district, which this tool doesn't cover yet. That district's school rates differ, so these numbers wouldn't apply.`
            : `We found your parcel in Hamilton County, but it isn't in a school district this tool covers yet. Its school rates differ, so these numbers wouldn't apply.`}
        </p>
      )}
```

Replace the two `Results` render blocks (lines 149–161) so they pass `config` and `addressLabel`:

```tsx
      {selection?.kind === 'parcel' && (
        <Results
          config={selection.config}
          addressLabel={selection.parcel.address}
          grossAV={selection.parcel.grossAV}
          district={selection.district}
          homestead={selection.parcel.homestead}
          assessmentYear={selection.parcel.assessmentYear || null}
          propertyReportUrl={selection.parcel.propertyReportUrl || null}
        />
      )}
      {selection?.kind === 'manual' && (
        <Results
          config={selection.config}
          addressLabel={null}
          grossAV={selection.grossAV}
          district={selection.district}
          homestead={true}
          assessmentYear={null}
          propertyReportUrl={null}
        />
      )}
```

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean typecheck; all tests pass (79 prior + new tests from Tasks 1–5).

- [ ] **Step 7: Commit**

```bash
git add components/Calculator.tsx
git commit -m "feat(ui): resolve district from address and show covered/uncovered states"
```

---

### Task 7: Landing copy + README, and end-to-end verification

**Files:**
- Modify: `app/page.tsx`
- Modify: `README.md`

**Interfaces:** none (copy + docs).

- [ ] **Step 1: Reword the landing intro so neighboring-district visitors aren't surprised**

In `app/page.tsx`, keep the H1 as-is (Noblesville-centric per the design decision) and add one sentence to the intro paragraph. Replace the intro `<p>` (lines 11–16) with:

```tsx
        <p className="text-sm text-muted">
          On November 3, 2026, Noblesville voters will decide an operating referendum for Noblesville
          Schools. Enter your address to see an estimate of your property tax bill today, if the
          referendum passes, and if it fails — with every number sourced and every step of the math shown.
          This tool currently has data for the Noblesville Schools district; if your address is in a
          neighboring Hamilton County district, it will tell you.{' '}
          <Link className="text-accent underline" href="/methodology">How these estimates work</Link>.
        </p>
```

- [ ] **Step 2: Update the README "Adding a district" section**

In `README.md`, extend the "Adding a district" section so it reflects the resolver, the county roster, and the county lookup seam. Add these two points to the existing numbered list (after the config-file step):

```markdown
- Add a **verified** roster entry for the district in its county file
  (`lib/tax/indiana/counties/<county>.ts`) with a `configId` linking it to the
  config. Only add the entry once its `TAXDISTNAM` pattern is confirmed against
  real county parcels — a wrong name is worse than the generic "not covered"
  message. `resolveTaxDistrict` then matches parcels to the config automatically.
- A new **county** needs a `CountyLookupSource` adapter under
  `lib/lookup/counties/` plus one entry in `lib/lookup/counties/index.ts`
  (`COUNTY_SOURCES`). Existing counties need no lookup changes.
```

- [ ] **Step 3: Full verification — typecheck, lint, tests**

Run: `npx tsc --noEmit && npx eslint . && npm test`
Expected: typecheck clean; eslint reports only the pre-existing `app/layout.tsx` issue (untouched by this work); all tests pass.

- [ ] **Step 4: Manual smoke of the running app**

Run: `npm run dev` and open the app. Verify:
- A Noblesville address (e.g. a Conner St address) resolves and the results header reads "Estimated property taxes for … — Noblesville Schools"; the browser tab title updates to name Noblesville Schools.
- The manual-entry path still calculates and shows the district header.
- If you can find a non-Noblesville Hamilton address, selecting it shows the generic "found your parcel in Hamilton County, but it isn't in a school district this tool covers yet" message (no crash, no wrong district name).

Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx README.md
git commit -m "docs+ui: multi-district landing copy and README guidance"
```

---

## Self-Review Notes

- **Spec coverage:** County lookup seam → Tasks 1–2. District resolution → Task 3. County roster / uncovered naming (verified-only) → Task 4. `Results` config prop + conditional optional fields (seam removal) → Task 5. Cue 1 (district header) → Task 5. Cue 2 (district name in scenario/summary copy) → Task 5. Cue 3 (dynamic `document.title` + Noblesville-centric H1) → Tasks 6–7. Cue 4 (sources panel names district) → Task 5. Data-flow covered/uncovered branching → Task 6. Manual path stays Noblesville-scoped → Task 6. README/docs → Task 7. Noblesville numeric identity → guarded by unchanged anchored tests throughout.
- **Type consistency:** `resolveTaxDistrict` returns `{ config, district }` (Task 3) and is consumed with those exact names in Task 6. `CountyLookupSource.search` (Task 2) matches the route call and the adapter. `nameUncoveredDistrict(name): string | null` (Task 4) is consumed as `{ name: string | null }` state in Task 6. `Results` prop shape (Task 5) matches both render sites in Task 6.
- **Boundary discipline:** `resolve.ts` and the county roster live under `lib/tax/` and import no GIS code; `lib/lookup/` imports no referendum math. The only cross-reference is the UI layer (`Calculator`) wiring the two together, which is correct.
