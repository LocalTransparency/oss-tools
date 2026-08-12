# Referendum Rate Update + Multi-Year Projection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update Noblesville Schools' committed 2027 referendum rate to $0.385, and extend the tool to project the referendum line across the district's published 2027–2034 rate schedule with 1%/2%/3% cap-class support.

**Architecture:** The tax engine stays statewide-law-plus-config. Per-year rates and AV-growth assumptions become optional `Sourced` maps on the district config, so districts without a published schedule are unaffected. A new pure `projection.ts` computes the referendum line year-by-year; the existing four-scenario full-bill pay-2027 view is untouched in purpose and stays the primary answer. Assessed value generalizes from a single number to three cap-class buckets.

**Tech Stack:** TypeScript, Next.js 16 (App Router), React 19, Vitest, Playwright, Tailwind v4, `@localtransparency/design` tokens.

**Spec:** `docs/superpowers/specs/2026-08-12-referendum-rate-update-multiyear-design.md`

## Global Constraints

- **No new runtime dependencies.** The app's runtime deps are exactly `next`, `react`, `react-dom`, `@localtransparency/design`. The chart is hand-rolled inline SVG.
- **Every figure is a `Sourced<T>`** with `value`, `source` (an `https://` URL), `status` of `confirmed | estimated | public-commitment`, and optional `note`. No placeholder or fake data ships.
- **Statutory values come from primary sources.** The district's calculator is a cross-check, never the source for statewide law. Unverifiable years ship as `status: 'estimated'`.
- **Neutrality:** code, tests, config, docs, commit messages, and PR text state findings and definitions only. No characterization of the district's choices anywhere in this repo.
- **Rates may carry a half-cent** (e.g. `$0.385`). Never format a rate with `toFixed(2)`.
- **Privacy:** nothing a visitor enters is stored or logged. The comparison artifact uses parcel numbers, never street addresses.
- **Test commands:** all tests `npm run test`; single file `npx vitest run <path>`; single case `npx vitest run <path> -t "<name>"`; e2e `npm run e2e`.
- Work in `noblesville/2026-school-referendum/`. All paths below are relative to it.

---

## File Structure

**Create:**
- `lib/tax/projection.ts` — pure year-by-year referendum-line projection + the four headline statistics
- `lib/tax/projection.test.ts`
- `lib/tax/districtCalculator.fixture.ts` — vendored district constants + a reimplementation of their arithmetic, test-only
- `lib/tax/districtCalculator.test.ts` — cross-check harness
- `lib/tax/indiana/capClass.ts` — Indiana cap-class inference from parcel attributes
- `lib/tax/indiana/capClass.test.ts`
- `components/CapClassPanel.tsx` + `.test.tsx` — inferred class display + three-bucket override
- `components/Projection.tsx` + `.test.tsx` — growth control, multi-year table
- `components/ProjectionChart.tsx` + `.test.tsx` — inline SVG chart
- `docs/district-calculator-comparison.md` — the checkbox-2 artifact

**Modify:**
- `lib/format.ts` — add `fmtRate`
- `lib/tax/types.ts` — `CapClass`, `AvBuckets`, widened `payYear`, `projection` config block
- `lib/tax/indiana/assumptions.ts` — 9-year `DEDUCTIONS`, `CAP2_AV_DEDUCTION`, `CIRCUIT_BREAKER_RATES`
- `lib/tax/indiana/districts/noblesville.ts` — `committed2027` → 0.385, `projection` block, `explainer`
- `lib/tax/engine.ts` — bucket-aware `computeNetAV`, per-class circuit breaker
- `lib/tax/scenarios.ts` — use `fmtRate` in labels
- `lib/lookup/arcgis.ts` — new `OUT_FIELDS`, extended `ParcelCandidate`
- `app/api/lookup/route.ts` — pass through new fields
- `components/Calculator.tsx`, `components/Results.tsx` — bucket plumbing, `fmtRate`
- `app/methodology/page.tsx` — `fmtRate`, rewritten crossover FAQ, projection section
- `docs/hamilton-county-2026-referendum-data.md`, `README.md`

---

## Task 1: Rate formatter

The committed rate becomes `$0.385`. Eight call sites format rates with `toFixed(2)`, which renders that as **`$0.39`** — a misstatement of the central number in the tool. This must land before Task 2.

**Files:**
- Modify: `lib/format.ts`
- Test: `lib/format.test.ts` (create)

**Interfaces:**
- Produces: `fmtRate(rate: number): string` — a bare decimal string with no `$`, minimum 2 and maximum 3 decimals, trailing zero trimmed only past the second place.

- [ ] **Step 1: Write the failing test**

Create `lib/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fmtRate } from './format';

describe('fmtRate', () => {
  it('keeps a half-cent rate at three decimals', () => {
    expect(fmtRate(0.385)).toBe('0.385');
  });

  it('renders whole-cent rates at two decimals', () => {
    expect(fmtRate(0.57)).toBe('0.57');
    expect(fmtRate(0.37)).toBe('0.37');
    expect(fmtRate(0.4)).toBe('0.40');
    expect(fmtRate(0.25)).toBe('0.25');
  });

  it('never rounds a half-cent away', () => {
    expect(fmtRate(0.385)).not.toBe('0.39');
    expect(fmtRate(0.545)).toBe('0.545');
    expect(fmtRate(0.465)).toBe('0.465');
  });

  it('handles zero', () => {
    expect(fmtRate(0)).toBe('0.00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/format.test.ts`
Expected: FAIL — `fmtRate` is not exported from `./format`.

- [ ] **Step 3: Implement**

Append to `lib/format.ts`:

```ts
/**
 * Referendum rates are quoted in cents per $100 and can carry a half-cent
 * (the district's committed 2027 rate is 38.5¢). `toFixed(2)` would render
 * that as "0.39" — a misstatement of the figure this tool exists to report.
 * Show three decimals, trimming a trailing zero only past the second place.
 */
export const fmtRate = (rate: number) =>
  rate.toFixed(3).replace(/(\.\d{2}\d*?)0+$/, '$1');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/format.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/format.ts lib/format.test.ts
git commit -m "feat: add fmtRate so half-cent referendum rates are not rounded"
```

---

## Task 2: Adopt the $0.385 committed 2027 rate

The shippable Phase 1. The live site currently shows the superseded $0.41.

**Files:**
- Modify: `lib/tax/indiana/districts/noblesville.ts:31-40`
- Modify: `lib/tax/scenarios.ts:30-43`
- Modify: `components/Results.tsx:32,107-108,147-148`
- Modify: `app/methodology/page.tsx:21-23`
- Test: `lib/tax/engine.test.ts:57-62`, `lib/tax/scenarios.test.ts:17-26,65-68,75-80`, `components/Results.test.tsx:35`

**Interfaces:**
- Consumes: `fmtRate` from Task 1.
- Produces: `NOBLESVILLE.referendum.committed2027.value === 0.385`. Scenario label text becomes `If it passes — committed 2027 rate ($0.385)`.

- [ ] **Step 1: Update the failing tests to the new expected values**

These values were computed from the engine's own formulas at the new rate; non-referendum math is unchanged, so `current` and `fail` totals do not move.

In `lib/tax/scenarios.test.ts`, replace lines 17-25:

```ts
    expect(scenarios.passCommitted).toMatchObject({
      payYear: 2027, standardDeduction: 40000, supplementalRate: 0.46,
      referendumOperatingRate: 0.385, referendumDebtRate: 0.08,
    });
    expect(scenarios.passMax.referendumOperatingRate).toBe(0.57);
    expect(scenarios.fail).toMatchObject({ referendumOperatingRate: 0, referendumDebtRate: 0.08 });
    // committed vs max differ for Noblesville — guards against swapping the interpolated values
    expect(scenarios.passCommitted.label).toBe('If it passes — committed 2027 rate ($0.385)');
    expect(scenarios.passMax.label).toBe('If it passes — authorized maximum ($0.57)');
```

Replace line 67:

```ts
    expect(r.passCommitted.total - r.fail.total).toBeCloseTo(644.49, 2); // 167400 × 0.385%
```

Replace line 61 and line 78:

```ts
    expect(r.passCommitted.total).toBeCloseTo(3978.41, 2);
```

```ts
    expect(r.passCommitted.total).toBeCloseTo(2879.21, 2);
```

In `lib/tax/engine.test.ts`, replace lines 57-62:

```ts
  it('pass at committed $0.385: $350k city home ≈ $3,978.41', () => {
    const b = computeBill(350000, city, SCENARIOS.passCommitted, NOBLESVILLE);
    expect(b.nonReferendumNet).toBeCloseTo(3200, 2);  // 3523.60 capped at 3500, minus $300 credit
    expect(b.referendumOperatingTax).toBeCloseTo(644.49, 2); // 167400 × 0.385%
    expect(b.referendumTax).toBeCloseTo(778.41, 2);   // 167400 × 0.465%
    expect(b.total).toBeCloseTo(3978.41, 2);
  });
```

In `components/Results.test.tsx`, replace line 35:

```ts
    expect(screen.getByText('$3,978')).toBeInTheDocument();   // pass at committed 0.385
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/tax components/Results.test.tsx`
Expected: FAIL — assertions still see the 0.41-derived values (e.g. received `4020.26`, expected `3978.41`).

- [ ] **Step 3: Change the config**

In `lib/tax/indiana/districts/noblesville.ts`, add to `SOURCES`:

```ts
  districtAnnouncement2026_08_12:
    'https://www.noblesvilleschools.org/referendum',
```

Replace the `committed2027` entry (lines 31-34):

```ts
    committed2027: {
      value: 0.385, source: SOURCES.districtAnnouncement2026_08_12, status: 'public-commitment',
      note: 'District public commitment for 2027 only, announced 2026-08-12 (revised down from $0.41); not legally binding; later years are projected higher, up to $0.57 authorized.',
    },
```

Replace `explainer` (line 39-40):

```ts
    explainer:
      'Noblesville Schools’ 2026 question replaces its current operating referendum ($0.37) with a new operating rate of up to $0.57 (the district publicly committed to $0.385 for 2027 on 2026-08-12). A separate referendum debt rate ($0.08, levied through 2032) stays on your bill either way — it is not part of this vote.',
```

- [ ] **Step 4: Route every rate through `fmtRate`**

In `lib/tax/scenarios.ts`, add the import and replace lines 30-43's three `toFixed(2)` uses:

```ts
import { fmtRate } from '../format';
```

```ts
      label: config.referendum.committed2027
        ? `If it passes — committed 2027 rate ($${fmtRate(committedRate)})`
        : `If it passes — authorized maximum ($${fmtRate(committedRate)})`,
```

```ts
      label: `If it passes — authorized maximum ($${fmtRate(proposedMaxRate)})`,
```

In `components/Results.tsx`, import `fmtRate` from `../lib/format` and replace `debt.value.toFixed(2)` (line 32), both `REFERENDUM.proposedMax.value.toFixed(2)` (lines 107-108, 148), and both `committed.value.toFixed(2)` (lines 107, 147) with `fmtRate(...)` of the same expression.

In `app/methodology/page.tsx`, replace lines 21-23:

```ts
  const nobMax = fmtRate(nobRef.proposedMax.value);
  const nobCurrent = fmtRate(nobRef.currentOperating!.value);
  const nobCommitted = fmtRate(nobRef.committed2027!.value);
```

