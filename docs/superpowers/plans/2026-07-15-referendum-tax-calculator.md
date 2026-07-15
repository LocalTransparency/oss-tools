# Noblesville Referendum Tax Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js web app where a Noblesville homeowner enters their address, gets their gross assessed value from Hamilton County's public ArcGIS parcel layer, and sees a neutral, fully-sourced comparison of their estimated property tax bill under three scenarios: current (pay-2026), referendum passes (pay-2027), referendum fails (pay-2027).

**Architecture:** Pure TypeScript tax engine (`lib/tax/`) with a single sourced assumptions file; one API route proxying address search to the county ArcGIS endpoint; React UI that computes scenarios client-side from the engine. Spec: `docs/superpowers/specs/2026-07-15-referendum-tax-app-design.md`.

**Tech Stack:** Next.js (App Router, TypeScript, Tailwind), Vitest + React Testing Library, Playwright, AWS Amplify Hosting.

## Global Constraints

- **Neutral copy everywhere.** No advocacy language; no red/green judgment coloring on pass/fail columns. Required footer line (verbatim): *"This site is not affiliated with Noblesville Schools or any campaign. Estimates only — not a bill. No addresses or lookups are stored."*
- **No address logging.** The lookup route must never log the query string or results.
- **Every displayed figure traces to `lib/tax/assumptions.ts`.** No literal tax numbers in components.
- **Key figures (from spec, verbatim):** pay-2026 standard deduction **$48,000**, supplemental **40%**; pay-2027 standard **$40,000**, supplemental **46%**; supplemental deduction capped at **75% of gross AV**; circuit breaker **1% of gross AV** (non-referendum only); supplemental homestead credit **min(10% of post-cap non-referendum liability, $300)**, referendum excluded; current referendum **$0.37 op + $0.08 debt**; proposed **$0.57 max / $0.41 committed for 2027**; debt rate **$0.08 continues through 2032 in all scenarios except it is the ONLY referendum tax in "fail"**; district totals (pay-2026 certified): Noblesville City **2.5549**, Noblesville Township **1.8444**, Noblesville–Delaware **2.4813**, Noblesville–Wayne **2.4737**, Noblesville–Fall Creek **2.4503**; non-referendum rate = total − 0.45, held at 2026 levels for pay-2027 scenarios (status `estimated`).
- **Display:** annual amounts as whole dollars (`$4,015`), monthly with cents (`$57.20`), math section with cents.
- TypeScript strict mode. Node 20+.

---

### Task 1: Scaffold Next.js app with test tooling

**Files:**
- Create: Next.js scaffold (app/, package.json, tsconfig.json, etc.)
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Modify: `package.json` (test scripts)

**Interfaces:**
- Consumes: nothing (greenfield; `docs/` and `.git` already exist and must be preserved)
- Produces: `npm run test` (Vitest), `npm run dev`, `@/*` path alias used by all later tasks

- [ ] **Step 1: Scaffold Next.js in place**

```bash
cd /Users/dmcnelis/NoblesvilleSchools
npx create-next-app@latest . --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*" --use-npm --yes
```

If create-next-app refuses because the directory is non-empty, scaffold to a temp dir and move everything except `docs/` and `.git/` back:

```bash
npx create-next-app@latest /tmp/nsref --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*" --use-npm --yes
rsync -a --exclude .git /tmp/nsref/ /Users/dmcnelis/NoblesvilleSchools/
rm -rf /tmp/nsref
```

