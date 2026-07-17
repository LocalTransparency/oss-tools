# Indiana tax-assumptions restructure — design

**Date:** 2026-07-17
**Status:** Approved
**Scope:** `noblesville/2026-school-referendum/lib/tax/` (and its importers)

## Goal

Split the single `lib/tax/assumptions.ts` — which interleaves statewide Indiana tax
law, Noblesville-specific referendum facts, and derived scenarios — into a shared
statewide layer plus per-district config files, so additional Indiana school-district
referendums can be added by writing **one data file and one registry line**, with no
engine, scenario, or type changes.

Out of scope (next phase): loading district config by resolved address; multi-district
UI; renaming the tool directory.

## Target structure

```
lib/tax/
  types.ts                        # shared types: Sourced<T>, ScenarioParams, BillBreakdown,
                                  #   TaxDistrict, DistrictReferendumConfig
  engine.ts                       # pure math — logic unchanged, gains config parameter
  scenarios.ts                    # buildScenarios(config) + computeAllScenarios(grossAV, district, config)
  indiana/
    assumptions.ts                # statewide law ONLY: SEA 1 deduction schedule (DEDUCTIONS),
                                  #   SUPP_DEDUCTION_CAP_RATE, CIRCUIT_BREAKER_RATE,
                                  #   HOMESTEAD_CREDIT, state-level SOURCES (sea1Memo)
    districts/
      noblesville.ts              # NOBLESVILLE: DistrictReferendumConfig — referendum rates,
                                  #   commitments, debt end year, tax districts + GIS matching,
                                  #   district-specific sources
      index.ts                    # registry: export const DISTRICTS = { noblesville: NOBLESVILLE }
```

`lib/tax/assumptions.ts` is **deleted**. No compat barrel — importers are updated:
`components/Calculator.tsx`, `components/Results.tsx`, `components/Results.test.tsx`,
`app/methodology/page.tsx`, `lib/tax/engine.ts`, and the three test files under `lib/tax/`.

## The district config contract

```ts
export interface DistrictReferendumConfig {
  id: string;                           // 'noblesville'
  name: string;                         // 'Noblesville Schools'
  county: string;                       // 'Hamilton'
  sources: Record<string, string>;      // district-specific URLs (DLGF determination,
                                        //   county rate sheet, budget order, district page)
  referendum: {
    proposedMax: Sourced<number>;       // required — every ballot question has one
    currentOperating?: Sourced<number>; // optional — existing operating referendum, if any
    debt?: Sourced<number>;             // optional — existing referendum debt, if any
    debtEndYear?: Sourced<number>;
    committed2027?: Sourced<number>;    // optional — voluntary public commitment
  };
  gisGate: RegExp;                      // coarse filter on ArcGIS TAXDISTNAM, e.g. /noblesville/i
  taxDistricts: TaxDistrict[];          // certified pay-2026 rates + match patterns
}
```

`Sourced<T>` moves from `assumptions.ts` into `types.ts` unchanged.

## Behavior rules (fixed 4-scenario shape retained)

- `buildScenarios(config)` produces the same four scenarios (`current`,
  `passCommitted`, `passMax`, `fail`) from statewide `DEDUCTIONS` + the config.
- Missing `currentOperating` / `debt` → treated as rate 0.
- Missing `committed2027` → `passCommitted` falls back to `proposedMax`; scenario labels
  are built from the **actual value used** (e.g. `$0.41` vs `$0.57`), so labels stay honest.
- Numeric outputs for Noblesville must be **identical** before and after the refactor.

## Function migrations

| Before | After |
|---|---|
| `findDistrict(name)` | `findDistrict(config, name)` — gate on `config.gisGate`, then match `config.taxDistricts` |
| `nonReferendumRate(district)` (used module const `CURRENT_REFERENDUM_TOTAL`) | `nonReferendumRate(config, district)` — current referendum total derived from config (`(currentOperating ?? 0) + (debt ?? 0)`) |
| `computeBill(grossAV, district, scenario)` | `computeBill(grossAV, district, scenario, config)` |
| `computeAllScenarios(grossAV, district)` | `computeAllScenarios(grossAV, district, config)` |
| `SCENARIOS` module constant | `buildScenarios(config)` |
| `CURRENT_REFERENDUM_TOTAL` constant | derived helper, e.g. `currentReferendumTotal(config)` |

App components import `NOBLESVILLE` from the district file (or registry) and pass it
explicitly — that call site is the seam where address-resolution plugs in later.

## Testing

- Existing assertions move with their subjects: statewide-law tests →
  `indiana/assumptions.test.ts`; Noblesville data-integrity + GIS-matching tests →
  `indiana/districts/noblesville.test.ts`; scenario tests exercise
  `buildScenarios(NOBLESVILLE)`; engine tests pass the config explicitly.
- New test: `buildScenarios` with a **minimal config** (only `proposedMax`) —
  optional rates default to 0, `passCommitted` falls back to `proposedMax`, labels
  reflect actual values. This is the guarantee the structure supports the next district.
- All existing numeric expectations remain byte-identical (refactor must not change math).

## Documentation

Add an "Adding a district" section to the tool README documenting the pattern:
copy `noblesville.ts` as a template, fill in sourced values, register in `index.ts`.
No placeholder/fake district data ships in the codebase.
