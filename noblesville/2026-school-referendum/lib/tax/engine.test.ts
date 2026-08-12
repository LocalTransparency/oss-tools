import { describe, it, expect } from 'vitest';
import { bucketsOf, computeNetAV, computeBill, currentReferendumTotal, findDistrict, nonReferendumRate, totalGrossAV } from './engine';
import { buildScenarios } from './scenarios';
import { NOBLESVILLE } from './indiana/districts/noblesville';
import type { DistrictReferendumConfig } from './types';

const SCENARIOS = buildScenarios(NOBLESVILLE);

describe('computeNetAV', () => {
  it('pay-2026: $350k home → (350000-48000) × (1-0.40) = 181,200', () => {
    const r = computeNetAV(bucketsOf(350000, 1), SCENARIOS.current);
    expect(r.standardDeduction).toBe(48000);
    expect(r.supplementalDeduction).toBeCloseTo(120800, 2);
    expect(r.netAV).toBeCloseTo(181200, 2);
  });

  it('pay-2027: $350k home → (350000-40000) × (1-0.46) = 167,400 (ballot-language basis)', () => {
    const r = computeNetAV(bucketsOf(350000, 1), SCENARIOS.passMax);
    expect(r.netAV).toBeCloseTo(167400, 2);
  });

  it('gross AV below the standard deduction → net AV 0, no negative values', () => {
    const r = computeNetAV(bucketsOf(30000, 1), SCENARIOS.current);
    // A deduction cannot exceed the value it applies to: a $30,000 home caps
    // the $48,000 standard deduction at what's actually there.
    expect(r.standardDeduction).toBe(30000);
    expect(r.supplementalDeduction).toBe(0);
    expect(r.netAV).toBe(0);
  });

  it('supplemental deduction never exceeds 75% of gross AV (cannot bind with current params, but enforced)', () => {
    const r = computeNetAV(bucketsOf(1000000, 1), SCENARIOS.passCommitted);
    expect(r.supplementalDeduction).toBeLessThanOrEqual(0.75 * 1000000);
  });
});

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

const city = findDistrict(NOBLESVILLE, 'Noblesville City')!;
const township = findDistrict(NOBLESVILLE, 'Noblesville Twp')!;

describe('computeBill — anchored to official figures', () => {
  it('reproduces the pay-2026 worked example: $350k Noblesville City homestead ≈ $4,015.40', () => {
    const b = computeBill(bucketsOf(350000, 1), city, SCENARIOS.current, NOBLESVILLE);
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
    const b = computeBill(bucketsOf(350000, 1), city, SCENARIOS.passMax, NOBLESVILLE);
    expect(b.referendumOperatingTax).toBeCloseTo(954.18, 2); // 167400 × 0.57%
    expect(b.total).toBeCloseTo(4288.1, 2);
  });

  it('pass at committed $0.385: $350k city home ≈ $3,978.41', () => {
    const b = computeBill(bucketsOf(350000, 1), city, SCENARIOS.passCommitted, NOBLESVILLE);
    expect(b.nonReferendumNet).toBeCloseTo(3200, 2);  // 3523.60 capped at 3500, minus $300 credit
    expect(b.referendumOperatingTax).toBeCloseTo(644.49, 2); // 167400 × 0.385%
    expect(b.referendumTax).toBeCloseTo(778.41, 2);   // 167400 × 0.465%
    expect(b.total).toBeCloseTo(3978.41, 2);
  });

  it('fail: $350k city home ≈ $3,333.92 — $0.08 debt rate still applies', () => {
    const b = computeBill(bucketsOf(350000, 1), city, SCENARIOS.fail, NOBLESVILLE);
    expect(b.referendumOperatingTax).toBe(0);
    expect(b.referendumDebtTax).toBeCloseTo(133.92, 2); // 167400 × 0.08%
    expect(b.total).toBeCloseTo(3333.92, 2);
  });
});

