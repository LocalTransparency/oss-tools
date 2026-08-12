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