adding `import { fmtRate } from '@/lib/format';` (match the file's existing import style).

- [ ] **Step 5: Run the full suite**

Run: `npm run test`
Expected: PASS. If any assertion still expects `0.39`, the call site was missed in Step 4.

- [ ] **Step 6: Commit**

```bash
git add lib/tax components/Results.tsx components/Results.test.tsx app/methodology/page.tsx
git commit -m "feat: adopt district's revised \$0.385 committed 2027 referendum rate

Noblesville Schools announced 2026-08-12 that it will levy \$0.385 in 2027
rather than the previously committed \$0.41. Updates the config, routes all
rate rendering through fmtRate so the half-cent is not rounded to \$0.39, and
recomputes affected test expectations.

Refs localtransparency/noblesville#5"
```

---

## Task 3: Rewrite the crossover FAQ

The methodology page claims a pass-vs-current crossover "near $440,000". At $0.385 the crossover moves to roughly **$124,900** — so a $350k homestead now shows a *decrease*, inverting the page's worked example and one existing test.

**Files:**
- Modify: `app/methodology/page.tsx:84-88,116`
- Test: `lib/tax/scenarios.test.ts:82-101`

**Interfaces:**
- Consumes: `NOBLESVILLE` at `committed2027 = 0.385` from Task 2.

- [ ] **Step 1: Replace the crossover test block**

Replace `lib/tax/scenarios.test.ts` lines 82-101 entirely:

```ts
  // Guards the methodology FAQ crossover claims at the district's committed
  // $0.385 rate, for Noblesville City. Net AV is equal between pay-2026 and
  // pay-2027 at exactly $120,000 gross AV:
  //   0.60 × (AV − 48000) = 0.54 × (AV − 40000)  →  0.06 × AV = 7200  →  AV = 120000
  // The total-bill crossover sits slightly above that, near $124,900, because
  // the pay-2027 referendum rate ($0.465 combined) exceeds pay-2026's ($0.45).
  describe('methodology FAQ crossover claims (Noblesville City, committed $0.385 rate)', () => {
    it('net AV is identical under pay-2026 and pay-2027 at exactly $120,000 gross AV', () => {
      const scenarios = buildScenarios(NOBLESVILLE);
      const a = computeNetAV(120000, scenarios.current);
      const b = computeNetAV(120000, scenarios.passCommitted);
      expect(a.netAV).toBeCloseTo(b.netAV, 6);
      expect(a.netAV).toBeCloseTo(43200, 6);
    });

    it('below the crossover ($120k AV), pass-committed still increases vs. current', () => {
      const r = computeAllScenarios(120000, city, NOBLESVILLE);
      expect(r.passCommitted.total).toBeGreaterThan(r.current.total);
    });

    it('above the crossover ($130k AV), pass-committed decreases vs. current', () => {
      const r = computeAllScenarios(130000, city, NOBLESVILLE);
      expect(r.passCommitted.total).toBeLessThan(r.current.total);
    });

    it('at $350k AV, pass-committed decreases while pass-max still increases', () => {
      const r = computeAllScenarios(350000, city, NOBLESVILLE);
      expect(r.passCommitted.total).toBeLessThan(r.current.total);
      expect(r.passMax.total).toBeGreaterThan(r.current.total);
    });
  });
```

Add `computeNetAV` to the `./engine` import on line 3:

```ts
import { computeNetAV, findDistrict } from './engine';
```

- [ ] **Step 2: Run to verify the new assertions fail against stale page copy only**

Run: `npx vitest run lib/tax/scenarios.test.ts`
Expected: PASS — the config already changed in Task 2. If `at $350k AV, pass-committed decreases` fails, Task 2 was not applied.

- [ ] **Step 3: Update the methodology copy**

In `app/methodology/page.tsx`, replace the crossover bullet (lines ~84-88):

```tsx
          - Pass-vs-current crossover: referendum tax at the committed 2027 rate on pay-2027 net
            AV equals the pay-2026 bill when
            <code>
              0.465% × 0.54 × (AV − 40000) = 0.45% × 0.60 × (AV − 48000)
            </code>
            → AV ≈ $124,900. Net assessed value alone is equal at exactly $120,000, where
            <code>0.60 × (AV − 48000) = 0.54 × (AV − 40000)</code>.
```

Replace the prose at line ~116:

```tsx
            about $124,900. Above that, the estimate at the district&rsquo;s committed 2027 rate is
            generally <em>lower</em> than the current bill, because SEA 1&rsquo;s larger supplemental
            deduction shrinks net assessed value faster than the referendum rate rises. At a
            district&rsquo;s authorized <em>maximum</em>, the estimate generally increases at
```

Add immediately after that paragraph:

```tsx
          <p>
            This comparison holds non-referendum rates at their certified pay-2026 levels, which is
            flagged <code>estimated</code> throughout. If non-referendum rates rise for pay-2027, the
            decrease shown here shrinks or reverses. It also compares the whole tax bill; the
            referendum line by itself rises at every rate above $0.37.
          </p>
```

- [ ] **Step 4: Run the full suite**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/methodology/page.tsx lib/tax/scenarios.test.ts
git commit -m "docs: recompute pass-vs-current crossover for the \$0.385 rate

Crossover moves from ~\$440,000 to ~\$124,900; a \$350k homestead now shows a
decrease on the full bill. Adds the net-AV crossover identity (\$120,000) and
states the non-referendum-rate assumption the comparison rests on.

Refs localtransparency/noblesville#5"
```

---

## Task 4: Extend the statewide deduction schedule to 2034

**Files:**
- Modify: `lib/tax/indiana/assumptions.ts`
- Modify: `lib/tax/types.ts`
- Test: `lib/tax/indiana/assumptions.test.ts` (create)

**Interfaces:**
- Produces: `CapClass`, `DEDUCTIONS` keyed 2026–2034, `CAP2_AV_DEDUCTION: Sourced<Record<number, number>>`, `CIRCUIT_BREAKER_RATES: Sourced<Record<CapClass, number>>`. `CIRCUIT_BREAKER_RATE` is **removed**; Task 7 updates its only consumer.

- [ ] **Step 1: Add the `CapClass` type**

In `lib/tax/types.ts`, add above `Sourced`:

```ts
/**
 * Indiana constitutional property-tax caps (IC 6-1.1-20.6). A parcel's AV can
 * span more than one class; the county's open parcel data does not publish the
 * allocation, so this tool infers a dominant class and lets the user override.
 */
export type CapClass = 1 | 2 | 3;
```

- [ ] **Step 2: Write the failing test**

Create `lib/tax/indiana/assumptions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEDUCTIONS, CAP2_AV_DEDUCTION, CIRCUIT_BREAKER_RATES } from './assumptions';

const YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034];