describe('computeBill — cap and credit boundaries', () => {
  it('high AV: 1% cap binds hard ($800k city, pay-2026)', () => {
    const b = computeBill(bucketsOf(800000, 1), city, SCENARIOS.current, NOBLESVILLE);
    expect(b.nonReferendumGross).toBeCloseTo(9497.31, 2);
    expect(b.circuitBreakerCredit).toBeCloseTo(1497.31, 2);
    expect(b.supplementalHomesteadCredit).toBeCloseTo(300, 2);
    expect(b.total).toBeCloseTo(9730.4, 2); // 7700 + 2030.40 referendum
  });

  it('township: cap does not bind, credit below $300 ($350k, pay-2026)', () => {
    const b = computeBill(bucketsOf(350000, 1), township, SCENARIOS.current, NOBLESVILLE);
    expect(b.circuitBreakerCredit).toBe(0);                      // 2526.65 < 3500
    expect(b.supplementalHomesteadCredit).toBeCloseTo(252.67, 2); // 10% of 2526.65
    expect(b.total).toBeCloseTo(3089.39, 2);
  });

  it('zero net AV → zero everything', () => {
    const b = computeBill(bucketsOf(30000, 1), city, SCENARIOS.current, NOBLESVILLE);
    expect(b.total).toBe(0);
    expect(b.supplementalHomesteadCredit).toBe(0);
  });

  it('district with no existing referendum: missing rates default to 0 and the full certified rate is non-referendum', () => {
    const sparse: DistrictReferendumConfig = {
      id: 'sparse',
      name: 'Sparse District',
      county: 'Test',
      sources: {},
      referendum: {
        proposedMax: { value: 0.25, source: 'https://example.com/ballot', status: 'confirmed' },
      },
      gisGate: /sparse/i,
      taxDistricts: [{ name: 'Sparse Township', match: /township/i, totalRate2026: 2.0 }],
    };
    const district = sparse.taxDistricts[0];
    expect(currentReferendumTotal(sparse)).toBe(0);
    expect(nonReferendumRate(sparse, district)).toBe(2.0);

    const scenarios = buildScenarios(sparse);
    const b = computeBill(bucketsOf(350000, 1), district, scenarios.current, sparse);
    // pay-2026 net AV 181,200 at the full 2.0 rate, capped at 1% of gross, minus $300 credit
    expect(b.nonReferendumGross).toBeCloseTo(3624, 2);   // 181200 × 2.0%
    expect(b.circuitBreakerCredit).toBeCloseTo(124, 2);  // capped at 3500
    expect(b.referendumTax).toBe(0);
    expect(b.total).toBeCloseTo(3200, 2);                // 3500 − 300
  });

  it('referendum tax is excluded from both the cap and the credit base', () => {
    const b = computeBill(bucketsOf(800000, 1), city, SCENARIOS.passMax, NOBLESVILLE);
    // cap applies to non-referendum only:
    expect(b.nonReferendumGross - b.circuitBreakerCredit).toBeCloseTo(8000, 2);
    // referendum stacks on top, uncapped:
    expect(b.referendumTax).toBeCloseTo(410400 * 0.0065, 2);
    // credit computed from post-cap non-referendum liability only:
    expect(b.supplementalHomesteadCredit).toBe(300);
  });
});

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
    // Per-class credit: cap-1 liability (3,523.60) exceeds its 3,500 cap by 23.60;
    // cap-2 liability is under its cap and contributes nothing. A blended cap
    // (summed liability vs. summed cap) would wrongly let cap-2's headroom
    // absorb cap-1's excess and give a credit of 0.
    expect(b.circuitBreakerCredit).toBeCloseTo(23.6026, 2);
  });

  it("does not let one class's unused cap headroom shelter another class's liability", () => {
    const b = computeBill({ cap1: 800000, cap2: 0, cap3: 200000 }, city, SCENARIOS.current, NOBLESVILLE);
    // cap-1 liability exceeds its 1% cap; cap-3 is far under its 3% cap.
    // Per class the cap-1 excess is credited on its own: a blended cap would credit $0.
    expect(b.circuitBreakerCredit).toBeCloseTo(1497.31, 2);
  });

  it('the supplemental homestead credit is granted only on cap-1 liability', () => {
    const homestead = computeBill(bucketsOf(350000, 1), city, SCENARIOS.current, NOBLESVILLE);
    const rental = computeBill(bucketsOf(350000, 2), city, SCENARIOS.current, NOBLESVILLE);
    expect(homestead.supplementalHomesteadCredit).toBeCloseTo(300, 2);
    expect(rental.supplementalHomesteadCredit).toBe(0);
  });
});

describe('computeBill — binding 2%/3% caps (synthetic high-rate district)', () => {
  // No real Hamilton County district's certified rate is high enough to bind
  // the 2% or 3% caps: cap-2's effective rate tops out near 1.85% (2.1049% ×
  // (1 − 0.12) at the highest certified rate) against a 2% cap, and the
  // highest certified total rate (2.7455%) is still under the 3% cap. A
  // synthetic 5.0 total rate is used here solely to exercise those two
  // branches, which real rates cannot reach.
  const highRate: DistrictReferendumConfig = {
    id: 'highrate',
    name: 'High Rate District',
    county: 'Test',
    sources: {},
    referendum: {
      proposedMax: { value: 0.25, source: 'https://example.com/ballot', status: 'confirmed' },
    },
    gisGate: /highrate/i,
    taxDistricts: [{ name: 'High Rate Township', match: /township/i, totalRate2026: 5.0 }],
  };
  const highDistrict = highRate.taxDistricts[0];
  const highScenarios = buildScenarios(highRate);

  it('binds the 2% cap-2 cap', () => {
    const b = computeBill({ cap1: 0, cap2: 100000, cap3: 0 }, highDistrict, highScenarios.current, highRate);
    // pay-2026 cap-2 deduction is 6%: net AV 100000 × (1 − 0.06) = 94,000
    expect(b.netAV).toBeCloseTo(94000, 2);
    expect(b.nonReferendumGross).toBeCloseTo(4700, 2); // 94000 × 5.0%
    expect(b.circuitBreakerCap).toBeCloseTo(2000, 2);  // 2% × 100000
    expect(b.circuitBreakerCredit).toBeCloseTo(2700, 2);
  });

  it('binds the 3% cap-3 cap', () => {
    const b = computeBill({ cap1: 0, cap2: 0, cap3: 100000 }, highDistrict, highScenarios.current, highRate);
    expect(b.netAV).toBeCloseTo(100000, 2);            // cap-3 gets no deduction
    expect(b.nonReferendumGross).toBeCloseTo(5000, 2);  // 100000 × 5.0%
    expect(b.circuitBreakerCap).toBeCloseTo(3000, 2);   // 3% × 100000
    expect(b.circuitBreakerCredit).toBeCloseTo(2000, 2);
  });
});
