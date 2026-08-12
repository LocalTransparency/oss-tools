import type { CapClass, Sourced } from '../types';

export const SOURCES = {
  sea1Memo:
    'https://www.in.gov/dlgf/files/2025-memos/250612-Cockerill-Memo-Legislation-Affecting-Deductions,-Exemptions,-and-Credits.pdf',
} as const;

/**
 * SEA 1 (2025) homestead deduction schedule, by pay year.
 *
 * 2026 and 2027 are confirmed against the DLGF memo. 2028–2034 are marked
 * `estimated` until each year is verified against the memo or the statute
 * directly — the district's calculator uses the same figures, which is a
 * cross-check, not a source. Promote a year to `confirmed` only with a
 * primary-source citation.
 */
export const DEDUCTIONS: Record<number, Sourced<{ standard: number; supplementalRate: number }>> = {
  2026: { value: { standard: 48000, supplementalRate: 0.40 }, source: SOURCES.sea1Memo, status: 'confirmed' },
  2027: { value: { standard: 40000, supplementalRate: 0.46 }, source: SOURCES.sea1Memo, status: 'confirmed' },
  2028: { value: { standard: 30000, supplementalRate: 0.52 }, source: SOURCES.sea1Memo, status: 'estimated', note: 'Out-year schedule pending primary-source verification.' },
  2029: { value: { standard: 20000, supplementalRate: 0.57 }, source: SOURCES.sea1Memo, status: 'estimated', note: 'Out-year schedule pending primary-source verification.' },
  2030: { value: { standard: 10000, supplementalRate: 0.62 }, source: SOURCES.sea1Memo, status: 'estimated', note: 'Out-year schedule pending primary-source verification.' },
  2031: { value: { standard: 0, supplementalRate: 0.667 }, source: SOURCES.sea1Memo, status: 'estimated', note: 'Standard deduction fully phased out; supplemental holds from here.' },
  2032: { value: { standard: 0, supplementalRate: 0.667 }, source: SOURCES.sea1Memo, status: 'estimated', note: 'Standard deduction fully phased out; supplemental holds from here.' },
  2033: { value: { standard: 0, supplementalRate: 0.667 }, source: SOURCES.sea1Memo, status: 'estimated', note: 'Standard deduction fully phased out; supplemental holds from here.' },
  2034: { value: { standard: 0, supplementalRate: 0.667 }, source: SOURCES.sea1Memo, status: 'estimated', note: 'Standard deduction fully phased out; supplemental holds from here.' },
};

/** Supplemental deduction may not exceed 75% of gross AV (IC 6-1.1-12-37.5). */
export const SUPP_DEDUCTION_CAP_RATE: Sourced<number> = {
  value: 0.75, source: SOURCES.sea1Memo, status: 'confirmed',
};

/**
 * SEA 1 phased deduction against cap-2 assessed value (non-homestead
 * residential and agricultural land). Cap-3 property receives no equivalent.
 */
export const CAP2_AV_DEDUCTION: Sourced<Record<number, number>> = {
  value: {
    2026: 0.06, 2027: 0.12, 2028: 0.19, 2029: 0.25,
    2030: 0.30, 2031: 0.334, 2032: 0.334, 2033: 0.334, 2034: 0.334,
  },
  source: SOURCES.sea1Memo,
  status: 'estimated',
  note: 'Phase-in schedule pending primary-source verification beyond pay-2027.',
};

/**
 * Indiana constitutional circuit-breaker caps by class (IC 6-1.1-20.6):
 * 1% homestead, 2% other residential and agricultural land, 3% all other.
 * Applies to non-referendum liability only; referendum rates sit outside it.
 */
export const CIRCUIT_BREAKER_RATES: Sourced<Record<CapClass, number>> = {
  value: { 1: 0.01, 2: 0.02, 3: 0.03 },
  source: SOURCES.sea1Memo,
  status: 'confirmed',
  note: 'Applies to non-referendum liability only; referendum rates are exempt from the cap.',
};

/** Supplemental homestead credit: min(10% of liability, $300), referendum taxes excluded (IC 6-1.1-20.6-7.7). */
export const HOMESTEAD_CREDIT: Sourced<{ rate: number; max: number }> = {
  value: { rate: 0.10, max: 300 }, source: SOURCES.sea1Memo, status: 'confirmed',
  note: 'Applied after circuit breaker credits; referendum taxes excluded from the calculation.',
};
