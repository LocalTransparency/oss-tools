import type { Sourced } from '../types';

export const SOURCES = {
  sea1Memo:
    'https://www.in.gov/dlgf/files/2025-memos/250612-Cockerill-Memo-Legislation-Affecting-Deductions,-Exemptions,-and-Credits.pdf',
} as const;

/** SEA 1 (2025) homestead deduction schedule, by pay year. */
export const DEDUCTIONS: Record<2026 | 2027, Sourced<{ standard: number; supplementalRate: number }>> = {
  2026: { value: { standard: 48000, supplementalRate: 0.40 }, source: SOURCES.sea1Memo, status: 'confirmed' },
  2027: { value: { standard: 40000, supplementalRate: 0.46 }, source: SOURCES.sea1Memo, status: 'confirmed' },
};

/** Supplemental deduction may not exceed 75% of gross AV (IC 6-1.1-12-37.5). */
export const SUPP_DEDUCTION_CAP_RATE: Sourced<number> = {
  value: 0.75, source: SOURCES.sea1Memo, status: 'confirmed',
};

/** 1% homestead circuit breaker cap; referendum taxes are outside the cap. */
export const CIRCUIT_BREAKER_RATE: Sourced<number> = {
  value: 0.01, source: SOURCES.sea1Memo, status: 'confirmed',
  note: 'Applies to non-referendum liability only; referendum rates are exempt from the cap.',
};

/** Supplemental homestead credit: min(10% of liability, $300), referendum taxes excluded (IC 6-1.1-20.6-7.7). */
export const HOMESTEAD_CREDIT: Sourced<{ rate: number; max: number }> = {
  value: { rate: 0.10, max: 300 }, source: SOURCES.sea1Memo, status: 'confirmed',
  note: 'Applied after circuit breaker credits; referendum taxes excluded from the calculation.',
};
