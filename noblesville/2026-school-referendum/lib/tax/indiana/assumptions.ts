import type { CapClass, Sourced } from '../types';

export const SOURCES = {
  sea1Memo:
    'https://www.in.gov/dlgf/files/2025-memos/250612-Cockerill-Memo-Legislation-Affecting-Deductions,-Exemptions,-and-Credits.pdf',
  exemptionsDeductionsReport2026:
    'https://www.in.gov/dlgf/files/2026-Exemptions-and-Deductions-Report.pdf',
} as const;

/**
 * SEA 1 (2025) homestead deduction schedule, by pay year.
 *
 * 2026 and 2027 are confirmed against the DLGF memo. 2028–2034 are confirmed
 * against a second primary source, the DLGF's April 30 2026 "Report on Property
 * Tax Exemptions, Deductions, and Abatements" (`exemptionsDeductionsReport2026`).
 *
 * ASSESSMENT DATE vs. PAY YEAR — READ BEFORE EDITING THIS TABLE:
 * The report enumerates the standard homestead deduction (IC 6-1.1-12-37) BY
 * ASSESSMENT DATE ($48,000 for the 2025 assessment date, $40,000 for 2026,
 * $30,000 for 2027, $20,000 for 2028, $10,000 for 2029, $0 for 2030 and each
 * assessment date thereafter). Indiana assessment year N sets taxes payable in
 * year N+1, so those figures are shifted +1 to land on this map's pay-year keys
 * (assessment date 2027 -> pay year 2028, etc.) — DO NOT re-shift them, the
 * standard-deduction values below already reflect that shift and are correct.
 * The supplemental homestead deduction (IC 6-1.1-12-37.5) is enumerated in the
 * same report BY PAY YEAR already (40% for taxes first due and payable in 2026,
 * 46% in 2027, 52% in 2028, 57% in 2029, 62% in 2030, 66.7% in 2031 and each
 * year thereafter) — those figures need NO shift. (Citation note: the IC cite
 * immediately following the supplemental schedule in the report, 6-1.1-12-40.5,
 * governs mobile/manufactured homes, a parallel section — the real-property
 * supplemental deduction cite is 6-1.1-12-37.5, which heads the passage.)
 */
export const DEDUCTIONS: Record<number, Sourced<{ standard: number; supplementalRate: number }>> = {
  2026: { value: { standard: 48000, supplementalRate: 0.40 }, source: SOURCES.sea1Memo, status: 'confirmed' },
  2027: { value: { standard: 40000, supplementalRate: 0.46 }, source: SOURCES.sea1Memo, status: 'confirmed' },
  2028: { value: { standard: 30000, supplementalRate: 0.52 }, source: SOURCES.exemptionsDeductionsReport2026, status: 'confirmed', note: 'IC 6-1.1-12-37 standard deduction, assessment date 2027 (+1 shift to pay year); IC 6-1.1-12-37.5 supplemental rate, pay year 2028 (no shift).' },
  2029: { value: { standard: 20000, supplementalRate: 0.57 }, source: SOURCES.exemptionsDeductionsReport2026, status: 'confirmed', note: 'IC 6-1.1-12-37 standard deduction, assessment date 2028 (+1 shift to pay year); IC 6-1.1-12-37.5 supplemental rate, pay year 2029 (no shift).' },
  2030: { value: { standard: 10000, supplementalRate: 0.62 }, source: SOURCES.exemptionsDeductionsReport2026, status: 'confirmed', note: 'IC 6-1.1-12-37 standard deduction, assessment date 2029 (+1 shift to pay year); IC 6-1.1-12-37.5 supplemental rate, pay year 2030 (no shift).' },
  2031: { value: { standard: 0, supplementalRate: 0.667 }, source: SOURCES.exemptionsDeductionsReport2026, status: 'confirmed', note: 'IC 6-1.1-12-37 standard deduction is $0 for the 2030 assessment date and each thereafter (+1 shift to pay year); IC 6-1.1-12-37.5 supplemental rate is 66.7% for pay year 2031 and each year thereafter (no shift).' },
  2032: { value: { standard: 0, supplementalRate: 0.667 }, source: SOURCES.exemptionsDeductionsReport2026, status: 'confirmed', note: 'Standard deduction fully phased out (IC 6-1.1-12-37); supplemental holds at 66.7% (IC 6-1.1-12-37.5).' },
  2033: { value: { standard: 0, supplementalRate: 0.667 }, source: SOURCES.exemptionsDeductionsReport2026, status: 'confirmed', note: 'Standard deduction fully phased out (IC 6-1.1-12-37); supplemental holds at 66.7% (IC 6-1.1-12-37.5).' },
  2034: { value: { standard: 0, supplementalRate: 0.667 }, source: SOURCES.exemptionsDeductionsReport2026, status: 'confirmed', note: 'Standard deduction fully phased out (IC 6-1.1-12-37); supplemental holds at 66.7% (IC 6-1.1-12-37.5).' },
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