- [ ] **Step 2: Install test tooling**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['lib/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 4: Create `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Add scripts to `package.json`**

In the `"scripts"` block add:

```json
"test": "vitest run",
"test:watch": "vitest",
"e2e": "playwright test"
```

- [ ] **Step 6: Sanity check**

Run: `npm run test`
Expected: "No test files found" exit (or 0 tests) — tooling wired, nothing broken.
Run: `npm run build`
Expected: successful production build of the scaffold.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and Playwright tooling"
```

---

### Task 2: Tax types and sourced assumptions

**Files:**
- Create: `lib/tax/types.ts`
- Create: `lib/tax/assumptions.ts`
- Test: `lib/tax/assumptions.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces (used by every later task):
  - Types: `ScenarioId`, `ScenarioParams`, `TaxDistrict`, `BillBreakdown`, `Sourced<T>`
  - Values: `SOURCES`, `DEDUCTIONS`, `CIRCUIT_BREAKER_RATE`, `SUPP_DEDUCTION_CAP_RATE`, `HOMESTEAD_CREDIT`, `REFERENDUM`, `CURRENT_REFERENDUM_TOTAL`, `DISTRICTS`, `SCENARIOS`
  - Functions: `findDistrict(taxDistrictName: string): TaxDistrict | null`, `nonReferendumRate(d: TaxDistrict): number`

- [ ] **Step 1: Create `lib/tax/types.ts`**

```ts
export type ScenarioId = 'current' | 'passCommitted' | 'passMax' | 'fail';

export interface ScenarioParams {
  id: ScenarioId;
  label: string;
  payYear: 2026 | 2027;
  standardDeduction: number;
  supplementalRate: number;        // fraction of post-standard remainder, e.g. 0.46
  referendumOperatingRate: number; // per $100 net AV
  referendumDebtRate: number;      // per $100 net AV
}

export interface TaxDistrict {
  name: string;
  match: RegExp;        // matched against ArcGIS TAXDISTNAM
  totalRate2026: number; // certified pay-2026 total, per $100
}

export interface BillBreakdown {
  scenario: ScenarioId;
  grossAV: number;
  standardDeduction: number;
  supplementalDeduction: number;
  netAV: number;
  nonReferendumRate: number;       // per $100
  nonReferendumGross: number;
  circuitBreakerCap: number;       // 1% of gross AV
  circuitBreakerCredit: number;
  supplementalHomesteadCredit: number;
  nonReferendumNet: number;
  referendumOperatingTax: number;
  referendumDebtTax: number;
  referendumTax: number;
  total: number;
}
```

- [ ] **Step 2: Write the failing test `lib/tax/assumptions.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  DISTRICTS, SCENARIOS, CURRENT_REFERENDUM_TOTAL,
  nonReferendumRate, findDistrict, HOMESTEAD_CREDIT, CIRCUIT_BREAKER_RATE,
} from './assumptions';

describe('assumptions integrity', () => {
  it('has five districts, each with a positive non-referendum rate', () => {
    expect(DISTRICTS).toHaveLength(5);
    for (const d of DISTRICTS) {
      expect(nonReferendumRate(d)).toBeGreaterThan(0);
    }
  });

  it('non-referendum rate = certified total minus 0.45', () => {
    const city = findDistrict('Noblesville City')!;
    expect(city.totalRate2026).toBeCloseTo(2.5549, 4);
    expect(nonReferendumRate(city)).toBeCloseTo(2.1049, 4);
    expect(CURRENT_REFERENDUM_TOTAL.value).toBeCloseTo(0.45, 4);
  });

  it('matches district name variants from GIS', () => {
    expect(findDistrict('11 - Noblesville City')?.name).toBe('Noblesville City');
    expect(findDistrict('NOBLESVILLE TOWNSHIP')?.name).toBe('Noblesville Township');
    expect(findDistrict('Noblesville Fall Creek')?.name).toBe('Noblesville–Fall Creek');
    expect(findDistrict('Noblesville Wayne')?.name).toBe('Noblesville–Wayne');
    expect(findDistrict('Noblesville Delaware')?.name).toBe('Noblesville–Delaware');
    expect(findDistrict('Carmel City')).toBeNull();
  });

  it('scenario parameters match the spec', () => {
    expect(SCENARIOS.current).toMatchObject({
      payYear: 2026, standardDeduction: 48000, supplementalRate: 0.40,
      referendumOperatingRate: 0.37, referendumDebtRate: 0.08,
    });
    expect(SCENARIOS.passCommitted).toMatchObject({
      payYear: 2027, standardDeduction: 40000, supplementalRate: 0.46,
      referendumOperatingRate: 0.41, referendumDebtRate: 0.08,
    });
    expect(SCENARIOS.passMax.referendumOperatingRate).toBe(0.57);
    expect(SCENARIOS.fail).toMatchObject({ referendumOperatingRate: 0, referendumDebtRate: 0.08 });
  });

  it('every sourced value cites an http source', () => {
    expect(CURRENT_REFERENDUM_TOTAL.source).toMatch(/^https?:\/\//);
    expect(HOMESTEAD_CREDIT.source).toMatch(/^https?:\/\//);
    expect(CIRCUIT_BREAKER_RATE.source).toMatch(/^https?:\/\//);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/tax/assumptions.test.ts`
Expected: FAIL — cannot resolve `./assumptions`.

- [ ] **Step 4: Create `lib/tax/assumptions.ts`**

```ts
import type { ScenarioId, ScenarioParams, TaxDistrict } from './types';

export interface Sourced<T> {
  value: T;
  source: string;
  status: 'confirmed' | 'estimated' | 'public-commitment';
  note?: string;
}

export const SOURCES = {
  budgetOrder2026:
    'https://www.in.gov/dlgf/files/2026-reports/2026-budget-orders/Hamilton-260115-2026-Budget-Order.pdf',
  countyRateSheet2026:
    'https://www.hamiltoncounty.in.gov/DocumentCenter/View/31240/2026-District-Rates-PDF',
  dlgfDetermination:
    'https://www.in.gov/dlgf/files/referendum-documentation2/2026-november-referendum-documents/26-015-Noblesville-Schools-Operating-Determination.pdf',
  sea1Memo:
    'https://www.in.gov/dlgf/files/2025-memos/250612-Cockerill-Memo-Legislation-Affecting-Deductions,-Exemptions,-and-Credits.pdf',
  districtReferendumPage: 'https://www.noblesvilleschools.org/referendum',
} as const;

/** SEA 1 (2025) homestead deduction schedule, by pay year. */
export const DEDUCTIONS: Record<2026 | 2027, Sourced<{ standard: number; supplementalRate: number }>> = {
  2026: { value: { standard: 48000, supplementalRate: 0.40 }, source: SOURCES.sea1Memo, status: 'confirmed' },
  2027: { value: { standard: 40000, supplementalRate: 0.46 }, source: SOURCES.sea1Memo, status: 'confirmed' },
};

/** Supplemental deduction may not exceed 75% of gross AV (IC 6-1.1-12-37.5). */
export const SUPP_DEDUCTION_CAP_RATE: Sourced<number> = {
  value: 0.75, source: SOURCES.sea1Memo, status: 'confirmed',
};

/** 1% homestead circuit breaker cap; referendum taxes are outside the cap. */
export const CIRCUIT_BREAKER_RATE: Sourced<number> = {
  value: 0.01, source: SOURCES.sea1Memo, status: 'confirmed',
  note: 'Applies to non-referendum liability only; referendum rates are exempt from the cap.',
};

/** Supplemental homestead credit: min(10% of liability, $300), referendum taxes excluded (IC 6-1.1-20.6-7.7). */
export const HOMESTEAD_CREDIT: Sourced<{ rate: number; max: number }> = {
  value: { rate: 0.10, max: 300 }, source: SOURCES.sea1Memo, status: 'confirmed',
  note: 'Applied after circuit breaker credits; referendum taxes excluded from the calculation.',
};

export const REFERENDUM = {
  currentOperating: {
    value: 0.37, source: SOURCES.countyRateSheet2026, status: 'confirmed',
    note: '2018 operating referendum; last levy pay-2026.',
  } as Sourced<number>,
  debt: {
    value: 0.08, source: SOURCES.countyRateSheet2026, status: 'confirmed',
    note: '2010 referendum debt; continues through 2032 regardless of the 2026 vote.',
  } as Sourced<number>,
  proposedMax: {
    value: 0.57, source: SOURCES.dlgfDetermination, status: 'confirmed',
    note: 'Ballot-authorized maximum rate; max annual levy $43,842,578; up to 8 years.',
  } as Sourced<number>,
  committed2027: {
    value: 0.41, source: SOURCES.districtReferendumPage, status: 'public-commitment',
    note: 'District public commitment for 2027 only; not legally binding; later years may be higher, up to $0.57.',
  } as Sourced<number>,
};

export const CURRENT_REFERENDUM_TOTAL: Sourced<number> = {
  value: REFERENDUM.currentOperating.value + REFERENDUM.debt.value, // 0.45
  source: SOURCES.countyRateSheet2026, status: 'confirmed',
};

/** Certified pay-2026 total district rates (DLGF budget order). Match patterns are tested against ArcGIS TAXDISTNAM. */
export const DISTRICTS: TaxDistrict[] = [
  { name: 'Noblesville–Fall Creek', match: /fall\s*creek/i, totalRate2026: 2.4503 },
  { name: 'Noblesville–Delaware', match: /delaware/i, totalRate2026: 2.4813 },
  { name: 'Noblesville–Wayne', match: /wayne/i, totalRate2026: 2.4737 },
  { name: 'Noblesville City', match: /city/i, totalRate2026: 2.5549 },
  { name: 'Noblesville Township', match: /township|twp/i, totalRate2026: 1.8444 },
];

export function findDistrict(taxDistrictName: string): TaxDistrict | null {
  if (!/noblesville/i.test(taxDistrictName)) return null;
  return DISTRICTS.find((d) => d.match.test(taxDistrictName)) ?? null;
}

/** Non-referendum portion of the certified total; held at 2026 levels for pay-2027 scenarios (estimated). */
export function nonReferendumRate(d: TaxDistrict): number {
  return d.totalRate2026 - CURRENT_REFERENDUM_TOTAL.value;
}

export const SCENARIOS: Record<ScenarioId, ScenarioParams> = {
  current: {
    id: 'current', label: 'Current (pay-2026)', payYear: 2026,
    standardDeduction: DEDUCTIONS[2026].value.standard,
    supplementalRate: DEDUCTIONS[2026].value.supplementalRate,
    referendumOperatingRate: REFERENDUM.currentOperating.value,
    referendumDebtRate: REFERENDUM.debt.value,
  },
  passCommitted: {
    id: 'passCommitted', label: 'If it passes — committed 2027 rate ($0.41)', payYear: 2027,
    standardDeduction: DEDUCTIONS[2027].value.standard,
    supplementalRate: DEDUCTIONS[2027].value.supplementalRate,
    referendumOperatingRate: REFERENDUM.committed2027.value,
    referendumDebtRate: REFERENDUM.debt.value,
  },
  passMax: {
    id: 'passMax', label: 'If it passes — authorized maximum ($0.57)', payYear: 2027,
    standardDeduction: DEDUCTIONS[2027].value.standard,
    supplementalRate: DEDUCTIONS[2027].value.supplementalRate,
    referendumOperatingRate: REFERENDUM.proposedMax.value,
    referendumDebtRate: REFERENDUM.debt.value,
  },
  fail: {
    id: 'fail', label: 'If it fails (pay-2027)', payYear: 2027,
    standardDeduction: DEDUCTIONS[2027].value.standard,
    supplementalRate: DEDUCTIONS[2027].value.supplementalRate,
    referendumOperatingRate: 0,
    referendumDebtRate: REFERENDUM.debt.value,
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/tax/assumptions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/tax/types.ts lib/tax/assumptions.ts lib/tax/assumptions.test.ts
git commit -m "feat: tax types and sourced assumptions config"
```

---

### Task 3: Tax engine — deductions and net AV

**Files:**
- Create: `lib/tax/engine.ts`
- Test: `lib/tax/engine.test.ts`

**Interfaces:**
- Consumes: `SCENARIOS`, `SUPP_DEDUCTION_CAP_RATE` from Task 2
- Produces: `computeNetAV(grossAV: number, s: ScenarioParams): { standardDeduction: number; supplementalDeduction: number; netAV: number }`

- [ ] **Step 1: Write the failing test `lib/tax/engine.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { computeNetAV } from './engine';
import { SCENARIOS } from './assumptions';

describe('computeNetAV', () => {
  it('pay-2026: $350k home → (350000-48000) × (1-0.40) = 181,200', () => {
    const r = computeNetAV(350000, SCENARIOS.current);
    expect(r.standardDeduction).toBe(48000);
    expect(r.supplementalDeduction).toBeCloseTo(120800, 2);
    expect(r.netAV).toBeCloseTo(181200, 2);
  });

  it('pay-2027: $350k home → (350000-40000) × (1-0.46) = 167,400 (ballot-language basis)', () => {
    const r = computeNetAV(350000, SCENARIOS.passMax);
    expect(r.netAV).toBeCloseTo(167400, 2);
  });

  it('gross AV below the standard deduction → net AV 0, no negative values', () => {
    const r = computeNetAV(30000, SCENARIOS.current);
    expect(r.standardDeduction).toBe(48000);
    expect(r.supplementalDeduction).toBe(0);
    expect(r.netAV).toBe(0);
  });

  it('supplemental deduction never exceeds 75% of gross AV (cannot bind with current params, but enforced)', () => {
    const r = computeNetAV(1000000, SCENARIOS.passCommitted);
    expect(r.supplementalDeduction).toBeLessThanOrEqual(0.75 * 1000000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/tax/engine.test.ts`
Expected: FAIL — cannot resolve `./engine`.

- [ ] **Step 3: Create `lib/tax/engine.ts`**

```ts
import type { ScenarioParams } from './types';
import { SUPP_DEDUCTION_CAP_RATE } from './assumptions';

export function computeNetAV(grossAV: number, s: ScenarioParams) {
  const afterStandard = Math.max(0, grossAV - s.standardDeduction);
  const supplementalDeduction = Math.min(
    afterStandard * s.supplementalRate,
    grossAV * SUPP_DEDUCTION_CAP_RATE.value,
  );
  const netAV = Math.max(0, afterStandard - supplementalDeduction);
  return { standardDeduction: s.standardDeduction, supplementalDeduction, netAV };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/tax/engine.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tax/engine.ts lib/tax/engine.test.ts
git commit -m "feat: net assessed value computation with SEA 1 deduction schedule"
```

---

### Task 4: Tax engine — full bill with cap, credit, and referendum split

**Files:**
- Modify: `lib/tax/engine.ts`
- Test: `lib/tax/engine.test.ts` (append)

**Interfaces:**
- Consumes: `computeNetAV` (Task 3), `nonReferendumRate`, `CIRCUIT_BREAKER_RATE`, `HOMESTEAD_CREDIT`, `findDistrict` (Task 2)
- Produces: `computeBill(grossAV: number, district: TaxDistrict, s: ScenarioParams): BillBreakdown`

- [ ] **Step 1: Append failing tests to `lib/tax/engine.test.ts`**

```ts
import { computeBill } from './engine';
import { findDistrict } from './assumptions';

const city = findDistrict('Noblesville City')!;
const township = findDistrict('Noblesville Township')!;

describe('computeBill — anchored to official figures', () => {
  it('reproduces the pay-2026 worked example: $350k Noblesville City homestead ≈ $4,015.40', () => {
    const b = computeBill(350000, city, SCENARIOS.current);
    expect(b.netAV).toBeCloseTo(181200, 2);
    expect(b.nonReferendumGross).toBeCloseTo(3814.08, 2);   // 181200 × 2.1049%
    expect(b.circuitBreakerCap).toBeCloseTo(3500, 2);        // 1% × 350000
    expect(b.circuitBreakerCredit).toBeCloseTo(314.08, 2);
    expect(b.supplementalHomesteadCredit).toBeCloseTo(300, 2); // min(350, 300)
    expect(b.nonReferendumNet).toBeCloseTo(3200, 2);
    expect(b.referendumTax).toBeCloseTo(815.4, 2);           // 181200 × 0.45%
    expect(b.total).toBeCloseTo(4015.4, 2);
  });

  it('reproduces the official ballot figure: $350k home at $0.57 max → referendum operating tax ≈ $954.18', () => {
    const b = computeBill(350000, city, SCENARIOS.passMax);
    expect(b.referendumOperatingTax).toBeCloseTo(954.18, 2); // 167400 × 0.57%
    expect(b.total).toBeCloseTo(4288.1, 2);
  });

  it('pass at committed $0.41: $350k city home ≈ $4,020.26', () => {
    const b = computeBill(350000, city, SCENARIOS.passCommitted);
    expect(b.nonReferendumNet).toBeCloseTo(3200, 2); // 3523.60 capped at 3500, minus $300 credit
    expect(b.referendumTax).toBeCloseTo(820.26, 2);  // 167400 × 0.49%
    expect(b.total).toBeCloseTo(4020.26, 2);
  });

  it('fail: $350k city home ≈ $3,333.92 — $0.08 debt rate still applies', () => {
    const b = computeBill(350000, city, SCENARIOS.fail);
    expect(b.referendumOperatingTax).toBe(0);
    expect(b.referendumDebtTax).toBeCloseTo(133.92, 2); // 167400 × 0.08%
    expect(b.total).toBeCloseTo(3333.92, 2);
  });
});

describe('computeBill — cap and credit boundaries', () => {
  it('high AV: 1% cap binds hard ($800k city, pay-2026)', () => {
    const b = computeBill(800000, city, SCENARIOS.current);
    expect(b.nonReferendumGross).toBeCloseTo(9497.31, 2);
    expect(b.circuitBreakerCredit).toBeCloseTo(1497.31, 2);
    expect(b.supplementalHomesteadCredit).toBeCloseTo(300, 2);
    expect(b.total).toBeCloseTo(9730.4, 2); // 7700 + 2030.40 referendum
  });

  it('township: cap does not bind, credit below $300 ($350k, pay-2026)', () => {
    const b = computeBill(350000, township, SCENARIOS.current);
    expect(b.circuitBreakerCredit).toBe(0);                      // 2526.65 < 3500
    expect(b.supplementalHomesteadCredit).toBeCloseTo(252.67, 2); // 10% of 2526.65
    expect(b.total).toBeCloseTo(3089.39, 2);
  });

  it('zero net AV → zero everything', () => {
    const b = computeBill(30000, city, SCENARIOS.current);
    expect(b.total).toBe(0);
    expect(b.supplementalHomesteadCredit).toBe(0);
  });

  it('referendum tax is excluded from both the cap and the credit base', () => {
    const b = computeBill(800000, city, SCENARIOS.passMax);
    // cap applies to non-referendum only:
    expect(b.nonReferendumGross - b.circuitBreakerCredit).toBeCloseTo(8000, 2);
    // referendum stacks on top, uncapped:
    expect(b.referendumTax).toBeCloseTo(410400 * 0.0065, 2);
    // credit computed from post-cap non-referendum liability only:
    expect(b.supplementalHomesteadCredit).toBe(300);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/tax/engine.test.ts`
Expected: FAIL — `computeBill` is not exported.

- [ ] **Step 3: Append `computeBill` to `lib/tax/engine.ts`**

```ts
import type { BillBreakdown, TaxDistrict } from './types';
import { CIRCUIT_BREAKER_RATE, HOMESTEAD_CREDIT, nonReferendumRate } from './assumptions';

export function computeBill(
  grossAV: number,
  district: TaxDistrict,
  s: ScenarioParams,
): BillBreakdown {
  const { standardDeduction, supplementalDeduction, netAV } = computeNetAV(grossAV, s);

  const nonRefRate = nonReferendumRate(district);
  const nonReferendumGross = (netAV * nonRefRate) / 100;

  const circuitBreakerCap = grossAV * CIRCUIT_BREAKER_RATE.value;
  const circuitBreakerCredit = Math.max(0, nonReferendumGross - circuitBreakerCap);
  const afterCap = nonReferendumGross - circuitBreakerCredit;

  const supplementalHomesteadCredit = Math.min(
    afterCap * HOMESTEAD_CREDIT.value.rate,
    HOMESTEAD_CREDIT.value.max,
  );
  const nonReferendumNet = afterCap - supplementalHomesteadCredit;

  const referendumOperatingTax = (netAV * s.referendumOperatingRate) / 100;
  const referendumDebtTax = (netAV * s.referendumDebtRate) / 100;
  const referendumTax = referendumOperatingTax + referendumDebtTax;

  return {
    scenario: s.id,
    grossAV,
    standardDeduction,
    supplementalDeduction,
    netAV,
    nonReferendumRate: nonRefRate,
    nonReferendumGross,
    circuitBreakerCap,
    circuitBreakerCredit,
    supplementalHomesteadCredit,
    nonReferendumNet,
    referendumOperatingTax,
    referendumDebtTax,
    referendumTax,
    total: nonReferendumNet + referendumTax,
  };
}
```

(Consolidate the imports at the top of the file — `ScenarioParams` and `TaxDistrict`/`BillBreakdown` come from `./types`; assumption values from `./assumptions`.)

- [ ] **Step 4: Run full engine test suite**

Run: `npx vitest run lib/tax/engine.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tax/engine.ts lib/tax/engine.test.ts
git commit -m "feat: full bill computation with circuit breaker, homestead credit, referendum split"
```

---

### Task 5: Scenario aggregation

**Files:**
- Create: `lib/tax/scenarios.ts`
- Test: `lib/tax/scenarios.test.ts`

**Interfaces:**
- Consumes: `computeBill` (Task 4), `SCENARIOS`, `findDistrict` (Task 2)
- Produces: `computeAllScenarios(grossAV: number, district: TaxDistrict): ScenarioResults` where `interface ScenarioResults { current: BillBreakdown; passCommitted: BillBreakdown; passMax: BillBreakdown; fail: BillBreakdown; }` (exported from `lib/tax/scenarios.ts`)

- [ ] **Step 1: Write the failing test `lib/tax/scenarios.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { computeAllScenarios } from './scenarios';
import { findDistrict } from './assumptions';

const city = findDistrict('Noblesville City')!;
const township = findDistrict('Noblesville Township')!;

describe('computeAllScenarios', () => {
  it('returns all four scenarios for a $350k city home', () => {
    const r = computeAllScenarios(350000, city);
    expect(r.current.total).toBeCloseTo(4015.4, 2);
    expect(r.passCommitted.total).toBeCloseTo(4020.26, 2);
    expect(r.passMax.total).toBeCloseTo(4288.1, 2);
    expect(r.fail.total).toBeCloseTo(3333.92, 2);
  });

  it('pass-vs-fail delta at committed rate = referendum operating tax ($686.34 for $350k)', () => {
    const r = computeAllScenarios(350000, city);
    expect(r.passCommitted.total - r.fail.total).toBeCloseTo(686.34, 2); // 167400 × 0.41%
  });

  it('pass-vs-fail delta at max rate matches the ballot figure ($954.18)', () => {
    const r = computeAllScenarios(350000, city);
    expect(r.passMax.total - r.fail.total).toBeCloseTo(954.18, 2);
  });

  it('township $350k home pays LESS under pass than currently (net AV shrinks, cap not binding)', () => {
    const r = computeAllScenarios(350000, township);
    expect(r.current.total).toBeCloseTo(3089.39, 2);
    expect(r.passCommitted.total).toBeCloseTo(2921.06, 2);
    expect(r.passCommitted.total).toBeLessThan(r.current.total);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/tax/scenarios.test.ts`
Expected: FAIL — cannot resolve `./scenarios`.

- [ ] **Step 3: Create `lib/tax/scenarios.ts`**

```ts
import type { BillBreakdown, TaxDistrict } from './types';
import { SCENARIOS } from './assumptions';
import { computeBill } from './engine';

export interface ScenarioResults {
  current: BillBreakdown;
  passCommitted: BillBreakdown;
  passMax: BillBreakdown;
  fail: BillBreakdown;
}

export function computeAllScenarios(grossAV: number, district: TaxDistrict): ScenarioResults {
  return {
    current: computeBill(grossAV, district, SCENARIOS.current),
    passCommitted: computeBill(grossAV, district, SCENARIOS.passCommitted),
    passMax: computeBill(grossAV, district, SCENARIOS.passMax),
    fail: computeBill(grossAV, district, SCENARIOS.fail),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/tax/scenarios.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tax/scenarios.ts lib/tax/scenarios.test.ts
git commit -m "feat: four-scenario aggregation (current, pass-committed, pass-max, fail)"
```

---

### Task 6: Hamilton County ArcGIS client

**Files:**
- Create: `lib/lookup/arcgis.ts`
- Create: `lib/lookup/fixtures/sample-response.json`
- Test: `lib/lookup/arcgis.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces:
  - `interface ParcelCandidate { parcelNo: string; stateParcelNo: string; address: string; city: string; zip: string; grossAV: number; assessmentYear: number; homestead: boolean; taxDistrictName: string; propertyReportUrl: string; }`
  - `sanitizeSearchTerm(raw: string): string`
  - `buildQueryUrl(term: string): string`
  - `parseResponse(json: unknown): ParcelCandidate[]`
  - `searchParcels(term: string): Promise<ParcelCandidate[]>` (throws `Error('upstream')` on non-200 / network failure)

- [ ] **Step 1: Capture a real fixture from the live endpoint**

```bash
mkdir -p lib/lookup/fixtures
curl -s 'https://services5.arcgis.com/beYj0ONLvCt8qxHA/arcgis/rest/services/Parcels_Current_Open_Data/FeatureServer/0/query' \
  --data-urlencode "where=UPPER(LOCADDRESS) LIKE '%CONNER ST%' AND UPPER(TAXDISTNAM) LIKE '%NOBLESVILLE%'" \
  --data-urlencode 'outFields=PARCELNO,STPRCLNO,LOCADDRESS,LOCCITY,LOCZIP,AVTOTGROSS,AVTAXYR,HOMESTEAD,hmstd_code,TAXDISTCOD,TAXDISTNAM,PROPERTYREPORT' \
  --data-urlencode 'resultRecordCount=3' \
  --data-urlencode 'returnGeometry=false' \
  --data-urlencode 'f=json' > lib/lookup/fixtures/sample-response.json
cat lib/lookup/fixtures/sample-response.json
```

**Record in the fixture-derived tests below the actual values observed** — especially the shape of `HOMESTEAD` / `hmstd_code` (string vs number, what value means "has homestead deduction"). Adjust the `homestead` parsing rule in Step 4 to match reality before writing the assertion.

- [ ] **Step 2: Write the failing test `lib/lookup/arcgis.test.ts`**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { sanitizeSearchTerm, buildQueryUrl, parseResponse, searchParcels } from './arcgis';
import fixture from './fixtures/sample-response.json';

describe('sanitizeSearchTerm', () => {
  it('uppercases, trims, collapses whitespace', () => {
    expect(sanitizeSearchTerm('  1234  conner st ')).toBe('1234 CONNER ST');
  });
  it('strips SQL-meaningful characters', () => {
    expect(sanitizeSearchTerm(`123' OR 1=1;--`)).toBe('123 OR 11--');
  });
});

