import { describe, it, expect } from 'vitest';
import { computeNetAV, computeBill, currentReferendumTotal, findDistrict, nonReferendumRate } from './engine';
import { buildScenarios } from './scenarios';
import { NOBLESVILLE } from './indiana/districts/noblesville';
import type { DistrictReferendumConfig } from './types';

const SCENARIOS = buildScenarios(NOBLESVILLE);

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

const city = findDistrict(NOBLESVILLE, 'Noblesville City')!;
const township = findDistrict(NOBLESVILLE, 'Noblesville Twp')!;

describe('computeBill — anchored to official figures', () => {
  it('reproduces the pay-2026 worked example: $350k Noblesville City homestead ≈ $4,015.40', () => {
    const b = computeBill(350000, city, SCENARIOS.current, NOBLESVILLE);
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
    const b = computeBill(350000, city, SCENARIOS.passMax, NOBLESVILLE);
    expect(b.referendumOperatingTax).toBeCloseTo(954.18, 2); // 167400 × 0.57%
    expect(b.total).toBeCloseTo(4288.1, 2);
  });

  it('pass at committed $0.41: $350k city home ≈ $4,020.26', () => {
    const b = computeBill(350000, city, SCENARIOS.passCommitted, NOBLESVILLE);
    expect(b.nonReferendumNet).toBeCloseTo(3200, 2); // 3523.60 capped at 3500, minus $300 credit
    expect(b.referendumTax).toBeCloseTo(820.26, 2);  // 167400 × 0.49%
    expect(b.total).toBeCloseTo(4020.26, 2);
  });

  it('fail: $350k city home ≈ $3,333.92 — $0.08 debt rate still applies', () => {
    const b = computeBill(350000, city, SCENARIOS.fail, NOBLESVILLE);
    expect(b.referendumOperatingTax).toBe(0);
    expect(b.referendumDebtTax).toBeCloseTo(133.92, 2); // 167400 × 0.08%
    expect(b.total).toBeCloseTo(3333.92, 2);
  });
});

describe('computeBill — cap and credit boundaries', () => {
  it('high AV: 1% cap binds hard ($800k city, pay-2026)', () => {
    const b = computeBill(800000, city, SCENARIOS.current, NOBLESVILLE);
    expect(b.nonReferendumGross).toBeCloseTo(9497.31, 2);
    expect(b.circuitBreakerCredit).toBeCloseTo(1497.31, 2);
    expect(b.supplementalHomesteadCredit).toBeCloseTo(300, 2);
    expect(b.total).toBeCloseTo(9730.4, 2); // 7700 + 2030.40 referendum
  });

  it('township: cap does not bind, credit below $300 ($350k, pay-2026)', () => {
    const b = computeBill(350000, township, SCENARIOS.current, NOBLESVILLE);
    expect(b.circuitBreakerCredit).toBe(0);                      // 2526.65 < 3500
    expect(b.supplementalHomesteadCredit).toBeCloseTo(252.67, 2); // 10% of 2526.65
    expect(b.total).toBeCloseTo(3089.39, 2);
  });

  it('zero net AV → zero everything', () => {
    const b = computeBill(30000, city, SCENARIOS.current, NOBLESVILLE);
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
    const b = computeBill(350000, district, scenarios.current, sparse);
    // pay-2026 net AV 181,200 at the full 2.0 rate, capped at 1% of gross, minus $300 credit
    expect(b.nonReferendumGross).toBeCloseTo(3624, 2);   // 181200 × 2.0%
    expect(b.circuitBreakerCredit).toBeCloseTo(124, 2);  // capped at 3500
    expect(b.referendumTax).toBe(0);
    expect(b.total).toBeCloseTo(3200, 2);                // 3500 − 300
  });

  it('referendum tax is excluded from both the cap and the credit base', () => {
    const b = computeBill(800000, city, SCENARIOS.passMax, NOBLESVILLE);
    // cap applies to non-referendum only:
    expect(b.nonReferendumGross - b.circuitBreakerCredit).toBeCloseTo(8000, 2);
    // referendum stacks on top, uncapped:
    expect(b.referendumTax).toBeCloseTo(410400 * 0.0065, 2);
    // credit computed from post-cap non-referendum liability only:
    expect(b.supplementalHomesteadCredit).toBe(300);
  });
});
