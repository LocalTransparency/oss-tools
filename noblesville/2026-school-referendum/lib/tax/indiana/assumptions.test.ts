// This file supersedes the pre-existing `statewide assumptions integrity` suite, which
// asserted against the now-deleted `CIRCUIT_BREAKER_RATE` (singular) export. Its other
// assertions — exact pay-2026/2027 deduction values, the supplemental-deduction cap rate,
// the homestead credit, and source-URL checks on both — are retained below, in the
// `statewide assumptions integrity` block, alongside the new multi-year coverage.
import { describe, it, expect } from 'vitest';
import {
  DEDUCTIONS,
  CAP2_AV_DEDUCTION,
  CIRCUIT_BREAKER_RATES,
  SUPP_DEDUCTION_CAP_RATE,
  HOMESTEAD_CREDIT,
} from './assumptions';

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

  // Promoted 2026-08-12 against a primary source: DLGF, "Report on Property Tax
  // Exemptions, Deductions, and Abatements," April 30 2026. The standard deduction
  // is enumerated there BY ASSESSMENT DATE and the supplemental deduction BY PAY
  // YEAR; DEDUCTIONS is keyed by pay year, so the standard figures are shifted +1
  // (assessment date N -> pay year N+1) while the supplemental figures line up as
  // published, with no shift. See lib/tax/indiana/assumptions.ts for the full note.
  it('2028-2034 are confirmed against the DLGF exemptions/deductions report', () => {
    for (const y of [2028, 2029, 2030, 2031, 2032, 2033, 2034]) {
      expect(DEDUCTIONS[y].status, `${y} status`).toBe('confirmed');
    }
  });

  // Pins the exact out-year figures so a future edit can't quietly move a number
  // while leaving `status: 'confirmed'` in place. These values must NOT change as
  // part of the confirmed-status promotion — only status/source/note do.
  it('pins the exact out-year deduction values', () => {
    expect(DEDUCTIONS[2028].value).toEqual({ standard: 30000, supplementalRate: 0.52 });
    expect(DEDUCTIONS[2029].value).toEqual({ standard: 20000, supplementalRate: 0.57 });
    expect(DEDUCTIONS[2030].value).toEqual({ standard: 10000, supplementalRate: 0.62 });
    expect(DEDUCTIONS[2031].value).toEqual({ standard: 0, supplementalRate: 0.667 });
    expect(DEDUCTIONS[2032].value).toEqual({ standard: 0, supplementalRate: 0.667 });
    expect(DEDUCTIONS[2033].value).toEqual({ standard: 0, supplementalRate: 0.667 });
    expect(DEDUCTIONS[2034].value).toEqual({ standard: 0, supplementalRate: 0.667 });
  });
});

describe('CAP2_AV_DEDUCTION', () => {
  it('phases in to 33.4% by 2031 and holds', () => {
    expect(CAP2_AV_DEDUCTION.value[2026]).toBeCloseTo(0.06, 6);
    expect(CAP2_AV_DEDUCTION.value[2027]).toBeCloseTo(0.12, 6);
    expect(CAP2_AV_DEDUCTION.value[2031]).toBeCloseTo(0.334, 6);
    expect(CAP2_AV_DEDUCTION.value[2034]).toBeCloseTo(0.334, 6);
  });

  // The DLGF exemptions/deductions report that confirmed the standard and
  // supplemental homestead schedules (above) does not cover this schedule — it was
  // searched specifically and got zero hits. Must stay `estimated` with an honest
  // note; do not let the sibling promotion imply this one was verified too.
  it('remains estimated — not covered by the DLGF exemptions/deductions report', () => {
    expect(CAP2_AV_DEDUCTION.status).toBe('estimated');
    expect(CAP2_AV_DEDUCTION.note).toMatch(/pending primary-source verification/i);
  });
});

describe('CIRCUIT_BREAKER_RATES', () => {
  it('is 1/2/3 percent by cap class', () => {
    expect(CIRCUIT_BREAKER_RATES.value[1]).toBeCloseTo(0.01, 6);
    expect(CIRCUIT_BREAKER_RATES.value[2]).toBeCloseTo(0.02, 6);
    expect(CIRCUIT_BREAKER_RATES.value[3]).toBeCloseTo(0.03, 6);
  });
});

describe('statewide assumptions integrity', () => {
  it('pay-2026 and pay-2027 deduction values are exact', () => {
    expect(DEDUCTIONS[2026].value).toEqual({ standard: 48000, supplementalRate: 0.40 });
    expect(DEDUCTIONS[2027].value).toEqual({ standard: 40000, supplementalRate: 0.46 });
  });

  it('supplemental deduction cap is 75% of gross AV', () => {
    expect(SUPP_DEDUCTION_CAP_RATE.value).toBe(0.75);
  });

  it('supplemental homestead credit is min(10% of liability, $300)', () => {
    expect(HOMESTEAD_CREDIT.value).toEqual({ rate: 0.10, max: 300 });
  });

  it('every sourced statewide value cites an https source', () => {
    expect(SUPP_DEDUCTION_CAP_RATE.source).toMatch(/^https:\/\//);
    expect(HOMESTEAD_CREDIT.source).toMatch(/^https:\/\//);
    expect(CIRCUIT_BREAKER_RATES.source).toMatch(/^https:\/\//);
  });
});
