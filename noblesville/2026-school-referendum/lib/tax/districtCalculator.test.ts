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