describe('DEDUCTIONS', () => {
  it('covers every projection year', () => {
    for (const y of YEARS) expect(DEDUCTIONS[y], `missing ${y}`).toBeDefined();
  });

  it('phases the standard deduction out to zero by 2031', () => {
    expect(DEDUCTIONS[2026].value.standard).toBe(48000);
    expect(DEDUCTIONS[2027].value.standard).toBe(40000);
    expect(DEDUCTIONS[2031].value.standard).toBe(0);
    expect(DEDUCTIONS[2034].value.standard).toBe(0);
  });

  it('raises the supplemental rate monotonically then holds', () => {
    const rates = YEARS.map((y) => DEDUCTIONS[y].value.supplementalRate);
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    expect(DEDUCTIONS[2031].value.supplementalRate).toBeCloseTo(0.667, 6);
    expect(DEDUCTIONS[2034].value.supplementalRate).toBeCloseTo(0.667, 6);
  });

  it('carries a source URL and status on every year', () => {
    for (const y of YEARS) {
      expect(DEDUCTIONS[y].source).toMatch(/^https:\/\//);
      expect(['confirmed', 'estimated', 'public-commitment']).toContain(DEDUCTIONS[y].status);
    }
  });
});

describe('CAP2_AV_DEDUCTION', () => {
  it('phases in to 33.4% by 2031 and holds', () => {
    expect(CAP2_AV_DEDUCTION.value[2026]).toBeCloseTo(0.06, 6);
    expect(CAP2_AV_DEDUCTION.value[2027]).toBeCloseTo(0.12, 6);
    expect(CAP2_AV_DEDUCTION.value[2031]).toBeCloseTo(0.334, 6);
    expect(CAP2_AV_DEDUCTION.value[2034]).toBeCloseTo(0.334, 6);
  });
});

describe('CIRCUIT_BREAKER_RATES', () => {
  it('is 1/2/3 percent by cap class', () => {
    expect(CIRCUIT_BREAKER_RATES.value[1]).toBeCloseTo(0.01, 6);
    expect(CIRCUIT_BREAKER_RATES.value[2]).toBeCloseTo(0.02, 6);
    expect(CIRCUIT_BREAKER_RATES.value[3]).toBeCloseTo(0.03, 6);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run lib/tax/indiana/assumptions.test.ts`
Expected: FAIL — `CAP2_AV_DEDUCTION` and `CIRCUIT_BREAKER_RATES` are not exported; `DEDUCTIONS[2028]` is undefined.

- [ ] **Step 4: Implement**

Replace the body of `lib/tax/indiana/assumptions.ts` below `SOURCES`, keeping `SUPP_DEDUCTION_CAP_RATE` and `HOMESTEAD_CREDIT` as they are:

```ts
import type { CapClass, Sourced } from '../types';

/**
 * SEA 1 (2025) homestead deduction schedule, by pay year.
 *
 * 2026 and 2027 are confirmed against the DLGF memo. 2028–2034 are marked
 * `estimated` until each year is verified against the memo or the statute
 * directly — the district's calculator uses the same figures, which is a
 * cross-check, not a source. Promote a year to `confirmed` only with a
 * primary-source citation.
 */
export const DEDUCTIONS: Record<number, Sourced<{ standard: number; supplementalRate: number }>> = {
  2026: { value: { standard: 48000, supplementalRate: 0.40 }, source: SOURCES.sea1Memo, status: 'confirmed' },
  2027: { value: { standard: 40000, supplementalRate: 0.46 }, source: SOURCES.sea1Memo, status: 'confirmed' },
  2028: { value: { standard: 30000, supplementalRate: 0.52 }, source: SOURCES.sea1Memo, status: 'estimated', note: 'Out-year schedule pending primary-source verification.' },
  2029: { value: { standard: 20000, supplementalRate: 0.57 }, source: SOURCES.sea1Memo, status: 'estimated', note: 'Out-year schedule pending primary-source verification.' },
  2030: { value: { standard: 10000, supplementalRate: 0.62 }, source: SOURCES.sea1Memo, status: 'estimated', note: 'Out-year schedule pending primary-source verification.' },
  2031: { value: { standard: 0, supplementalRate: 0.667 }, source: SOURCES.sea1Memo, status: 'estimated', note: 'Standard deduction fully phased out; supplemental holds from here.' },
  2032: { value: { standard: 0, supplementalRate: 0.667 }, source: SOURCES.sea1Memo, status: 'estimated', note: 'Standard deduction fully phased out; supplemental holds from here.' },
  2033: { value: { standard: 0, supplementalRate: 0.667 }, source: SOURCES.sea1Memo, status: 'estimated', note: 'Standard deduction fully phased out; supplemental holds from here.' },
  2034: { value: { standard: 0, supplementalRate: 0.667 }, source: SOURCES.sea1Memo, status: 'estimated', note: 'Standard deduction fully phased out; supplemental holds from here.' },
};

/**
 * SEA 1 phased deduction against cap-2 assessed value (non-homestead
 * residential and agricultural land). Cap-3 property receives no equivalent.
 */
export const CAP2_AV_DEDUCTION: Sourced<Record<number, number>> = {
  value: {
    2026: 0.06, 2027: 0.12, 2028: 0.19, 2029: 0.25,
    2030: 0.30, 2031: 0.334, 2032: 0.334, 2033: 0.334, 2034: 0.334,
  },
  source: SOURCES.sea1Memo,
  status: 'estimated',
  note: 'Phase-in schedule pending primary-source verification beyond pay-2027.',
};

/**
 * Indiana constitutional circuit-breaker caps by class (IC 6-1.1-20.6):
 * 1% homestead, 2% other residential and agricultural land, 3% all other.
 * Applies to non-referendum liability only; referendum rates sit outside it.
 */
export const CIRCUIT_BREAKER_RATES: Sourced<Record<CapClass, number>> = {
  value: { 1: 0.01, 2: 0.02, 3: 0.03 },
  source: SOURCES.sea1Memo,
  status: 'confirmed',
  note: 'Applies to non-referendum liability only; referendum rates are exempt from the cap.',
};
```

Delete the old `CIRCUIT_BREAKER_RATE` export.

- [ ] **Step 5: Run the assumptions test**

Run: `npx vitest run lib/tax/indiana/assumptions.test.ts`
Expected: PASS. `npm run test` will still fail to typecheck in `engine.ts` — Task 7 fixes that; that is expected between tasks.

- [ ] **Step 6: Commit**

```bash
git add lib/tax/indiana/assumptions.ts lib/tax/indiana/assumptions.test.ts lib/tax/types.ts
git commit -m "feat: extend SEA 1 deduction schedule to 2034, add cap-class rates

Out-years ship as estimated pending primary-source verification.

Refs localtransparency/noblesville#5"
```

---

## Task 5: Add the district's published rate schedule to config

**Files:**
- Modify: `lib/tax/types.ts`
- Modify: `lib/tax/indiana/districts/noblesville.ts`
- Test: `lib/tax/indiana/districts/noblesville.test.ts` (create)

**Interfaces:**
- Produces: `DistrictReferendumConfig.referendum.projection?: { operatingRates: Sourced<Record<number, number>>; avGrowth: Sourced<Record<number, number>> }`.

- [ ] **Step 1: Extend the config type**

In `lib/tax/types.ts`, inside `DistrictReferendumConfig['referendum']`, after `committed2027`:

```ts
    /**
     * A district's own published multi-year plan, when one exists. Optional:
     * the other Hamilton County districts have published no schedule, and the
     * multi-year view renders only where this is present.
     */
    projection?: {
      operatingRates: Sourced<Record<number, number>>; // pay year → operating rate per $100
      avGrowth: Sourced<Record<number, number>>;       // pay year → assumed AV growth, as a fraction
    };
```

- [ ] **Step 2: Write the failing test**

Create `lib/tax/indiana/districts/noblesville.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NOBLESVILLE } from './noblesville';

const projection = NOBLESVILLE.referendum.projection!;

describe('NOBLESVILLE projection', () => {
  it('carries the district\'s published operating rate for every year 2026-2034', () => {
    const expected: Record<number, number> = {
      2026: 0.37, 2027: 0.385, 2028: 0.425, 2029: 0.465,
      2030: 0.505, 2031: 0.545, 2032: 0.545, 2033: 0.545, 2034: 0.545,
    };
    expect(projection.operatingRates.value).toEqual(expected);
  });

  it('carries the district\'s AV growth assumption', () => {
    expect(projection.avGrowth.value[2027]).toBeCloseTo(0.053, 6);
    for (const y of [2028, 2029, 2030, 2031, 2032, 2033, 2034]) {
      expect(projection.avGrowth.value[y]).toBeCloseTo(0.035, 6);
    }
  });

  it('never exceeds the ballot-authorized maximum', () => {
    for (const rate of Object.values(projection.operatingRates.value)) {
      expect(rate).toBeLessThanOrEqual(NOBLESVILLE.referendum.proposedMax.value);
    }
  });

  // Drift guard: the schedule and the standalone commitment figures describe
  // the same facts. If the district revises one and not the other, fail here
  // rather than let the site disagree with itself.
  it('agrees with committed2027 and currentOperating', () => {
    expect(projection.operatingRates.value[2027]).toBe(NOBLESVILLE.referendum.committed2027!.value);
    expect(projection.operatingRates.value[2026]).toBe(NOBLESVILLE.referendum.currentOperating!.value);
  });

  it('is sourced and status-flagged', () => {
    expect(projection.operatingRates.source).toMatch(/^https:\/\//);
    expect(projection.operatingRates.status).toBe('public-commitment');
    expect(projection.avGrowth.status).toBe('public-commitment');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run lib/tax/indiana/districts/noblesville.test.ts`
Expected: FAIL — `projection` is undefined.

- [ ] **Step 4: Implement**

In `lib/tax/indiana/districts/noblesville.ts`, add to `SOURCES`:

```ts
  districtCalculator:
    'https://noblesvilleschoolsorg.finalsite.com/uploaded/NoblesvilleSchools_ReferendumCalculator.html',
```

Add inside `referendum`, after `committed2027`:

```ts
    projection: {
      operatingRates: {
        value: {
          2026: 0.37, 2027: 0.385, 2028: 0.425, 2029: 0.465,
          2030: 0.505, 2031: 0.545, 2032: 0.545, 2033: 0.545, 2034: 0.545,
        },
        source: SOURCES.districtCalculator,
        status: 'public-commitment',
        note: 'Per-year operating rates hardcoded in the district\'s published calculator (retrieved 2026-08-12). Rises 1.5 cents for 2027, then 4.0 cents per year through 2031, then holds; never reaches the authorized $0.57. Not legally binding — the board votes a rate annually.',
      },
      avGrowth: {
        value: {
          2027: 0.053, 2028: 0.035, 2029: 0.035, 2030: 0.035,
          2031: 0.035, 2032: 0.035, 2033: 0.035, 2034: 0.035,
        },
        source: SOURCES.districtCalculator,
        status: 'public-commitment',
        note: 'District assumption (retrieved 2026-08-12): 5.3% for 2027, stated as the median annual growth of local existing residential parcels between the Hamilton County 2026 and 2027 certified net AV data sets; 3.5% each year thereafter.',
      },
    },
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run lib/tax/indiana/districts/noblesville.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/tax/types.ts lib/tax/indiana/districts/noblesville.ts lib/tax/indiana/districts/noblesville.test.ts
git commit -m "feat: add the district's published 2026-2034 rate and AV-growth schedule

Extracted from the district's calculator, the only public artifact carrying the
out-year rates. Includes a drift guard against committed2027/currentOperating.

Refs localtransparency/noblesville#5"
```

---

## Task 6: Generalize assessed value to cap-class buckets

**Files:**
- Modify: `lib/tax/types.ts`, `lib/tax/engine.ts:20-28`
- Test: `lib/tax/engine.test.ts`

**Interfaces:**
- Consumes: `CapClass` (Task 4), `CAP2_AV_DEDUCTION` (Task 4).
- Produces:
  - `AvBuckets { cap1: number; cap2: number; cap3: number }`
  - `bucketsOf(grossAV: number, capClass: CapClass): AvBuckets`
  - `totalGrossAV(b: AvBuckets): number`
  - `computeNetAV(buckets: AvBuckets, s: ScenarioParams): { standardDeduction, supplementalDeduction, cap2Deduction, netAV }`

  `computeNetAV`'s first parameter changes from `number` to `AvBuckets`. Every caller must wrap with `bucketsOf`.

- [ ] **Step 1: Add types**

In `lib/tax/types.ts`:

```ts
/** Gross assessed value split by constitutional cap class. */
export interface AvBuckets {
  cap1: number; // homestead
  cap2: number; // other residential + agricultural land
  cap3: number; // all other real and personal property
}
```

Add `cap2Deduction: number;` to `BillBreakdown`, after `supplementalDeduction`.

- [ ] **Step 2: Write the failing parity test**

Append to `lib/tax/engine.test.ts`:

```ts
import { bucketsOf, totalGrossAV } from './engine';

describe('AvBuckets', () => {
  it('bucketsOf routes the whole value to the named class', () => {
    expect(bucketsOf(350000, 1)).toEqual({ cap1: 350000, cap2: 0, cap3: 0 });
    expect(bucketsOf(350000, 2)).toEqual({ cap1: 0, cap2: 350000, cap3: 0 });
    expect(bucketsOf(350000, 3)).toEqual({ cap1: 0, cap2: 0, cap3: 350000 });
  });

  it('totalGrossAV sums the buckets', () => {
    expect(totalGrossAV({ cap1: 350000, cap2: 100000, cap3: 50000 })).toBe(500000);
  });
});

describe('computeNetAV — cap-class behavior', () => {
  it('homestead deductions apply to cap1 only (parity with the pre-bucket engine)', () => {
    const r = computeNetAV(bucketsOf(350000, 1), SCENARIOS.current);
    expect(r.netAV).toBeCloseTo(181200, 2);
    expect(r.cap2Deduction).toBe(0);
  });

  it('cap2 AV gets the phased Cap 2 deduction and no homestead deduction', () => {
    // pay-2027 Cap 2 deduction is 12%: 100000 × (1 − 0.12) = 88,000
    const r = computeNetAV({ cap1: 0, cap2: 100000, cap3: 0 }, SCENARIOS.passCommitted);
    expect(r.standardDeduction).toBe(0);
    expect(r.supplementalDeduction).toBe(0);
    expect(r.cap2Deduction).toBeCloseTo(12000, 2);
    expect(r.netAV).toBeCloseTo(88000, 2);
  });

  it('cap3 AV receives no deduction at all', () => {
    const r = computeNetAV({ cap1: 0, cap2: 0, cap3: 100000 }, SCENARIOS.passCommitted);
    expect(r.netAV).toBeCloseTo(100000, 2);
  });

  it('mixed parcel sums the three treatments', () => {
    const r = computeNetAV({ cap1: 350000, cap2: 100000, cap3: 50000 }, SCENARIOS.passCommitted);
    expect(r.netAV).toBeCloseTo(167400 + 88000 + 50000, 2);
  });
});
```

Replace every existing `computeNetAV(<number>, ...)` call in this file with `computeNetAV(bucketsOf(<number>, 1), ...)` — lines 11, 18, 23, 30.

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run lib/tax/engine.test.ts`
Expected: FAIL — `bucketsOf` is not exported.

- [ ] **Step 4: Implement**

In `lib/tax/engine.ts`, update the imports and replace `computeNetAV`:

```ts
import { CAP2_AV_DEDUCTION, CIRCUIT_BREAKER_RATES, HOMESTEAD_CREDIT, SUPP_DEDUCTION_CAP_RATE } from './indiana/assumptions';
import type { AvBuckets, BillBreakdown, CapClass, DistrictReferendumConfig, ScenarioParams, TaxDistrict } from './types';

/** Route a single gross AV entirely to one cap class. */
export function bucketsOf(grossAV: number, capClass: CapClass): AvBuckets {
  return {
    cap1: capClass === 1 ? grossAV : 0,
    cap2: capClass === 2 ? grossAV : 0,
    cap3: capClass === 3 ? grossAV : 0,
  };
}

export function totalGrossAV(b: AvBuckets): number {
  return b.cap1 + b.cap2 + b.cap3;
}

/**
 * Net AV by cap class. Homestead standard + supplemental deductions apply to
 * cap-1 AV only; the SEA 1 Cap 2 deduction applies to cap-2 AV; cap-3 AV gets
 * nothing. Each bucket is floored at zero independently.
 */
export function computeNetAV(buckets: AvBuckets, s: ScenarioParams) {
  const standardDeduction = Math.min(buckets.cap1, s.standardDeduction);
  const afterStandard = Math.max(0, buckets.cap1 - standardDeduction);
  const supplementalDeduction = Math.min(
    afterStandard * s.supplementalRate,
    buckets.cap1 * SUPP_DEDUCTION_CAP_RATE.value,
  );
  const cap1Net = Math.max(0, afterStandard - supplementalDeduction);

  const cap2Rate = CAP2_AV_DEDUCTION.value[s.payYear] ?? 0;
  const cap2Deduction = buckets.cap2 * cap2Rate;
  const cap2Net = Math.max(0, buckets.cap2 - cap2Deduction);

  const cap3Net = Math.max(0, buckets.cap3);

  return {
    standardDeduction,
    supplementalDeduction,
    cap2Deduction,
    netAV: cap1Net + cap2Net + cap3Net,
    byClass: { 1: cap1Net, 2: cap2Net, 3: cap3Net } as Record<CapClass, number>,
  };
}
```

Note `standardDeduction` is now `min(cap1, s.standardDeduction)` rather than the raw scenario value, so a sub-deduction homestead reports what was actually applied. The existing test at `engine.test.ts:24` asserts `48000` for a $30,000 home; change that assertion to `30000` and add a comment that the deduction cannot exceed the value it applies to.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run lib/tax/engine.test.ts`
Expected: `computeNetAV` and `AvBuckets` blocks PASS. `computeBill` cases still fail — Task 7.

- [ ] **Step 6: Commit**

```bash
git add lib/tax/types.ts lib/tax/engine.ts lib/tax/engine.test.ts
git commit -m "feat: compute net AV from cap-class buckets

Refs localtransparency/noblesville#5"
```

---

## Task 7: Per-class circuit breaker in computeBill

**Files:**
- Modify: `lib/tax/engine.ts:30-72`, `lib/tax/scenarios.ts:59-71`
- Test: `lib/tax/engine.test.ts`

**Interfaces:**
- Consumes: `computeNetAV`, `bucketsOf`, `totalGrossAV` (Task 6); `CIRCUIT_BREAKER_RATES` (Task 4).
- Produces: `computeBill(buckets: AvBuckets, district, s, config): BillBreakdown` — first parameter changes from `number` to `AvBuckets`. `computeAllScenarios(buckets: AvBuckets, district, config)` likewise.

- [ ] **Step 1: Write the failing tests**

Append to `lib/tax/engine.test.ts`:

```ts
describe('computeBill — per-class circuit breaker', () => {
  it('applies the 2% cap to cap-2 AV', () => {
    // $400k non-homestead residential, pay-2027: net AV 400000 × (1 − 0.12) = 352,000
    // non-referendum 2.1049% × 352000 = 7,409.25; cap = 2% × 400000 = 8,000 → no credit
    const b = computeBill({ cap1: 0, cap2: 400000, cap3: 0 }, city, SCENARIOS.passCommitted, NOBLESVILLE);
    expect(b.netAV).toBeCloseTo(352000, 2);
    expect(b.circuitBreakerCap).toBeCloseTo(8000, 2);
    expect(b.circuitBreakerCredit).toBe(0);
  });

  it('applies the 3% cap to cap-3 AV and grants no homestead credit', () => {
    const b = computeBill({ cap1: 0, cap2: 0, cap3: 400000 }, city, SCENARIOS.passCommitted, NOBLESVILLE);
    expect(b.netAV).toBeCloseTo(400000, 2);
    expect(b.circuitBreakerCap).toBeCloseTo(12000, 2);
    expect(b.supplementalHomesteadCredit).toBe(0);
  });

  it('a mixed parcel caps each class against its own gross AV', () => {
    const b = computeBill({ cap1: 350000, cap2: 100000, cap3: 0 }, city, SCENARIOS.passCommitted, NOBLESVILLE);
    expect(b.circuitBreakerCap).toBeCloseTo(350000 * 0.01 + 100000 * 0.02, 2); // 5,500
  });

  it('the supplemental homestead credit is granted only on cap-1 liability', () => {
    const homestead = computeBill(bucketsOf(350000, 1), city, SCENARIOS.current, NOBLESVILLE);
    const rental = computeBill(bucketsOf(350000, 2), city, SCENARIOS.current, NOBLESVILLE);
    expect(homestead.supplementalHomesteadCredit).toBeCloseTo(300, 2);
    expect(rental.supplementalHomesteadCredit).toBe(0);
  });
});
```

Replace every existing `computeBill(<number>, ...)` call in `engine.test.ts` with `computeBill(bucketsOf(<number>, 1), ...)`, and every `computeAllScenarios(<number>, ...)` in `scenarios.test.ts` with `computeAllScenarios(bucketsOf(<number>, 1), ...)`, importing `bucketsOf` in both files. All previously-asserted values must be unchanged — that is the parity requirement.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/tax`
Expected: FAIL — `computeBill` still takes a number; `CIRCUIT_BREAKER_RATE` no longer exists.

- [ ] **Step 3: Implement**

Replace `computeBill` in `lib/tax/engine.ts`:

```ts
export function computeBill(
  buckets: AvBuckets,
  district: TaxDistrict,
  s: ScenarioParams,
  config: DistrictReferendumConfig,
): BillBreakdown {
  const { standardDeduction, supplementalDeduction, cap2Deduction, netAV, byClass } =
    computeNetAV(buckets, s);

  const nonRefRate = nonReferendumRate(config, district);
  const nonReferendumGross = (netAV * nonRefRate) / 100;

  // Each class's cap is a percentage of that class's GROSS AV; a parcel's total
  // cap is the sum. Credits are computed per class so a mixed parcel cannot use
  // one class's headroom to shelter another's liability.
  const classes: CapClass[] = [1, 2, 3];
  const grossByClass: Record<CapClass, number> = { 1: buckets.cap1, 2: buckets.cap2, 3: buckets.cap3 };

  let circuitBreakerCap = 0;
  let circuitBreakerCredit = 0;
  let cap1AfterCap = 0;
  for (const c of classes) {
    const cap = grossByClass[c] * CIRCUIT_BREAKER_RATES.value[c];
    const gross = (byClass[c] * nonRefRate) / 100;
    const credit = Math.max(0, gross - cap);
    circuitBreakerCap += cap;
    circuitBreakerCredit += credit;
    if (c === 1) cap1AfterCap = gross - credit;
  }
  const afterCap = nonReferendumGross - circuitBreakerCredit;

  // The supplemental homestead credit is a homestead benefit: it is computed
  // from post-cap cap-1 liability only, and referendum taxes are excluded.
  const supplementalHomesteadCredit = Math.min(
    cap1AfterCap * HOMESTEAD_CREDIT.value.rate,
    HOMESTEAD_CREDIT.value.max,
  );
  const nonReferendumNet = afterCap - supplementalHomesteadCredit;

  const referendumOperatingTax = (netAV * s.referendumOperatingRate) / 100;
  const referendumDebtTax = (netAV * s.referendumDebtRate) / 100;
  const referendumTax = referendumOperatingTax + referendumDebtTax;

  return {
    scenario: s.id,
    grossAV: totalGrossAV(buckets),
    standardDeduction,
    supplementalDeduction,
    cap2Deduction,
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

In `lib/tax/scenarios.ts`, change `computeAllScenarios`'s first parameter to `buckets: AvBuckets` and forward it to all four `computeBill` calls; import `AvBuckets` from `./types`.

- [ ] **Step 4: Run the tax suite**

Run: `npx vitest run lib/tax`
Expected: PASS, including every pre-existing assertion unchanged.

- [ ] **Step 5: Fix the component call sites**

`components/Calculator.tsx` and `components/Results.tsx` call `computeAllScenarios(grossAV, ...)`. Wrap with `bucketsOf(grossAV, 1)` for now — Task 12 replaces this with the inferred class.

Run: `npm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/tax components
git commit -m "feat: apply circuit-breaker caps per constitutional class

Each class's cap is a share of that class's gross AV and credits are computed
per class, so a mixed parcel cannot shelter one class's liability with
another's headroom. Homestead credit is limited to cap-1 liability.

Refs localtransparency/noblesville#5"
```

---

## Task 8: Referendum-line projection

**Files:**
- Create: `lib/tax/projection.ts`, `lib/tax/projection.test.ts`

**Interfaces:**
- Consumes: `computeNetAV`, `AvBuckets` (Task 6); `DEDUCTIONS` (Task 4); `config.referendum.projection` (Task 5).
- Produces:

```ts
export interface ProjectionRow {
  year: number; growthFactor: number; grossAV: number; netAV: number;
  operatingRate: number; operatingTax: number;
  debtRate: number; debtTax: number;
  annual: number; monthly: number;
}
export interface ProjectionStats {
  firstYearChange: number; averageIncreaseVsBase: number;
  finalYearIncrease: number; averageYearOverYearStep: number;
}
export function projectReferendumLine(buckets: AvBuckets, config: DistrictReferendumConfig, opts?: { avGrowth?: Record<number, number> }): ProjectionRow[]
export function projectionStats(rows: ProjectionRow[]): ProjectionStats
```

- [ ] **Step 1: Write the failing test**

Create `lib/tax/projection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { projectReferendumLine, projectionStats } from './projection';
import { bucketsOf } from './engine';
import { NOBLESVILLE } from './indiana/districts/noblesville';

const rows = projectReferendumLine(bucketsOf(350000, 1), NOBLESVILLE);
const byYear = (y: number) => rows.find((r) => r.year === y)!;

describe('projectReferendumLine', () => {
  it('covers 2026 through 2034 with 2026 as the ungrown base', () => {
    expect(rows.map((r) => r.year)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034]);
    expect(byYear(2026).growthFactor).toBe(1);
    expect(byYear(2026).grossAV).toBeCloseTo(350000, 6);
  });

  it('compounds the district\'s AV growth assumption', () => {
    expect(byYear(2027).growthFactor).toBeCloseTo(1.053, 6);
    expect(byYear(2028).growthFactor).toBeCloseTo(1.053 * 1.035, 6);
  });

  it('reproduces the operating line for a $350k homestead', () => {
    expect(byYear(2026).operatingTax).toBeCloseTo(670.44, 2);
    expect(byYear(2027).operatingTax).toBeCloseTo(683.06, 2);
    expect(byYear(2034).operatingTax).toBeCloseTo(850.98, 2);
  });

  it('carries the referendum debt rate only through its final levy year', () => {
    expect(byYear(2032).debtRate).toBeCloseTo(0.08, 6);
    expect(byYear(2033).debtRate).toBe(0);
    expect(byYear(2034).debtTax).toBe(0);
  });

  it('accepts an overridden growth assumption', () => {
    const flat = projectReferendumLine(bucketsOf(350000, 1), NOBLESVILLE, {
      avGrowth: { 2027: 0, 2028: 0, 2029: 0, 2030: 0, 2031: 0, 2032: 0, 2033: 0, 2034: 0 },
    });
    expect(flat.find((r) => r.year === 2034)!.growthFactor).toBe(1);
    expect(flat.find((r) => r.year === 2034)!.grossAV).toBeCloseTo(350000, 6);
  });
});

describe('projectionStats — each statistic has one exact definition', () => {
  const s = projectionStats(rows);

  it('firstYearChange is 2027 monthly minus 2026 monthly', () => {
    expect(s.firstYearChange).toBeCloseTo(1.05, 2);
  });

  it('averageIncreaseVsBase is the mean of each year\'s excess over 2026', () => {
    expect(s.averageIncreaseVsBase).toBeCloseTo(8.19, 2);
  });

  it('finalYearIncrease is 2034 monthly minus 2026 monthly', () => {
    expect(s.finalYearIncrease).toBeCloseTo(15.05, 2);
  });

  it('averageYearOverYearStep is the mean of the eight successive differences', () => {
    expect(s.averageYearOverYearStep).toBeCloseTo(1.88, 2);
  });

  it('the year-over-year mean equals (final − base) / 8 by construction', () => {
    expect(s.averageYearOverYearStep).toBeCloseTo(s.finalYearIncrease / 8, 6);
  });

  it('the two averages are different statistics over the same series', () => {
    expect(s.averageIncreaseVsBase).not.toBeCloseTo(s.averageYearOverYearStep, 1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/tax/projection.test.ts`
Expected: FAIL — cannot resolve `./projection`.

- [ ] **Step 3: Implement**

Create `lib/tax/projection.ts`:

```ts
import type { AvBuckets, DistrictReferendumConfig } from './types';
import { DEDUCTIONS } from './indiana/assumptions';
import { computeNetAV } from './engine';

export interface ProjectionRow {
  year: number;
  growthFactor: number;
  grossAV: number;
  netAV: number;
  operatingRate: number;
  operatingTax: number;
  debtRate: number;
  debtTax: number;
  annual: number;
  monthly: number;
}

export interface ProjectionStats {
  /** Second year's monthly amount minus the base year's. */
  firstYearChange: number;
  /** Mean, across every projected year, of that year's excess over the base year. */
  averageIncreaseVsBase: number;
  /** Final year's monthly amount minus the base year's. */
  finalYearIncrease: number;
  /** Mean of the successive year-over-year differences in the monthly amount. */
  averageYearOverYearStep: number;
}

/**
 * Year-by-year referendum line (operating + debt) across a district's published
 * schedule. Scope deliberately matches the district's own calculator so the two
 * are directly comparable: non-referendum rates and the circuit breaker are NOT
 * projected, because this tool's non-referendum rate is derived from the
 * certified pay-2026 total and holding it flat for eight years would let the
 * weakest input dominate every total.
 *
 * The entered AV is treated as the base-year (2026) gross AV, matching the
 * county parcel layer's AVTAXYR.
 */
export function projectReferendumLine(
  buckets: AvBuckets,
  config: DistrictReferendumConfig,
  opts: { avGrowth?: Record<number, number> } = {},
): ProjectionRow[] {
  const projection = config.referendum.projection;
  if (!projection) return [];

  const growth = opts.avGrowth ?? projection.avGrowth.value;
  const years = Object.keys(projection.operatingRates.value).map(Number).sort((a, b) => a - b);
  const debtRate = config.referendum.debt?.value ?? 0;
  const debtEndYear = config.referendum.debtEndYear?.value ?? Infinity;

  let growthFactor = 1;
  return years.map((year, i) => {
    if (i > 0) growthFactor *= 1 + (growth[year] ?? 0);

    const grown: AvBuckets = {
      cap1: buckets.cap1 * growthFactor,
      cap2: buckets.cap2 * growthFactor,
      cap3: buckets.cap3 * growthFactor,
    };
    const deductions = DEDUCTIONS[year];
    const { netAV } = computeNetAV(grown, {
      id: 'passCommitted',
      label: '',
      payYear: year,
      standardDeduction: deductions.value.standard,
      supplementalRate: deductions.value.supplementalRate,
      referendumOperatingRate: 0,
      referendumDebtRate: 0,
    });

    const operatingRate = projection.operatingRates.value[year];
    const yearDebtRate = year <= debtEndYear ? debtRate : 0;
    const operatingTax = (netAV * operatingRate) / 100;
    const debtTax = (netAV * yearDebtRate) / 100;
    const annual = operatingTax + debtTax;

    return {
      year,
      growthFactor,
      grossAV: grown.cap1 + grown.cap2 + grown.cap3,
      netAV,
      operatingRate,
      operatingTax,
      debtRate: yearDebtRate,
      debtTax,
      annual,
      monthly: annual / 12,
    };
  });
}

/**
 * Four distinct statistics over the same series. They answer different
 * questions and routinely differ by a large factor; each is defined here once
 * so the UI and the methodology page cannot drift from the arithmetic.
 */
export function projectionStats(rows: ProjectionRow[]): ProjectionStats {
  if (rows.length < 2) {
    return { firstYearChange: 0, averageIncreaseVsBase: 0, finalYearIncrease: 0, averageYearOverYearStep: 0 };
  }
  const base = rows[0];
  const future = rows.slice(1);
  const final = rows[rows.length - 1];

  const steps = rows.slice(1).map((r, i) => r.monthly - rows[i].monthly);

  return {
    firstYearChange: future[0].monthly - base.monthly,
    averageIncreaseVsBase: future.reduce((s, r) => s + (r.monthly - base.monthly), 0) / future.length,
    finalYearIncrease: final.monthly - base.monthly,
    averageYearOverYearStep: steps.reduce((s, d) => s + d, 0) / steps.length,
  };
}
```

Note: `projectReferendumLine` uses only the *operating* rate from the schedule for `operatingTax`; the district's `RATES[2026] = 0.37` is the expiring referendum, so the base year is the current bill and later years are the proposed one.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/tax/projection.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/tax/projection.ts lib/tax/projection.test.ts
git commit -m "feat: project the referendum line across the published 2026-2034 schedule

Adds four separately-defined headline statistics over the same series.

Refs localtransparency/noblesville#5"
```

---

## Task 9: Cross-check harness against the district's calculator

**Files:**
- Create: `lib/tax/districtCalculator.fixture.ts`, `lib/tax/districtCalculator.test.ts`

**Interfaces:**
- Consumes: `projectReferendumLine` (Task 8).
- Produces: `districtCalculatorAnnual(av1, av2, av3): Record<number, number>` — test-only.

- [ ] **Step 1: Create the vendored fixture**

Create `lib/tax/districtCalculator.fixture.ts`:

```ts
/**
 * Verbatim transcription of the constants and arithmetic in Noblesville
 * Schools' published referendum calculator, for cross-checking this tool's
 * projection against the district's own model.
 *
 * Source: https://noblesvilleschoolsorg.finalsite.com/uploaded/NoblesvilleSchools_ReferendumCalculator.html
 * Retrieved: 2026-08-12
 *
 * TEST-ONLY. Never import from application code — the district's calculator is
 * a cross-check, not a source of truth for statewide law.
 *
 * To refresh: re-download the file, re-read its `<script>` config block, and
 * update both the constants and the retrieval date above.
 */
export const DISTRICT_AV_GROWTH: Record<number, number> = {
  2027: 0.053, 2028: 0.035, 2029: 0.035, 2030: 0.035,
  2031: 0.035, 2032: 0.035, 2033: 0.035, 2034: 0.035,
};

export const DISTRICT_RATES: Record<number, number> = {
  2026: 0.37, 2027: 0.385, 2028: 0.425, 2029: 0.465,
  2030: 0.505, 2031: 0.545, 2032: 0.545, 2033: 0.545, 2034: 0.545,
};

export const DISTRICT_YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034];
export const DISTRICT_HD = [48000, 40000, 30000, 20000, 10000, 0, 0, 0, 0];
export const DISTRICT_SH_PCT = [0.4, 0.46, 0.52, 0.57, 0.62, 0.667, 0.667, 0.667, 0.667];
export const DISTRICT_CAP2_PCT = [0.06, 0.12, 0.19, 0.25, 0.3, 0.334, 0.334, 0.334, 0.334];

/** The district's `calculate()`, reduced to the annual referendum levy per year. */
export function districtCalculatorAnnual(av1Base: number, av2Base = 0, av3Base = 0): Record<number, number> {
  const growthFactors = [1];
  let cumFactor = 1;
  for (let i = 1; i < DISTRICT_YEARS.length; i++) {
    cumFactor *= 1 + (DISTRICT_AV_GROWTH[DISTRICT_YEARS[i]] || 0);
    growthFactors.push(cumFactor);
  }

  const out: Record<number, number> = {};
  for (let i = 0; i < DISTRICT_YEARS.length; i++) {
    const f = growthFactors[i];
    const av1 = av1Base * f, av2 = av2Base * f, av3 = av3Base * f;
    const hdVal = -Math.min(av1, DISTRICT_HD[i]);
    const shVal = -(av1 + hdVal) * DISTRICT_SH_PCT[i];
    const cap2Val = -av2 * DISTRICT_CAP2_PCT[i];
    const navVal = av1 + av2 + av3 + hdVal + shVal + cap2Val;
    out[DISTRICT_YEARS[i]] = (navVal * DISTRICT_RATES[DISTRICT_YEARS[i]]) / 100;
  }
  return out;
}
```

- [ ] **Step 2: Write the failing cross-check test**

Create `lib/tax/districtCalculator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { districtCalculatorAnnual, DISTRICT_RATES, DISTRICT_AV_GROWTH } from './districtCalculator.fixture';
import { projectReferendumLine } from './projection';
import { bucketsOf } from './engine';
import { NOBLESVILLE } from './indiana/districts/noblesville';

describe('config matches the district\'s published calculator', () => {
  it('operating rates are transcribed exactly', () => {
    expect(NOBLESVILLE.referendum.projection!.operatingRates.value).toEqual(DISTRICT_RATES);
  });

  it('AV growth is transcribed exactly', () => {
    expect(NOBLESVILLE.referendum.projection!.avGrowth.value).toEqual(DISTRICT_AV_GROWTH);
  });
});

describe('projection agrees with the district\'s model on the operating line', () => {
  // Both models apply the same growth to the same 2026 base with the same
  // deduction schedule, so agreement is exact to the cent — not approximate.
  // Any divergence beyond $0.01 is a defect, not a tolerance question.
  const cases = [
    { name: '$350k homestead', av: [350000, 0, 0] as const },
    { name: '$180k homestead', av: [180000, 0, 0] as const },
    { name: '$750k homestead', av: [750000, 0, 0] as const },
    { name: '$250k non-homestead residential', av: [0, 250000, 0] as const },
    { name: '$500k commercial', av: [0, 0, 500000] as const },
    { name: 'mixed homestead + cap2', av: [350000, 100000, 0] as const },
  ];

  for (const c of cases) {
    it(`matches for ${c.name}`, () => {
      const theirs = districtCalculatorAnnual(c.av[0], c.av[1], c.av[2]);
      const ours = projectReferendumLine({ cap1: c.av[0], cap2: c.av[1], cap3: c.av[2] }, NOBLESVILLE);
      for (const row of ours) {
        expect(Math.abs(row.operatingTax - theirs[row.year]), `${c.name} ${row.year}`).toBeLessThanOrEqual(0.01);
      }
    });
  }
});

describe('known, deliberate divergences from the district\'s model', () => {
  it('this engine caps the supplemental deduction at 75% of gross AV; theirs does not', () => {
    // A homestead small enough for 0.667 × (AV − 0) to exceed 0.75 × AV cannot
    // occur, but the cap is enforced and asserted so a future schedule change
    // surfaces here rather than silently diverging.
    const ours = projectReferendumLine(bucketsOf(60000, 1), NOBLESVILLE);
    for (const row of ours) expect(row.netAV).toBeGreaterThanOrEqual(0);
  });

  it('this engine floors each bucket at zero; theirs can go negative', () => {
    const theirs = districtCalculatorAnnual(10000);
    const ours = projectReferendumLine(bucketsOf(10000, 1), NOBLESVILLE);
    // 2026: their model yields (10000 − 10000) × 0.6 = 0 as well, so this
    // asserts the floor holds rather than a specific divergence.
    for (const row of ours) expect(row.netAV).toBeGreaterThanOrEqual(0);
    expect(Object.values(theirs).every((v) => Number.isFinite(v))).toBe(true);
  });

  it('this tool projects the referendum debt rate, which the district\'s calculator omits', () => {
    const ours = projectReferendumLine(bucketsOf(350000, 1), NOBLESVILLE);
    expect(ours.find((r) => r.year === 2027)!.debtTax).toBeGreaterThan(0);
    expect(ours.find((r) => r.year === 2027)!.annual)
      .toBeGreaterThan(districtCalculatorAnnual(350000)[2027]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run lib/tax/districtCalculator.test.ts`
Expected: FAIL — the fixture module does not exist yet if Step 1 was skipped; otherwise PASS.

- [ ] **Step 4: Reconcile any mismatch**

If an operating-line case exceeds $0.01, the cause is in `computeNetAV`'s deduction ordering or `DEDUCTIONS`, not in the fixture. Do not widen the tolerance; fix the engine or document the divergence as a new case in the third `describe` block with a comment explaining why it is correct.

Run: `npx vitest run lib/tax/districtCalculator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tax/districtCalculator.fixture.ts lib/tax/districtCalculator.test.ts
git commit -m "test: cross-check the projection against the district's own calculator

Vendors the district's constants and arithmetic as a test-only fixture and
asserts cent-exact agreement on the operating line, with deliberate
divergences asserted individually rather than absorbed by tolerance.

Refs localtransparency/noblesville#5"
```

---

## Task 10: Cap-class inference from parcel data

**Files:**
- Create: `lib/tax/indiana/capClass.ts`, `lib/tax/indiana/capClass.test.ts`
- Modify: `lib/lookup/arcgis.ts:4-20,109-131`
- Test: `lib/lookup/arcgis.test.ts`

**Interfaces:**
- Consumes: `CapClass` (Task 4).
- Produces:

```ts
export interface CapClassInference { capClass: CapClass; confidence: 'high' | 'low'; reason: string }
export function inferCapClass(attrs: { homesteadCode: number | null; propertyClass: string; assessmentYear: number }): CapClassInference
```
  `ParcelCandidate` gains `propertyClass: string`, `avLand: number`, `avImprove: number`, `deededAcres: number`, `homesteadCode: number | null`.

- [ ] **Step 1: Write the failing test**

Create `lib/tax/indiana/capClass.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { inferCapClass } from './capClass';

const at = (homesteadCode: number | null, propertyClass: string, assessmentYear = 2026) =>
  inferCapClass({ homesteadCode, propertyClass, assessmentYear });

describe('inferCapClass', () => {
  it('an active homestead is cap 1', () => {
    expect(at(1, '510')).toMatchObject({ capClass: 1, confidence: 'high' });
  });

  it('non-homestead residential is cap 2', () => {
    expect(at(0, '510')).toMatchObject({ capClass: 2, confidence: 'high' });
    expect(at(0, '599')).toMatchObject({ capClass: 2, confidence: 'high' });
  });

  it('agricultural land is cap 2', () => {
    expect(at(0, '100')).toMatchObject({ capClass: 2, confidence: 'high' });
  });

  it('commercial and industrial are cap 3', () => {
    expect(at(0, '400')).toMatchObject({ capClass: 3, confidence: 'high' });
    expect(at(0, '340')).toMatchObject({ capClass: 3, confidence: 'high' });
    expect(at(0, '685')).toMatchObject({ capClass: 3, confidence: 'high' });
  });

  // Hamilton County's parcel layer uses -1 on thousands of parcels and its
  // meaning is unconfirmed. Treat as non-homestead but never silently.
  it('an unconfirmed homestead code (-1) is low confidence', () => {
    const r = at(-1, '510');
    expect(r.capClass).toBe(2);
    expect(r.confidence).toBe('low');
    expect(r.reason).toMatch(/unconfirmed/i);
  });

  it('a missing homestead code is low confidence', () => {
    expect(at(null, '510').confidence).toBe('low');
  });

  it('an off-base assessment year is low confidence even when the class is clear', () => {
    const r = at(1, '510', 2025);
    expect(r.capClass).toBe(1);
    expect(r.confidence).toBe('low');
    expect(r.reason).toMatch(/2026/);
  });

  it('an unrecognized property class falls back to cap 3 at low confidence', () => {
    expect(at(0, '')).toMatchObject({ capClass: 3, confidence: 'low' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/tax/indiana/capClass.test.ts`
Expected: FAIL — cannot resolve `./capClass`.

- [ ] **Step 3: Implement**

Create `lib/tax/indiana/capClass.ts`:

```ts
import type { CapClass } from '../types';

export interface CapClassInference {
  capClass: CapClass;
  confidence: 'high' | 'low';
  reason: string;
}

/** The pay year this tool's projection treats as its ungrown base. */
const BASE_ASSESSMENT_YEAR = 2026;

/**
 * Infer a parcel's dominant constitutional cap class from county parcel
 * attributes.
 *
 * This is a DOMINANT-class inference, not an allocation. Indiana splits a
 * single parcel across classes — a homestead on more than one acre is cap 1 on
 * the dwelling plus one acre and cap 2 on the remainder — and Hamilton County's
 * open parcel data publishes no allocation. Callers must offer a manual
 * override rather than treat this as authoritative.
 *
 * Property class codes follow Indiana's assessment manual: 1xx agricultural,
 * 2xx industrial, 3xx commercial, 4xx commercial/utility, 5xx residential,
 * 6xx+ other. Only 1xx and 5xx can fall under the 2% cap.
 */
export function inferCapClass(attrs: {
  homesteadCode: number | null;
  propertyClass: string;
  assessmentYear: number;
}): CapClassInference {
  const { homesteadCode, propertyClass, assessmentYear } = attrs;
  const leading = propertyClass.trim().charAt(0);
  const isResidentialOrAg = leading === '5' || leading === '1';

  const staleYear = assessmentYear !== BASE_ASSESSMENT_YEAR;
  const yearNote = staleYear
    ? ` Assessed value is for ${assessmentYear || 'an unknown year'}, not the ${BASE_ASSESSMENT_YEAR} base this projection assumes.`
    : '';

  if (homesteadCode === 1) {
    return {
      capClass: 1,
      confidence: staleYear ? 'low' : 'high',
      reason: `An active homestead deduction places this parcel under the 1% cap.${yearNote}`,
    };
  }

  if (homesteadCode === null || homesteadCode === -1) {
    return {
      capClass: isResidentialOrAg ? 2 : 3,
      confidence: 'low',
      reason:
        `The county's homestead code for this parcel is ${homesteadCode === null ? 'missing' : 'unconfirmed (-1)'}, ` +
        `so it is treated as non-homestead. Confirm your own homestead status.${yearNote}`,
    };
  }

  if (!leading) {
    return {
      capClass: 3,
      confidence: 'low',
      reason: `No property class is published for this parcel.${yearNote}`,
    };
  }

  return {
    capClass: isResidentialOrAg ? 2 : 3,
    confidence: staleYear ? 'low' : 'high',
    reason: isResidentialOrAg
      ? `Property class ${propertyClass} without a homestead deduction falls under the 2% cap.${yearNote}`
      : `Property class ${propertyClass} falls under the 3% cap.${yearNote}`,
  };
}
```

- [ ] **Step 4: Extend the parcel lookup**

In `lib/lookup/arcgis.ts`, replace `OUT_FIELDS` (lines 4-7):

```ts
const OUT_FIELDS = [
  'PARCELNO', 'STPRCLNO', 'LOCADDRESS', 'LOCCITY', 'LOCZIP',
  'AVTOTGROSS', 'AVLAND', 'AVIMPROVE', 'AVTAXYR', 'DEEDACRES',
  'HOMESTEAD', 'hmstd_code', 'PROPCLASS',
  'TAXDISTCOD', 'TAXDISTNAM', 'PROPERTYREPORT',
].join(',');
```

Add to `ParcelCandidate`:

```ts
  homesteadCode: number | null;
  propertyClass: string;
  avLand: number;
  avImprove: number;
  deededAcres: number;
```

Add a parser helper above `isHomestead`:

```ts
/**
 * hmstd_code is an integer flag: 1 = active homestead, 0 = none. Hamilton
 * County also publishes -1 on thousands of parcels; its meaning is unconfirmed,
 * so it is preserved verbatim rather than collapsed into 0, and callers lower
 * their confidence on it.
 */
function homesteadCodeOf(attrs: Record<string, unknown>): number | null {
  const code = attrs.hmstd_code;
  if (typeof code === 'number') return code;
  if (typeof code === 'string' && code.trim() !== '') {
    const n = Number(code.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
```

In `parseResponse`, add to the returned object:

```ts
      homesteadCode: homesteadCodeOf(attrs),
      propertyClass: String(attrs.PROPCLASS ?? ''),
      avLand: Number(attrs.AVLAND) || 0,
      avImprove: Number(attrs.AVIMPROVE) || 0,
      deededAcres: Number(attrs.DEEDACRES) || 0,
```

Leave `homestead: isHomestead(attrs)` in place — existing consumers depend on it.

- [ ] **Step 5: Add lookup assertions**

Append to `lib/lookup/arcgis.test.ts`:

```ts
describe('parseResponse — cap-class inputs', () => {
  it('preserves hmstd_code verbatim, including -1', () => {
    const parsed = parseResponse({
      features: [{ attributes: { AVTOTGROSS: 350000, hmstd_code: -1, PROPCLASS: '510', DEEDACRES: 5.68 } }],
    });
    expect(parsed[0].homesteadCode).toBe(-1);
    expect(parsed[0].propertyClass).toBe('510');
    expect(parsed[0].deededAcres).toBeCloseTo(5.68, 2);
  });

  it('reports a missing homestead code as null rather than 0', () => {
    const parsed = parseResponse({ features: [{ attributes: { AVTOTGROSS: 350000 } }] });
    expect(parsed[0].homesteadCode).toBeNull();
  });

  it('requests the fields cap-class inference needs', () => {
    const url = buildQueryUrl('1 MAIN ST');
    for (const f of ['PROPCLASS', 'AVLAND', 'AVIMPROVE', 'DEEDACRES']) {
      expect(decodeURIComponent(url)).toContain(f);
    }
  });
});
```

Ensure `buildQueryUrl` and `parseResponse` are imported in that file.

- [ ] **Step 6: Run and commit**

Run: `npx vitest run lib/tax/indiana/capClass.test.ts lib/lookup`
Expected: PASS.

```bash
git add lib/tax/indiana/capClass.ts lib/tax/indiana/capClass.test.ts lib/lookup
git commit -m "feat: infer constitutional cap class from parcel attributes

Dominant-class inference only — the county publishes no within-parcel
allocation. hmstd_code = -1 is preserved verbatim and lowers confidence
instead of silently reading as non-homestead.

Refs localtransparency/noblesville#5"
```

---

## Task 11: Expose the new parcel fields through the API route

**Files:**
- Modify: `app/api/lookup/route.ts`
- Test: `app/api/lookup/route.test.ts`

**Interfaces:**
- Consumes: extended `ParcelCandidate` (Task 10), `inferCapClass` (Task 10).
- Produces: each API candidate gains `capClass`, `capClassConfidence`, `capClassReason`, `deededAcres`, `assessmentYear`.

- [ ] **Step 1: Write the failing test**

Append to `app/api/lookup/route.test.ts`, following the file's existing fetch-mocking pattern:

```ts
it('returns an inferred cap class with its confidence and reason', async () => {
  // Use the file's existing helper for stubbing the upstream ArcGIS response;
  // a homesteaded class-510 parcel with a 2026 assessment year.
  const res = await getLookup('1 MAIN ST', [
    { AVTOTGROSS: 350000, AVTAXYR: 2026, hmstd_code: 1, PROPCLASS: '510', TAXDISTNAM: 'Noblesville City', DEEDACRES: 0.25 },
  ]);
  const body = await res.json();
  expect(body.candidates[0].capClass).toBe(1);
  expect(body.candidates[0].capClassConfidence).toBe('high');
  expect(body.candidates[0].capClassReason).toMatch(/1% cap/);
});

it('flags an unconfirmed homestead code as low confidence', async () => {
  const res = await getLookup('1 MAIN ST', [
    { AVTOTGROSS: 350000, AVTAXYR: 2026, hmstd_code: -1, PROPCLASS: '510', TAXDISTNAM: 'Noblesville City', DEEDACRES: 5.68 },
  ]);
  const body = await res.json();
  expect(body.candidates[0].capClass).toBe(2);
  expect(body.candidates[0].capClassConfidence).toBe('low');
  expect(body.candidates[0].deededAcres).toBeCloseTo(5.68, 2);
});
```

If `getLookup` does not already exist in that file, write it as a thin local helper that stubs `global.fetch` with `{ features: attrs.map((a) => ({ attributes: a })) }` and calls the route's `GET` with a `Request` carrying `?q=`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/api/lookup/route.test.ts`
Expected: FAIL — `capClass` is undefined on the candidate.

- [ ] **Step 3: Implement**

In `app/api/lookup/route.ts`, import `inferCapClass`, and where each candidate is mapped to its response shape, spread in:

```ts
      ...(() => {
        const inference = inferCapClass({
          homesteadCode: c.homesteadCode,
          propertyClass: c.propertyClass,
          assessmentYear: c.assessmentYear,
        });
        return {
          capClass: inference.capClass,
          capClassConfidence: inference.confidence,
          capClassReason: inference.reason,
        };
      })(),
      deededAcres: c.deededAcres,
      assessmentYear: c.assessmentYear,
```

Do not add address or parcel data to any log line.

- [ ] **Step 4: Run and commit**

Run: `npm run test`
Expected: PASS.

```bash
git add app/api/lookup
git commit -m "feat: return inferred cap class from the lookup API

Refs localtransparency/noblesville#5"
```

---

## Task 12: Cap-class panel with manual override

**Files:**
- Create: `components/CapClassPanel.tsx`, `components/CapClassPanel.test.tsx`
- Modify: `components/Calculator.tsx`

**Interfaces:**
- Consumes: `AvBuckets`, `bucketsOf`, `CapClass`, API `capClass` fields.
- Produces: `<CapClassPanel value={AvBuckets} inference={{capClass, confidence, reason}} deededAcres={number} onChange={(b: AvBuckets) => void} />`

- [ ] **Step 1: Write the failing test**

Create `components/CapClassPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CapClassPanel } from './CapClassPanel';

const base = {
  value: { cap1: 350000, cap2: 0, cap3: 0 },
  inference: { capClass: 1 as const, confidence: 'high' as const, reason: 'An active homestead deduction places this parcel under the 1% cap.' },
  deededAcres: 0.25,
};

describe('CapClassPanel', () => {
  it('states the inferred class and its reason', () => {
    render(<CapClassPanel {...base} onChange={() => {}} />);
    expect(screen.getByText(/1% cap/)).toBeInTheDocument();
  });

  it('warns when confidence is low', () => {
    render(<CapClassPanel {...base} inference={{ ...base.inference, confidence: 'low', reason: 'unconfirmed (-1)' }} onChange={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent(/unconfirmed/i);
  });

  it('flags a multi-acre homestead as likely split across caps', () => {
    render(<CapClassPanel {...base} deededAcres={5.68} onChange={() => {}} />);
    expect(screen.getByText(/dwelling plus one acre/i)).toBeInTheDocument();
    expect(screen.getByText(/5\.68/)).toBeInTheDocument();
  });

  it('does not show the acreage note for a sub-acre homestead', () => {
    render(<CapClassPanel {...base} onChange={() => {}} />);
    expect(screen.queryByText(/dwelling plus one acre/i)).not.toBeInTheDocument();
  });

  it('emits edited buckets from the override inputs', async () => {
    const onChange = vi.fn();
    render(<CapClassPanel {...base} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /adjust/i }));
    const cap2 = screen.getByLabelText(/2% cap/i);
    await userEvent.clear(cap2);
    await userEvent.type(cap2, '100000');
    expect(onChange).toHaveBeenLastCalledWith({ cap1: 350000, cap2: 100000, cap3: 0 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/CapClassPanel.test.tsx`
Expected: FAIL — cannot resolve `./CapClassPanel`.

- [ ] **Step 3: Implement**

Create `components/CapClassPanel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { AvBuckets, CapClass } from '../lib/tax/types';
import { fmtDollars } from '../lib/format';

const CAP_LABELS: Record<CapClass, string> = {
  1: '1% cap — homestead',
  2: '2% cap — other residential and farmland',
  3: '3% cap — all other property',
};

export function CapClassPanel({
  value,
  inference,
  deededAcres,
  onChange,
}: {
  value: AvBuckets;
  inference: { capClass: CapClass; confidence: 'high' | 'low'; reason: string };
  deededAcres: number;
  onChange: (b: AvBuckets) => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (key: keyof AvBuckets) => (raw: string) => {
    const n = Number(raw.replace(/[^0-9.]/g, ''));
    onChange({ ...value, [key]: Number.isFinite(n) ? n : 0 });
  };

  const total = value.cap1 + value.cap2 + value.cap3;
  const multiAcreHomestead = inference.capClass === 1 && deededAcres > 1;

  return (
    <section aria-labelledby="capclass-heading">
      <h3 id="capclass-heading">How this property is capped</h3>
      <p>
        {fmtDollars(total)} assessed value, treated as <strong>{CAP_LABELS[inference.capClass]}</strong>.
      </p>
      <p>{inference.reason}</p>

      {inference.confidence === 'low' && (
        <p role="status">{inference.reason}</p>
      )}

      {multiAcreHomestead && (
        <p>
          This parcel is {deededAcres} acres. Indiana&rsquo;s homestead covers the dwelling plus one
          acre, so part of the land value is likely assessed under the 2% cap. The county does not
          publish that split — adjust it below if you know your own figures.
        </p>
      )}

      <button type="button" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide' : 'Adjust'} the split
      </button>

      {open && (
        <div>
          {(['cap1', 'cap2', 'cap3'] as const).map((key, i) => (
            <label key={key}>
              {CAP_LABELS[(i + 1) as CapClass]}
              <input
                type="text"
                inputMode="numeric"
                value={String(value[key])}
                onChange={(e) => set(key)(e.target.value)}
              />
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Wire it into the calculator**

In `components/Calculator.tsx`, hold `AvBuckets` in state, initialize it from the selected candidate with `bucketsOf(candidate.grossAV, candidate.capClass)`, render `<CapClassPanel>`, and pass the buckets to `computeAllScenarios` in place of the Task 7 `bucketsOf(grossAV, 1)` stopgap.

- [ ] **Step 5: Run and commit**

Run: `npm run test`
Expected: PASS.

```bash
git add components
git commit -m "feat: show inferred cap class with a manual three-bucket override

Refs localtransparency/noblesville#5"
```

---

## Task 13: Multi-year projection UI

**Files:**
- Create: `components/Projection.tsx`, `components/Projection.test.tsx`
- Modify: `components/Results.tsx`

**Interfaces:**
- Consumes: `projectReferendumLine`, `projectionStats` (Task 8); `AvBuckets`; `fmtRate`, `fmtCents`.
- Produces: `<Projection buckets={AvBuckets} config={DistrictReferendumConfig} />`

- [ ] **Step 1: Write the failing test**

Create `components/Projection.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Projection } from './Projection';
import { NOBLESVILLE } from '../lib/tax/indiana/districts/noblesville';

const buckets = { cap1: 350000, cap2: 0, cap3: 0 };

describe('Projection', () => {
  it('renders a row for every projected year', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    for (const y of [2026, 2027, 2028, 2031, 2034]) {
      expect(screen.getByText(String(y))).toBeInTheDocument();
    }
  });

  it('shows the half-cent rate without rounding', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    expect(screen.getByText('0.385')).toBeInTheDocument();
    expect(screen.queryByText('0.39')).not.toBeInTheDocument();
  });

  it('labels all four statistics distinctly', () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    const stats = screen.getByRole('list', { name: /how to read these figures/i });
    expect(within(stats).getByText(/average year-over-year step/i)).toBeInTheDocument();
    expect(within(stats).getByText(/average increase over 2026/i)).toBeInTheDocument();
    expect(within(stats).getByText(/2034/)).toBeInTheDocument();
  });

  it('attributes the growth assumption to the district and lets it be changed', async () => {
    render(<Projection buckets={buckets} config={NOBLESVILLE} />);
    expect(screen.getByText(/district's assumption/i)).toBeInTheDocument();
    const input = screen.getByLabelText(/growth after 2027/i);
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    expect(screen.getByRole('button', { name: /reset to the district/i })).toBeInTheDocument();
  });

  it('renders nothing for a district without a published schedule', () => {
    const noSchedule = { ...NOBLESVILLE, referendum: { ...NOBLESVILLE.referendum, projection: undefined } };
    const { container } = render(<Projection buckets={buckets} config={noSchedule} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/Projection.test.tsx`
Expected: FAIL — cannot resolve `./Projection`.

- [ ] **Step 3: Implement**

Create `components/Projection.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import type { AvBuckets, DistrictReferendumConfig } from '../lib/tax/types';
import { projectReferendumLine, projectionStats } from '../lib/tax/projection';
import { fmtCents, fmtRate } from '../lib/format';

export function Projection({
  buckets,
  config,
}: {
  buckets: AvBuckets;
  config: DistrictReferendumConfig;
}) {
  const projection = config.referendum.projection;
  const districtGrowth = projection?.avGrowth.value;
  const [firstYear, setFirstYear] = useState<number | null>(null);
  const [laterYears, setLaterYears] = useState<number | null>(null);

  const growth = useMemo(() => {
    if (!districtGrowth) return undefined;
    if (firstYear === null && laterYears === null) return undefined;
    const years = Object.keys(districtGrowth).map(Number).sort((a, b) => a - b);
    const out: Record<number, number> = {};
    years.forEach((y, i) => {
      const override = i === 0 ? firstYear : laterYears;
      out[y] = override === null ? districtGrowth[y] : override / 100;
    });
    return out;
  }, [districtGrowth, firstYear, laterYears]);

  const rows = useMemo(
    () => projectReferendumLine(buckets, config, growth ? { avGrowth: growth } : {}),
    [buckets, config, growth],
  );

  if (!projection || rows.length === 0) return null;

  const stats = projectionStats(rows);
  const base = rows[0];
  const modified = firstYear !== null || laterYears !== null;

  return (
    <section aria-labelledby="projection-heading">
      <h3 id="projection-heading">
        The referendum line, {rows[1].year}–{rows[rows.length - 1].year}
      </h3>

      <p>
        Rates are the district&rsquo;s published schedule. Assessed-value growth defaults to the{' '}
        <strong>district&rsquo;s assumption</strong> of{' '}
        {(projection.avGrowth.value[rows[1].year] * 100).toFixed(1)}% for {rows[1].year} and 3.5%
        thereafter.{' '}
        <a href={projection.avGrowth.source}>Source</a>.
      </p>

      <div>
        <label>
          Growth in {rows[1].year} (%)
          <input
            type="number"
            step="0.1"
            value={firstYear ?? projection.avGrowth.value[rows[1].year] * 100}
            onChange={(e) => setFirstYear(Number(e.target.value))}
          />
        </label>
        <label>
          Growth after {rows[1].year} (%)
          <input
            type="number"
            step="0.1"
            value={laterYears ?? projection.avGrowth.value[rows[2].year] * 100}
            onChange={(e) => setLaterYears(Number(e.target.value))}
          />
        </label>
        {modified && (
          <button type="button" onClick={() => { setFirstYear(null); setLaterYears(null); }}>
            Reset to the district&rsquo;s assumption
          </button>
        )}
      </div>

      <table>
        <caption>
          Estimated referendum tax by year. This is the referendum line only, not your whole tax
          bill.
        </caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Gross AV</th>
            <th scope="col">Net AV</th>
            <th scope="col">Operating rate</th>
            <th scope="col">Debt rate</th>
            <th scope="col">Per year</th>
            <th scope="col">Per month</th>
            <th scope="col">vs {base.year}/mo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year}>
              <th scope="row">{r.year}</th>
              <td>{fmtCents(r.grossAV)}</td>
              <td>{fmtCents(r.netAV)}</td>
              <td>{fmtRate(r.operatingRate)}</td>
              <td>{r.debtRate === 0 ? '—' : fmtRate(r.debtRate)}</td>
              <td>{fmtCents(r.annual)}</td>
              <td>{fmtCents(r.monthly)}</td>
              <td>{r.year === base.year ? '—' : fmtCents(r.monthly - base.monthly)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul aria-label="How to read these figures">
        <li>
          <strong>{rows[1].year} change:</strong> {fmtCents(stats.firstYearChange)}/month — next
          year&rsquo;s monthly amount minus {base.year}&rsquo;s.
        </li>
        <li>
          <strong>Average increase over {base.year}:</strong>{' '}
          {fmtCents(stats.averageIncreaseVsBase)}/month — the mean, across every projected year, of
          that year&rsquo;s excess over {base.year}.
        </li>
        <li>
          <strong>{rows[rows.length - 1].year} increase:</strong>{' '}
          {fmtCents(stats.finalYearIncrease)}/month — the final year&rsquo;s monthly amount minus{' '}
          {base.year}&rsquo;s.
        </li>
        <li>
          <strong>Average year-over-year step:</strong>{' '}
          {fmtCents(stats.averageYearOverYearStep)}/month — the mean of the successive year-to-year
          differences. Equal to the {rows[rows.length - 1].year} increase divided by{' '}
          {rows.length - 1}.
        </li>
      </ul>

      <p>
        The referendum debt rate is included through {config.referendum.debtEndYear?.value}. It is on
        your bill whether or not the 2026 question passes.
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Render it from Results**

In `components/Results.tsx`, render `<Projection buckets={buckets} config={config} />` below the scenario comparison, threading `buckets` through from `Calculator.tsx`.

- [ ] **Step 5: Run and commit**

Run: `npm run test`
Expected: PASS.

```bash
git add components
git commit -m "feat: multi-year referendum projection with an adjustable growth assumption

Defines all four headline statistics inline so the district's published figure
and the average-versus-today figure cannot be read as the same quantity.

Refs localtransparency/noblesville#5"
```

---

## Task 14: Projection chart

**Files:**
- Create: `components/ProjectionChart.tsx`, `components/ProjectionChart.test.tsx`
- Modify: `components/Projection.tsx`

**Interfaces:**
- Consumes: `ProjectionRow[]` (Task 8).
- Produces: `<ProjectionChart rows={ProjectionRow[]} />`

- [ ] **Step 1: Write the failing test**

Create `components/ProjectionChart.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectionChart } from './ProjectionChart';
import { projectReferendumLine } from '../lib/tax/projection';
import { NOBLESVILLE } from '../lib/tax/indiana/districts/noblesville';

const rows = projectReferendumLine({ cap1: 350000, cap2: 0, cap3: 0 }, NOBLESVILLE);

describe('ProjectionChart', () => {
  it('is hidden from assistive tech, since the table carries the same data', () => {
    const { container } = render(<ProjectionChart rows={rows} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('plots one point per year', () => {
    const { container } = render(<ProjectionChart rows={rows} />);
    expect(container.querySelectorAll('circle')).toHaveLength(rows.length);
  });

  it('uses design tokens rather than hardcoded colors', () => {
    const { container } = render(<ProjectionChart rows={rows} />);
    expect(container.innerHTML).toMatch(/var\(--/);
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it('renders nothing when there are no rows', () => {
    const { container } = render(<ProjectionChart rows={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run components/ProjectionChart.test.tsx`
Expected: FAIL — cannot resolve `./ProjectionChart`.

- [ ] **Step 3: Implement**

Create `components/ProjectionChart.tsx`. Before writing it, read
`node_modules/@localtransparency/design/tokens.css` and use the actual exported
custom-property names for the accent, muted, and border colors.

```tsx
import type { ProjectionRow } from '../lib/tax/projection';

const W = 640, H = 220, PAD_X = 44, PAD_Y = 20;

/**
 * Nine points on one series — an inline SVG rather than a charting dependency,
 * so the app keeps its three runtime deps and the colors come straight from the
 * design tokens in both light and dark.
 *
 * aria-hidden: the adjacent table in Projection.tsx is the accessible
 * representation of exactly this data.
 */
export function ProjectionChart({ rows }: { rows: ProjectionRow[] }) {
  if (rows.length === 0) return null;

  const values = rows.map((r) => r.monthly);
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) => PAD_X + (i * (W - PAD_X - PAD_Y)) / Math.max(1, rows.length - 1);
  const y = (v: number) => H - PAD_Y - ((v - min) / span) * (H - PAD_Y * 2);

  const line = rows.map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(r.monthly).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" aria-hidden="true" focusable="false">
      <line x1={PAD_X} y1={H - PAD_Y} x2={W - PAD_Y} y2={H - PAD_Y} stroke="var(--lt-color-border)" strokeWidth="1" />
      <path d={line} fill="none" stroke="var(--lt-color-accent)" strokeWidth="2" />
      {rows.map((r, i) => (
        <circle key={r.year} cx={x(i)} cy={y(r.monthly)} r="3" fill="var(--lt-color-accent)" />
      ))}
      {rows.map((r, i) => (
        <text key={r.year} x={x(i)} y={H - PAD_Y + 14} textAnchor="middle" fontSize="10" fill="var(--lt-color-text-muted)">
          {r.year}
        </text>
      ))}
    </svg>
  );
}
```

- [ ] **Step 4: Render it and confirm the token names**

Add `<ProjectionChart rows={rows} />` above the table in `components/Projection.tsx`.

Run: `npm run dev`, open `http://localhost:3000/tools/2026-school-referendum`, look up an address, and confirm the chart is visible in both light and dark. If any stroke or fill is invisible, the token name is wrong — correct it against `tokens.css`.

- [ ] **Step 5: Run and commit**

Run: `npm run test`
Expected: PASS.

```bash
git add components
git commit -m "feat: inline SVG chart for the multi-year projection

Hand-rolled rather than a charting dependency: nine points, design tokens for
light/dark, aria-hidden with the adjacent table as the accessible equivalent.

Refs localtransparency/noblesville#5"
```

---

## Task 15: Methodology page — projection section

**Files:**
- Modify: `app/methodology/page.tsx`

**Interfaces:**
- Consumes: `NOBLESVILLE.referendum.projection` (Task 5), `projectionStats` definitions (Task 8).

- [ ] **Step 1: Add the section**

Append a new section to `app/methodology/page.tsx`, matching the file's existing heading and list markup:

```tsx
        <h2 id="projection">The multi-year projection</h2>
        <p>
          Rates for {nobFirstProjectionYear}–{nobFinalProjectionYear} are the district&rsquo;s own
          published schedule, transcribed from its referendum calculator. The district has not
          published this schedule anywhere else; the calculator is the source.{' '}
          <a href={nobProjectionSource}>Source</a>.
        </p>
        <p>
          Assessed-value growth defaults to the district&rsquo;s assumption — 5.3% for 2027, stated
          as the median annual growth of local existing residential parcels between the Hamilton
          County 2026 and 2027 certified net assessed value data sets, and 3.5% each year
          thereafter. You can change it in the tool.
        </p>
        <h3>What the projection does not model</h3>
        <ul>
          <li>
            Non-referendum rates beyond pay-2027. They are derived from the certified pay-2026
            total and held flat, which is flagged <code>estimated</code>. Projecting them eight
            years out would let the weakest input dominate every total, so the projection covers
            the referendum line only — the same scope as the district&rsquo;s calculator.
          </li>
          <li>
            The split of a single parcel&rsquo;s assessed value across the 1%, 2%, and 3% caps.
            Indiana splits a parcel — a homestead on more than one acre is capped at 1% on the
            dwelling plus one acre and 2% on the rest — and Hamilton County publishes no
            allocation. The tool infers a dominant class and lets you correct it.
          </li>
          <li>
            Any change in the law after SEA 1 (2025), or any rate a future board actually adopts.
            The board votes a rate every year.
          </li>
        </ul>
        <h3>How to read the four figures</h3>
        <p>
          The tool reports four statistics over the same series. They answer different questions and
          differ substantially, so each is defined exactly:
        </p>
        <ul>
          <li><strong>2027 change</strong> — 2027&rsquo;s monthly amount minus 2026&rsquo;s.</li>
          <li>
            <strong>Average increase over 2026</strong> — the mean, across all eight projected
            years, of each year&rsquo;s excess over 2026.
          </li>
          <li><strong>2034 increase</strong> — 2034&rsquo;s monthly amount minus 2026&rsquo;s.</li>
          <li>
            <strong>Average year-over-year step</strong> — the mean of the successive year-to-year
            differences. This equals the 2034 increase divided by eight, and measures how fast the
            amount grows rather than how far above 2026 it sits.
          </li>
        </ul>
```

Define the interpolated constants near the file's existing ones:

```ts
  const nobProjection = nobRef.projection!;
  const nobProjectionYears = Object.keys(nobProjection.operatingRates.value).map(Number).sort((a, b) => a - b);
  const nobFirstProjectionYear = nobProjectionYears[1];
  const nobFinalProjectionYear = nobProjectionYears[nobProjectionYears.length - 1];
  const nobProjectionSource = nobProjection.operatingRates.source;
```

- [ ] **Step 2: Verify and commit**

Run: `npm run test && npm run e2e`
Expected: PASS.

```bash
git add app/methodology/page.tsx
git commit -m "docs: document the projection's sources, limits, and four statistics

Refs localtransparency/noblesville#5"
```

---

## Task 16: Comparison artifact and data docs

Closes issue checkbox 2 ("test a number of properties against the district's calculator") and checkbox 3 ("understand the differences for base homeowners").

**Files:**
- Create: `docs/district-calculator-comparison.md`
- Modify: `docs/hamilton-county-2026-referendum-data.md`, `README.md`

- [ ] **Step 1: Gather the parcels**

Query the county layer for one real parcel in each of these profiles, recording parcel number, `PROPCLASS`, `hmstd_code`, `AVTOTGROSS`, `DEEDACRES`, and `TAXDISTNAM`. **Record parcel numbers only — never street addresses.**

```bash
curl -sS -G "https://services5.arcgis.com/beYj0ONLvCt8qxHA/arcgis/rest/services/Parcels_Current_Open_Data/FeatureServer/0/query" \
  --data-urlencode "where=hmstd_code=1 AND PROPCLASS='510' AND UPPER(TAXDISTNAM) LIKE '%NOBLESVILLE CITY%'" \
  --data-urlencode "outFields=PARCELNO,PROPCLASS,hmstd_code,AVTOTGROSS,DEEDACRES,TAXDISTNAM,AVTAXYR" \
  --data-urlencode "resultRecordCount=3" --data-urlencode "returnGeometry=false" --data-urlencode "f=json"
```

Repeat with `PROPCLASS='511' AND DEEDACRES>1` (multi-acre homestead), `hmstd_code=0 AND PROPCLASS='510'` (non-homestead residential), `hmstd_code=-1` (unconfirmed code), and a 4xx/6xx class (commercial).

- [ ] **Step 2: Run both models for each parcel**

For each parcel, record the 2027 operating-line figure from `projectReferendumLine` and from `districtCalculatorAnnual` (both already covered by Task 9's harness), plus this tool's full pay-2027 bill from `computeAllScenarios`.

- [ ] **Step 3: Write the artifact**

Create `docs/district-calculator-comparison.md` with this structure, filled from Step 2's real values:

```markdown
# This tool vs. the district's calculator

Both models run against real Hamilton County parcels, 2026 assessed values.
Parcels are identified by parcel number; no addresses appear here, consistent
with the tool's privacy posture.

District calculator retrieved 2026-08-12 from
<https://noblesvilleschoolsorg.finalsite.com/uploaded/NoblesvilleSchools_ReferendumCalculator.html>.

## Scope difference, stated once

The district's calculator computes the **referendum line only**
(`net AV × rate ÷ 100`). This tool computes that same line *and* the full tax
bill, including non-referendum rates, the circuit breaker, and the supplemental
homestead credit. Rows below compare the referendum line, which is the only
figure both models produce.

| Parcel | Class | Homestead | Gross AV | Cap | 2027 line (this tool) | 2027 line (district) | Δ |
|---|---|---|---|---|---|---|---|

## Why any row differs

<!-- One line per differing row, naming the mechanism. -->

## Full-bill context (this tool only)

<!-- pay-2027 total per parcel, with the note that non-referendum rates are held at
     certified pay-2026 levels and flagged estimated. -->
```

- [ ] **Step 4: Update the data trail and README**

In `docs/hamilton-county-2026-referendum-data.md`, replace the `$0.41` reference (line ~54) with the $0.385 commitment, its 2026-08-12 announcement date, and add the full rate and growth schedule with the calculator as source.

In `README.md`, extend "Updating numbers" to cover the `projection` block and the `districtCalculator.fixture.ts` refresh procedure, and add the projection to the feature description.

- [ ] **Step 5: Verify and commit**

Run: `npm run test && npm run e2e && npm run lint`
Expected: PASS.

```bash
git add docs README.md
git commit -m "docs: parcel-level comparison against the district's calculator

Covers homesteaded, multi-acre homesteaded, non-homestead residential,
unconfirmed-homestead-code, and commercial parcels. Parcel numbers only.

Closes localtransparency/noblesville#5"
```

---

## Self-Review

**Spec coverage:**

| Spec item | Task |
|---|---|
| `committed2027` → 0.385, explainer, sources | 2 |
| Half-cent rate formatting | 1 |
| Crossover FAQ correction | 3 |
| `DEDUCTIONS` 2026–2034, `CAP2_AV_DEDUCTION`, `CIRCUIT_BREAKER_RATES` | 4 |
| `projection` config block + drift guard | 5 |
| `CapClass`, `AvBuckets`, bucket-aware `computeNetAV` | 6 |
| Per-class circuit breaker, parity regression | 6, 7 |
| `projection.ts` + four statistics | 8 |
| District cross-check harness, $0.01, named divergences | 9 |
| `PROPCLASS`/`AVLAND`/`AVIMPROVE`/`DEEDACRES`, `hmstd_code = -1` | 10 |
| API passthrough | 11 |
| Cap-class panel, override, multi-acre hint | 12 |
| Growth control, multi-year table, debt row | 13 |
| Inline SVG chart | 14 |
| Methodology projection section | 15 |
| Comparison artifact, data doc, README | 16 |

**Not covered here, by design:** the two CMS blog posts and `scripts/publish-post.mjs`. They live in a different repository, depend on this plan's Task 16 output, and get their own plan.

**Type consistency:** `AvBuckets` (Task 6) is the parameter type for `computeNetAV` (6), `computeBill` (7), `computeAllScenarios` (7), `projectReferendumLine` (8), `CapClassPanel` (12), `Projection` (13). `CapClass` (Task 4) is used by `bucketsOf` (6), `CIRCUIT_BREAKER_RATES` (4), `inferCapClass` (10), `CapClassPanel` (12). `ProjectionRow`/`ProjectionStats` (8) are consumed by `Projection` (13) and `ProjectionChart` (14). `fmtRate` (1) is used in 2, 13, 15.

**Known cross-task breakage:** Task 4 deletes `CIRCUIT_BREAKER_RATE` while its consumer in `engine.ts` is not updated until Task 7. `npm run test` does not fully pass between Task 4 and Task 7 — this is called out in Task 4 Step 5 and is expected. Run tasks 4–7 as a block before evaluating full-suite green.
