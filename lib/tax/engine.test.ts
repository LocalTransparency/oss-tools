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
