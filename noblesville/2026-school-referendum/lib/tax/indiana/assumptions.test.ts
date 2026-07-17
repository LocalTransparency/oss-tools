import { describe, it, expect } from 'vitest';
import { CIRCUIT_BREAKER_RATE, DEDUCTIONS, HOMESTEAD_CREDIT, SUPP_DEDUCTION_CAP_RATE } from './assumptions';

describe('statewide assumptions integrity', () => {
  it('SEA 1 deduction schedule matches pay-2026 and pay-2027 figures', () => {
    expect(DEDUCTIONS[2026].value).toEqual({ standard: 48000, supplementalRate: 0.40 });
    expect(DEDUCTIONS[2027].value).toEqual({ standard: 40000, supplementalRate: 0.46 });
  });

  it('supplemental deduction cap is 75% of gross AV', () => {
    expect(SUPP_DEDUCTION_CAP_RATE.value).toBe(0.75);
  });

  it('circuit breaker cap is 1%', () => {
    expect(CIRCUIT_BREAKER_RATE.value).toBe(0.01);
  });

  it('supplemental homestead credit is min(10% of liability, $300)', () => {
    expect(HOMESTEAD_CREDIT.value).toEqual({ rate: 0.10, max: 300 });
  });

  it('every sourced value cites an http source', () => {
    expect(DEDUCTIONS[2026].source).toMatch(/^https?:\/\//);
    expect(DEDUCTIONS[2027].source).toMatch(/^https?:\/\//);
    expect(SUPP_DEDUCTION_CAP_RATE.source).toMatch(/^https?:\/\//);
    expect(CIRCUIT_BREAKER_RATE.source).toMatch(/^https?:\/\//);
    expect(HOMESTEAD_CREDIT.source).toMatch(/^https?:\/\//);
  });
});
