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
  // Finding I (minor): two tests previously lived here —
  // "this engine caps the supplemental deduction at 75%..." and "this engine
  // floors each bucket at zero...". Both asserted `row.netAV >=
  // 0`/`Number.isFinite(theirs)`, floors that `computeNetAV` guarantees
  // unconditionally via `Math.max(0, ...)` on every code path — no mutation
  // to this tool's production code could ever make either assertion fail, so
  // they passed against any implementation and provided no signal. Deleted
  // rather than kept as dead weight that reads as coverage:
  //   - the 75%-cap divergence is now meaningfully tested (with an
  //     assertion that CAN fail) in lib/tax/engine.test.ts, by driving
  //     supplementalRate synthetically past 0.75;
  //   - the floor-at-zero behavior is meaningfully tested (again, an
  //     assertion that CAN fail, using raw negative buckets that bypass any
  //     clamping upstream) in lib/tax/engine.test.ts's "negative buckets
  //     never manufacture a positive net AV" block.
  // Constructing a replacement here that could fail would require either
  // duplicating those existing engine.test.ts assertions, or asserting a
  // property of `districtCalculatorAnnual` itself (the fixture) rather than
  // of this tool — the same problem the deleted Number.isFinite(theirs)
  // check had.

  it('this tool projects the referendum debt rate, which the district\'s calculator omits', () => {
    const ours = projectReferendumLine(bucketsOf(350000, 1), NOBLESVILLE);
    expect(ours.find((r) => r.year === 2027)!.debtTax).toBeGreaterThan(0);
    expect(ours.find((r) => r.year === 2027)!.annual)
      .toBeGreaterThan(districtCalculatorAnnual(350000)[2027]);
  });
});