describe('buildQueryUrl', () => {
  it('targets the county FeatureServer with a LIKE clause and Noblesville district filter', () => {
    const url = new URL(buildQueryUrl('1234 CONNER ST'));
    expect(url.hostname).toBe('services5.arcgis.com');
    const where = url.searchParams.get('where')!;
    expect(where).toContain("LIKE '%1234 CONNER ST%'");
    expect(where).toContain("TAXDISTNAM) LIKE '%NOBLESVILLE%'");
    expect(url.searchParams.get('resultRecordCount')).toBe('10');
    expect(url.searchParams.get('returnGeometry')).toBe('false');
  });
});

describe('parseResponse', () => {
  it('maps real county features to ParcelCandidates', () => {
    const parcels = parseResponse(fixture);
    expect(parcels.length).toBeGreaterThan(0);
    const p = parcels[0];
    expect(p.address).toBeTruthy();
    expect(p.grossAV).toBeGreaterThan(0);
    expect(p.assessmentYear).toBeGreaterThanOrEqual(2025);
    expect(typeof p.homestead).toBe('boolean');
    expect(p.taxDistrictName).toMatch(/noblesville/i);
  });
  it('returns [] for malformed payloads', () => {
    expect(parseResponse({})).toEqual([]);
    expect(parseResponse(null)).toEqual([]);
    expect(parseResponse({ error: { code: 400 } })).toEqual([]);
  });
});

describe('searchParcels', () => {
  afterEach(() => vi.restoreAllMocks());
  it('throws on upstream failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })));
    await expect(searchParcels('123 MAIN ST')).rejects.toThrow('upstream');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/lookup/arcgis.test.ts`
Expected: FAIL — cannot resolve `./arcgis`.

- [ ] **Step 4: Create `lib/lookup/arcgis.ts`**

```ts
const ENDPOINT =
  'https://services5.arcgis.com/beYj0ONLvCt8qxHA/arcgis/rest/services/Parcels_Current_Open_Data/FeatureServer/0/query';

const OUT_FIELDS = [
  'PARCELNO', 'STPRCLNO', 'LOCADDRESS', 'LOCCITY', 'LOCZIP',
  'AVTOTGROSS', 'AVTAXYR', 'HOMESTEAD', 'hmstd_code', 'TAXDISTCOD', 'TAXDISTNAM', 'PROPERTYREPORT',
].join(',');

export interface ParcelCandidate {
  parcelNo: string;
  stateParcelNo: string;
  address: string;
  city: string;
  zip: string;
  grossAV: number;
  assessmentYear: number;
  homestead: boolean;
  taxDistrictName: string;
  propertyReportUrl: string;
}

export function sanitizeSearchTerm(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9\s\-&]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildQueryUrl(term: string): string {
  const where =
    `UPPER(LOCADDRESS) LIKE '%${term}%' AND UPPER(TAXDISTNAM) LIKE '%NOBLESVILLE%'`;
  const params = new URLSearchParams({
    where,
    outFields: OUT_FIELDS,
    resultRecordCount: '10',
    returnGeometry: 'false',
    f: 'json',
  });
  return `${ENDPOINT}?${params}`;
}

// NOTE: adjust this predicate to the real HOMESTEAD/hmstd_code values observed
// in lib/lookup/fixtures/sample-response.json (captured in Step 1).
function isHomestead(attrs: Record<string, unknown>): boolean {
  const h = attrs.HOMESTEAD ?? attrs.hmstd_code;
  if (h == null) return false;
  const s = String(h).trim().toUpperCase();
  return s !== '' && s !== '0' && s !== 'N' && s !== 'NO' && s !== 'NONE';
}

export function parseResponse(json: unknown): ParcelCandidate[] {
  if (!json || typeof json !== 'object') return [];
  const features = (json as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((f) => {
    const attrs = (f as { attributes?: Record<string, unknown> }).attributes;
    if (!attrs) return [];
    const grossAV = Number(attrs.AVTOTGROSS);
    if (!Number.isFinite(grossAV)) return [];
    return [{
      parcelNo: String(attrs.PARCELNO ?? ''),
      stateParcelNo: String(attrs.STPRCLNO ?? ''),
      address: String(attrs.LOCADDRESS ?? ''),
      city: String(attrs.LOCCITY ?? ''),
      zip: String(attrs.LOCZIP ?? ''),
      grossAV,
      assessmentYear: Number(attrs.AVTAXYR) || 0,
      homestead: isHomestead(attrs),
      taxDistrictName: String(attrs.TAXDISTNAM ?? ''),
      propertyReportUrl: String(attrs.PROPERTYREPORT ?? ''),
    }];
  });
}

export async function searchParcels(term: string): Promise<ParcelCandidate[]> {
  const res = await fetch(buildQueryUrl(term), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('upstream');
  return parseResponse(await res.json());
}
```

- [ ] **Step 5: Run test, verify the homestead predicate against the fixture, adjust if needed**

Run: `npx vitest run lib/lookup/arcgis.test.ts`
Expected: PASS (6 tests). If the fixture shows `HOMESTEAD`/`hmstd_code` uses a different convention (e.g., numeric codes), fix `isHomestead` and add a fixture-specific assertion, e.g. `expect(parcels.some(p => p.homestead)).toBe(true)`.

- [ ] **Step 6: Commit**

```bash
git add lib/lookup/
git commit -m "feat: Hamilton County ArcGIS parcel search client with sanitized queries"
```

---

### Task 7: Lookup API route

**Files:**
- Create: `app/api/lookup/route.ts`
- Test: `app/api/lookup/route.test.ts`

**Interfaces:**
- Consumes: `searchParcels`, `ParcelCandidate` (Task 6)
- Produces: `GET /api/lookup?q=<address>` → `200 {"candidates": ParcelCandidate[]}` | `400 {"error": "query-too-short"}` | `502 {"error": "upstream"}`

- [ ] **Step 1: Write the failing test `app/api/lookup/route.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/lookup/arcgis', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/lookup/arcgis')>();
  return { ...mod, searchParcels: vi.fn() };
});

import { GET } from './route';
import { searchParcels } from '@/lib/lookup/arcgis';

const mockSearch = vi.mocked(searchParcels);

function req(q: string) {
  return new Request(`http://localhost/api/lookup?q=${encodeURIComponent(q)}`);
}

beforeEach(() => mockSearch.mockReset());

describe('GET /api/lookup', () => {
  it('returns candidates for a valid query', async () => {
    mockSearch.mockResolvedValue([
      {
        parcelNo: '160', stateParcelNo: '29', address: '1234 CONNER ST', city: 'Noblesville',
        zip: '46060', grossAV: 350000, assessmentYear: 2026, homestead: true,
        taxDistrictName: 'Noblesville City', propertyReportUrl: 'https://example.test/r',
      },
    ]);
    const res = await GET(req('1234 conner st'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates).toHaveLength(1);
    expect(mockSearch).toHaveBeenCalledWith('1234 CONNER ST'); // sanitized before calling
  });

  it('rejects queries shorter than 4 characters', async () => {
    const res = await GET(req('12'));
    expect(res.status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('maps upstream failure to 502', async () => {
    mockSearch.mockRejectedValue(new Error('upstream'));
    const res = await GET(req('1234 conner st'));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('upstream');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/lookup/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Create `app/api/lookup/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { sanitizeSearchTerm, searchParcels } from '@/lib/lookup/arcgis';

export const dynamic = 'force-dynamic';

// Privacy: this route intentionally never logs the query or the results.
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('q') ?? '';
  const term = sanitizeSearchTerm(raw);
  if (term.length < 4) {
    return NextResponse.json({ error: 'query-too-short' }, { status: 400 });
  }
  try {
    const candidates = await searchParcels(term);
    return NextResponse.json({ candidates });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/lookup/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/lookup/
git commit -m "feat: address lookup API route proxying county ArcGIS, no logging"
```

---

### Task 8: Results component (table + show-the-math)

**Files:**
- Create: `lib/format.ts`
- Create: `components/Results.tsx`
- Test: `components/Results.test.tsx`

**Interfaces:**
- Consumes: `computeAllScenarios`, `ScenarioResults` (Task 5), `findDistrict`, `REFERENDUM`, `SOURCES`, `SCENARIOS` (Task 2), `BillBreakdown` types
- Produces: `<Results grossAV={number} district={TaxDistrict} homestead={boolean} assessmentYear={number | null} propertyReportUrl={string | null} />` — used by Task 9. Also `fmtDollars(n: number): string` (whole dollars, `$4,015`), `fmtCents(n: number): string` (`$57.20`) from `lib/format.ts`.

- [ ] **Step 1: Create `lib/format.ts`**

```ts
const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});
const cents = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export const fmtDollars = (n: number) => dollars.format(Math.round(n));
export const fmtCents = (n: number) => cents.format(n);
/** Signed delta for neutral display: "+$5" / "−$681" / "$0" */
export const fmtDelta = (n: number) => {
  const r = Math.round(n);
  if (r === 0) return '$0';
  return (r > 0 ? '+' : '−') + dollars.format(Math.abs(r));
};
```

- [ ] **Step 2: Write the failing test `components/Results.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Results from './Results';
import { findDistrict } from '@/lib/tax/assumptions';

const city = findDistrict('Noblesville City')!;

describe('<Results>', () => {
  it('renders all three scenario totals for a $350k city homestead', () => {
    render(<Results grossAV={350000} district={city} homestead={true} assessmentYear={2026} propertyReportUrl={null} />);
    expect(screen.getByText('$4,015')).toBeInTheDocument();   // current
    expect(screen.getByText('$4,020')).toBeInTheDocument();   // pass at committed 0.41
    expect(screen.getByText('$3,334')).toBeInTheDocument();   // fail
    expect(screen.getByText(/\$4,288/)).toBeInTheDocument();  // pass at authorized max, secondary line
  });

  it('shows the pass-vs-fail difference in $/yr and $/mo', () => {
    render(<Results grossAV={350000} district={city} homestead={true} assessmentYear={2026} propertyReportUrl={null} />);
    expect(screen.getByText(/\+\$686/)).toBeInTheDocument();      // 686.34/yr
    expect(screen.getByText(/\$57\.20/)).toBeInTheDocument();     // per month
  });

  it('shows a non-homestead notice when homestead is false', () => {
    render(<Results grossAV={350000} district={city} homestead={false} assessmentYear={2026} propertyReportUrl={null} />);
    expect(screen.getByText(/assumes an owner-occupied homestead/i)).toBeInTheDocument();
  });

  it('exposes the math breakdown with net AV and cap figures', () => {
    render(<Results grossAV={350000} district={city} homestead={true} assessmentYear={2026} propertyReportUrl={null} />);
    expect(screen.getByText(/how this was calculated/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\$181,200/).length).toBeGreaterThan(0); // pay-2026 net AV
    expect(screen.getAllByText(/\$167,400/).length).toBeGreaterThan(0); // pay-2027 net AV
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run components/Results.test.tsx`
Expected: FAIL — cannot resolve `./Results`.

- [ ] **Step 4: Create `components/Results.tsx`**

```tsx
import type { BillBreakdown, TaxDistrict } from '@/lib/tax/types';
import { computeAllScenarios } from '@/lib/tax/scenarios';
import { REFERENDUM, SOURCES } from '@/lib/tax/assumptions';
import { fmtCents, fmtDelta, fmtDollars } from '@/lib/format';

interface Props {
  grossAV: number;
  district: TaxDistrict;
  homestead: boolean;
  assessmentYear: number | null;
  propertyReportUrl: string | null;
}

function MathRows({ b }: { b: BillBreakdown }) {
  const rows: Array<[string, string]> = [
    ['Gross assessed value', fmtCents(b.grossAV)],
    ['− Standard homestead deduction', fmtCents(b.standardDeduction)],
    ['− Supplemental homestead deduction', fmtCents(b.supplementalDeduction)],
    ['= Net assessed value', fmtCents(b.netAV)],
    [`Non-referendum tax (rate ${b.nonReferendumRate.toFixed(4)} per $100)`, fmtCents(b.nonReferendumGross)],
    ['Circuit breaker cap (1% of gross AV)', fmtCents(b.circuitBreakerCap)],
    ['− Circuit breaker credit', fmtCents(b.circuitBreakerCredit)],
    ['− Supplemental homestead credit (10%, max $300)', fmtCents(b.supplementalHomesteadCredit)],
    ['= Non-referendum tax after credits', fmtCents(b.nonReferendumNet)],
    ['+ School referendum operating tax', fmtCents(b.referendumOperatingTax)],
    ['+ School referendum debt tax ($0.08, through 2032)', fmtCents(b.referendumDebtTax)],
    ['Total estimated bill', fmtCents(b.total)],
  ];
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-gray-200 dark:border-gray-700">
            <td className="py-1 pr-4">{label}</td>
            <td className="py-1 text-right tabular-nums">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Results({ grossAV, district, homestead, assessmentYear, propertyReportUrl }: Props) {
  const r = computeAllScenarios(grossAV, district);
  const passVsFail = r.passCommitted.total - r.fail.total;
  const passVsFailMax = r.passMax.total - r.fail.total;

  return (
    <section aria-label="Estimated property tax comparison" className="space-y-6">
      {!homestead && (
        <p className="rounded border border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950">
          County records do not show a homestead deduction for this parcel. This estimate
          assumes an owner-occupied homestead and will not match bills for rentals or second homes.
        </p>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-left" scope="col">&nbsp;</th>
            <th className="p-2 text-right" scope="col">Current<br /><span className="font-normal text-xs">pay-2026</span></th>
            <th className="p-2 text-right" scope="col">If it passes<br /><span className="font-normal text-xs">pay-2027 est.</span></th>
            <th className="p-2 text-right" scope="col">If it fails<br /><span className="font-normal text-xs">pay-2027 est.</span></th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <th className="p-2 text-left font-medium" scope="row">Estimated annual bill</th>
            <td className="p-2 text-right text-lg tabular-nums">{fmtDollars(r.current.total)}</td>
            <td className="p-2 text-right">
              <div className="text-lg tabular-nums">{fmtDollars(r.passCommitted.total)}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                at the district&rsquo;s committed 2027 rate ($0.41); up to {fmtDollars(r.passMax.total)} if the
                full authorized $0.57 were levied
              </div>
            </td>
            <td className="p-2 text-right text-lg tabular-nums">{fmtDollars(r.fail.total)}</td>
          </tr>
          <tr className="border-t">
            <th className="p-2 text-left font-medium" scope="row">Change vs. current bill</th>
            <td className="p-2 text-right">—</td>
            <td className="p-2 text-right tabular-nums">{fmtDelta(r.passCommitted.total - r.current.total)}/yr</td>
            <td className="p-2 text-right tabular-nums">{fmtDelta(r.fail.total - r.current.total)}/yr</td>
          </tr>
        </tbody>
      </table>

      <div className="rounded border p-4">
        <h2 className="font-medium">Difference between passing and failing</h2>
        <p className="mt-1 tabular-nums">
          <span className="text-lg">{fmtDelta(passVsFail)}/yr</span>{' '}
          ({fmtCents(passVsFail / 12)}/mo) at the committed 2027 rate;{' '}
          {fmtDelta(passVsFailMax)}/yr ({fmtCents(passVsFailMax / 12)}/mo) at the authorized maximum.
        </p>
      </div>

      <details className="rounded border p-4">
        <summary className="cursor-pointer font-medium">How this was calculated</summary>
        <div className="mt-4 space-y-6">
          {([r.current, r.passCommitted, r.passMax, r.fail] as const).map((b) => (
            <div key={b.scenario}>
              <h3 className="mb-2 font-medium">
                {{
                  current: 'Current (pay-2026)',
                  passCommitted: 'If it passes — committed 2027 rate ($0.41)',
                  passMax: 'If it passes — authorized maximum ($0.57)',
                  fail: 'If it fails (pay-2027)',
                }[b.scenario]}
              </h3>
              <MathRows b={b} />
            </div>
          ))}
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <p>
              The $0.41 figure is the district&rsquo;s public commitment for 2027 only — it is not legally
              binding, and later years may be set higher, up to the authorized $0.57.{' '}
              <a className="underline" href={REFERENDUM.committed2027.source}>Source</a>.
            </p>
            <p>
              Pay-2027 non-referendum rates are not certified until January 2027; this estimate holds them
              at certified pay-2026 levels. <a className="underline" href={SOURCES.budgetOrder2026}>2026 budget order</a>.
            </p>
            {assessmentYear != null && (
              <p>
                County gross assessed value is from the {assessmentYear} assessment. The &ldquo;current&rdquo;
                column applies pay-2026 rules to that value, so it may differ slightly from your actual 2026 bill.
              </p>
            )}
            {propertyReportUrl && (
              <p><a className="underline" href={propertyReportUrl}>Official county property report for this parcel</a></p>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/Results.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/format.ts components/Results.tsx components/Results.test.tsx
git commit -m "feat: results table with committed/max pass figures and full math breakdown"
```

---

### Task 9: Calculator component and landing page

**Files:**
- Create: `components/Calculator.tsx`
- Modify: `app/page.tsx` (replace scaffold content)
- Modify: `app/layout.tsx` (title, footer)
- Test: `components/Calculator.test.tsx`

**Interfaces:**
- Consumes: `<Results>` (Task 8), `findDistrict` (Task 2), `ParcelCandidate` (Task 6), `GET /api/lookup` (Task 7), `fmtDollars` (Task 8)
- Produces: `<Calculator />` (client component, no props) rendered by `app/page.tsx`

- [ ] **Step 1: Write the failing test `components/Calculator.test.tsx`**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Calculator from './Calculator';

// userEvent ships with @testing-library/react v16 as separate pkg — install if missing:
// npm install -D @testing-library/user-event

const candidate = {
  parcelNo: '160', stateParcelNo: '29', address: '1234 CONNER ST', city: 'Noblesville',
  zip: '46060', grossAV: 350000, assessmentYear: 2026, homestead: true,
  taxDistrictName: 'Noblesville City', propertyReportUrl: '',
};

afterEach(() => vi.restoreAllMocks());

describe('<Calculator>', () => {
  it('searches, picks a candidate, shows results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [candidate] }), { status: 200 }),
    ));
    const user = userEvent.setup();
    render(<Calculator />);
    await user.type(screen.getByLabelText(/address/i), '1234 conner st');
    await user.click(screen.getByRole('button', { name: /look up/i }));
    await user.click(await screen.findByRole('button', { name: /1234 CONNER ST/i }));
    await waitFor(() => expect(screen.getByText('$4,015')).toBeInTheDocument());
  });

  it('falls back to manual entry on upstream failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'upstream' }), { status: 502 }),
    ));
    const user = userEvent.setup();
    render(<Calculator />);
    await user.type(screen.getByLabelText(/address/i), '1234 conner st');
    await user.click(screen.getByRole('button', { name: /look up/i }));
    expect(await screen.findByText(/county lookup isn.t available/i)).toBeInTheDocument();
  });

  it('manual entry computes results without any lookup', async () => {
    const user = userEvent.setup();
    render(<Calculator />);
    await user.click(screen.getByRole('button', { name: /enter assessed value manually/i }));
    await user.type(screen.getByLabelText(/gross assessed value/i), '350000');
    await user.selectOptions(screen.getByLabelText(/taxing district/i), 'Noblesville City');
    await user.click(screen.getByRole('button', { name: /calculate/i }));
    expect(await screen.findByText('$4,015')).toBeInTheDocument();
  });

  it('shows out-of-district message for unmatched districts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ ...candidate, taxDistrictName: 'Wayne Township' }] }), { status: 200 }),
    ));
    const user = userEvent.setup();
    render(<Calculator />);
    await user.type(screen.getByLabelText(/address/i), '1234 conner st');
    await user.click(screen.getByRole('button', { name: /look up/i }));
    await user.click(await screen.findByRole('button', { name: /1234 CONNER ST/i }));
    expect(await screen.findByText(/covers homes in the Noblesville Schools district/i)).toBeInTheDocument();
  });
});
```

(Note: `'Wayne Township'` without "Noblesville" must NOT match — `findDistrict` requires the name to contain "Noblesville". Install `@testing-library/user-event` in this step: `npm install -D @testing-library/user-event`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/Calculator.test.tsx`
Expected: FAIL — cannot resolve `./Calculator`.

- [ ] **Step 3: Create `components/Calculator.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { ParcelCandidate } from '@/lib/lookup/arcgis';
import { DISTRICTS, findDistrict } from '@/lib/tax/assumptions';
import type { TaxDistrict } from '@/lib/tax/types';
import { fmtDollars } from '@/lib/format';
import Results from './Results';

type Selection =
  | { kind: 'parcel'; parcel: ParcelCandidate; district: TaxDistrict }
  | { kind: 'manual'; grossAV: number; district: TaxDistrict };

export default function Calculator() {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<ParcelCandidate[] | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualAV, setManualAV] = useState('');
  const [manualDistrict, setManualDistrict] = useState(DISTRICTS[3].name); // Noblesville City
  const [outOfDistrict, setOutOfDistrict] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setCandidates(null); setSelection(null); setOutOfDistrict(false);
    try {
      const res = await fetch(`/api/lookup?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('lookup-failed');
      const body = (await res.json()) as { candidates: ParcelCandidate[] };
      setCandidates(body.candidates);
      if (body.candidates.length === 1) select(body.candidates[0]);
    } catch {
      setError(
        "The county lookup isn't available right now. You can enter your gross assessed value manually below — it's on your tax bill (Form TS-1) or the county property report.",
      );
      setManualOpen(true);
    } finally {
      setBusy(false);
    }
  }

  function select(parcel: ParcelCandidate) {
    const district = findDistrict(parcel.taxDistrictName);
    if (!district) { setOutOfDistrict(true); setSelection(null); return; }
    setOutOfDistrict(false);
    setSelection({ kind: 'parcel', parcel, district });
  }

  function calculateManual(e: React.FormEvent) {
    e.preventDefault();
    const grossAV = Number(manualAV.replace(/[,$\s]/g, ''));
    const district = DISTRICTS.find((d) => d.name === manualDistrict);
    if (!Number.isFinite(grossAV) || grossAV <= 0 || grossAV > 50_000_000 || !district) {
      setError('Enter a gross assessed value between $1 and $50,000,000.');
      return;
    }
    setError(null); setOutOfDistrict(false);
    setSelection({ kind: 'manual', grossAV, district });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={lookup} className="space-y-2">
        <label htmlFor="address" className="block font-medium">Your street address</label>
        <div className="flex gap-2">
          <input
            id="address"
            className="w-full rounded border p-2"
            placeholder="e.g. 1234 Conner St"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="street-address"
          />
          <button type="submit" disabled={busy || query.trim().length < 4}
            className="rounded border px-4 py-2 font-medium disabled:opacity-50">
            {busy ? 'Searching…' : 'Look up'}
          </button>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Your address is sent to Hamilton County&rsquo;s public parcel service to find your assessed
          value. It is not stored or logged by this site.
        </p>
      </form>

      <button type="button" className="text-sm underline" onClick={() => setManualOpen((v) => !v)}>
        Enter assessed value manually
      </button>

      {manualOpen && (
        <form onSubmit={calculateManual} className="space-y-2 rounded border p-4">
          <label htmlFor="manual-av" className="block font-medium">Gross assessed value</label>
          <input id="manual-av" className="w-full rounded border p-2" inputMode="numeric"
            placeholder="e.g. 350000" value={manualAV} onChange={(e) => setManualAV(e.target.value)} />
          <label htmlFor="manual-district" className="block font-medium">Taxing district</label>
          <select id="manual-district" className="w-full rounded border p-2"
            value={manualDistrict} onChange={(e) => setManualDistrict(e.target.value)}>
            {DISTRICTS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Inside Noblesville city limits, choose Noblesville City. Not sure? Your taxing district is
            printed on your tax bill (Form TS-1).
          </p>
          <button type="submit" className="rounded border px-4 py-2 font-medium">Calculate</button>
        </form>
      )}

      {error && <p role="alert" className="rounded border border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950">{error}</p>}

      {candidates && candidates.length === 0 && (
        <p className="text-sm">
          No matching parcels found in the Noblesville Schools district. Check the spelling, try just the
          street number and name, or enter your assessed value manually above.
        </p>
      )}

      {candidates && candidates.length > 1 && !selection && (
        <ul className="space-y-1">
          {candidates.map((c) => (
            <li key={c.parcelNo}>
              <button type="button" onClick={() => select(c)} className="w-full rounded border p-2 text-left hover:bg-gray-50 dark:hover:bg-gray-900">
                {c.address}, {c.city} {c.zip} — gross AV {fmtDollars(c.grossAV)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {outOfDistrict && (
        <p className="rounded border p-3 text-sm">
          This tool covers homes in the Noblesville Schools district (its five Hamilton County taxing
          districts). That parcel&rsquo;s taxing district isn&rsquo;t one of them, so its school rates differ
          and these numbers wouldn&rsquo;t apply.
        </p>
      )}

      {selection?.kind === 'parcel' && (
        <Results
          grossAV={selection.parcel.grossAV}
          district={selection.district}
          homestead={selection.parcel.homestead}
          assessmentYear={selection.parcel.assessmentYear || null}
          propertyReportUrl={selection.parcel.propertyReportUrl || null}
        />
      )}
      {selection?.kind === 'manual' && (
        <Results grossAV={selection.grossAV} district={selection.district}
          homestead={true} assessmentYear={null} propertyReportUrl={null} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Replace `app/page.tsx`**

```tsx
import Calculator from '@/components/Calculator';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">
          Noblesville Schools Referendum: what it means for your property taxes
        </h1>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          On November 3, 2026, Noblesville voters will decide an operating referendum for Noblesville
          Schools. Enter your address to see an estimate of your property tax bill today, if the
          referendum passes, and if it fails — with every number sourced and every step of the math shown.{' '}
          <Link className="underline" href="/methodology">How these estimates work</Link>.
        </p>
      </header>
      <Calculator />
    </main>
  );
}
```

- [ ] **Step 5: Update `app/layout.tsx`**

Set metadata and add the required footer (keep the scaffold's font/body structure):

```tsx
export const metadata: Metadata = {
  title: 'Noblesville Referendum Tax Estimator',
  description:
    'Neutral, sourced estimates of your Noblesville property tax bill if the 2026 Noblesville Schools referendum passes or fails.',
};
```

Inside `<body>`, after `{children}`:

```tsx
<footer className="mx-auto max-w-3xl p-6 text-xs text-gray-600 dark:text-gray-400">
  This site is not affiliated with Noblesville Schools or any campaign. Estimates only — not a
  bill. No addresses or lookups are stored.
</footer>
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run components/Calculator.test.tsx && npm run test`
Expected: Calculator tests PASS (4 tests); full suite PASS.

- [ ] **Step 7: Manual smoke in dev**

Run: `npm run dev` and load http://localhost:3000 — search a real Noblesville address (e.g., a Conner St address), confirm candidates appear and the table renders against the live county endpoint. Then stop the server.

- [ ] **Step 8: Commit**

```bash
git add components/Calculator.tsx components/Calculator.test.tsx app/page.tsx app/layout.tsx package.json package-lock.json
git commit -m "feat: address search UI with candidate picker, manual entry, results"
```

---

### Task 10: Methodology page

**Files:**
- Create: `app/methodology/page.tsx`

**Interfaces:**
- Consumes: `SOURCES`, `REFERENDUM` (Task 2)
- Produces: `/methodology` static page (linked from Task 9's landing page)

- [ ] **Step 1: Create `app/methodology/page.tsx`**

```tsx
import { REFERENDUM, SOURCES } from '@/lib/tax/assumptions';
import Link from 'next/link';

export const metadata = { title: 'Methodology — Noblesville Referendum Tax Estimator' };

export default function Methodology() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">How these estimates work</h1>
      <p><Link className="underline" href="/">← Back to the calculator</Link></p>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">What&rsquo;s on the ballot</h2>
        <p className="text-sm">
          Noblesville Schools has an operating referendum on the November 3, 2026 ballot. It authorizes a
          rate of up to $0.57 per $100 of net assessed value for up to 8 years, replacing the 2018
          operating referendum ($0.37), which expires after 2026. A separate $0.08 referendum debt rate,
          approved in 2010, continues through 2032 <em>regardless of this vote</em> — so &ldquo;fails&rdquo;
          does not mean zero referendum tax.{' '}
          <a className="underline" href={SOURCES.dlgfDetermination}>DLGF determination</a> ·{' '}
          <a className="underline" href={SOURCES.districtReferendumPage}>district referendum page</a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Why we show two &ldquo;passes&rdquo; numbers</h2>
        <p className="text-sm">
          The ballot authorizes up to $0.57. The district has publicly committed to set a rate no higher
          than $0.41 for 2027 (and says it will not use the full $0.57 in all eight years), but that
          commitment is not legally binding and later years may be higher. We show the bill at $0.41 and
          at $0.57 so you can see both the plan and the ceiling.{' '}
          <a className="underline" href={REFERENDUM.committed2027.source}>Source</a>
        </p>
        <p className="text-sm">
          This is also why you may have seen two very different cost figures: the ballot&rsquo;s
          statutorily-required &ldquo;$955 per year for a median $350,000 residence&rdquo; is computed at
          the $0.57 maximum, while the district&rsquo;s &ldquo;$2.30 more per month&rdquo; framing reflects
          its below-maximum rate plan. Both are arithmetic from the same law — at different rates.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">The 2025 property tax law (SEA 1)</h2>
        <p className="text-sm">
          Indiana&rsquo;s 2025 reform changes homestead deductions each year: for taxes paid in 2026 your
          home&rsquo;s assessed value is reduced by $48,000 and then by 40% of the remainder; for taxes
          paid in 2027 it&rsquo;s $40,000 and 46%. It also adds a credit of 10% of your bill (up to $300)
          that excludes referendum taxes. Because referendum rates apply to that shrinking net assessed
          value, a 57&cent; maximum in 2027 raises fewer dollars per home than it would have in 2026 —
          which is the district&rsquo;s stated reason the replacement maximum is higher than the expiring
          37&cent; rate. <a className="underline" href={SOURCES.sea1Memo}>DLGF guidance memo</a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Estimates, not bills</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>2027 non-referendum rates are not certified until January 2027; we hold them at certified 2026 levels (<a className="underline" href={SOURCES.budgetOrder2026}>2026 budget order</a>).</li>
          <li>Assessed values come from Hamilton County&rsquo;s public parcel data at lookup time and reflect the most recent assessment.</li>
          <li>This tool models owner-occupied homesteads only (1% cap class). Rentals, farms, and businesses follow different rules.</li>
          <li>Other deductions some households have (mortgage age 65+, veteran, etc.) are not modeled and would lower all three columns.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Privacy</h2>
        <p className="text-sm">
          Addresses you enter are forwarded to Hamilton County&rsquo;s public parcel service to find your
          assessed value and are not stored or logged by this site. All tax math runs in your browser.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify build and lint**

Run: `npm run build`
Expected: `/methodology` compiles as a static page; no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/methodology/
git commit -m "feat: methodology page with sources and caveats"
```

---

### Task 11: Playwright smoke test

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: the running app (Tasks 7-10); intercepts `/api/lookup` so CI never hits the county
- Produces: `npm run e2e`

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:3100' },
  webServer: {
    command: 'npm run dev -- --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 2: Create `e2e/smoke.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

const candidate = {
  parcelNo: '160', stateParcelNo: '29', address: '1234 CONNER ST', city: 'Noblesville',
  zip: '46060', grossAV: 350000, assessmentYear: 2026, homestead: true,
  taxDistrictName: 'Noblesville City', propertyReportUrl: '',
};

test('address → results → math section', async ({ page }) => {
  await page.route('**/api/lookup**', (route) =>
    route.fulfill({ json: { candidates: [candidate] } }),
  );
  await page.goto('/');
  await page.getByLabel(/address/i).fill('1234 conner st');
  await page.getByRole('button', { name: /look up/i }).click();
  await expect(page.getByText('$4,015')).toBeVisible();  // single candidate auto-selects
  await expect(page.getByText('$3,334')).toBeVisible();
  await page.getByText(/how this was calculated/i).click();
  await expect(page.getByText('$181,200').first()).toBeVisible();
  await expect(
    page.getByText(/not affiliated with Noblesville Schools or any campaign/i),
  ).toBeVisible();
});
```

- [ ] **Step 3: Install browsers and run**

```bash
npx playwright install chromium
npm run e2e
```

Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "test: Playwright smoke test with mocked county lookup"
```

---

### Task 12: AWS Amplify deployment config

**Files:**
- Create: `amplify.yml`
- Create: `README.md` (replace scaffold README)

**Interfaces:**
- Consumes: the complete app
- Produces: repo ready to connect to AWS Amplify Hosting; documented manual steps for the user's new AWS account + Route53 domain

- [ ] **Step 1: Create `amplify.yml`**

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run test
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

- [ ] **Step 2: Replace `README.md`**

```markdown
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
3. Domain: Route53 → register the domain in the same account. Then Amplify →
   Domain management → Add domain → select the Route53 zone; Amplify provisions
   the ACM certificate and DNS records automatically.

Every push to the connected branch redeploys. Unit tests failing fails the build.

## Updating numbers

When 2027 rates certify (January 2027) or the district updates its commitments,
edit `lib/tax/assumptions.ts` only — every figure carries its source URL and a
`confirmed | estimated | public-commitment` status that the UI displays.
```

- [ ] **Step 3: Final full verification**

```bash
npm run test && npm run build && npm run e2e
```

Expected: all unit tests pass, production build succeeds, e2e passes.

- [ ] **Step 4: Commit**

```bash
git add amplify.yml README.md
git commit -m "chore: Amplify Hosting config and deployment docs"
```

---

## Self-Review Notes

- **Spec coverage:** three-scenario comparison (Tasks 5, 8), committed-$0.41-plus-max presentation (Task 8), show-the-math with sources (Task 8), manual entry (Task 9), non-homestead and out-of-district notices (Tasks 8-9), methodology/FAQ (Task 10), neutral footer + privacy (Tasks 9-10), no-logging lookup route (Task 7), ballot-anchor and worked-example tests (Task 4), cap/credit boundary tests (Task 4), all five districts (Task 2), Amplify deploy (Task 12). Phase-2 readiness: engine is pure (Tasks 3-5).
- **Known deferred check:** exact `HOMESTEAD`/`hmstd_code` semantics are verified against a live fixture in Task 6 Step 1 and the predicate adjusted there — by design, not a placeholder.
- **Type consistency:** `ParcelCandidate` (Task 6) is consumed by Tasks 7 and 9 with identical fields; `BillBreakdown` fields used in Task 8's `MathRows` match Task 2's type; `findDistrict` returns `TaxDistrict | null` everywhere.
