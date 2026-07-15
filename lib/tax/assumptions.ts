import type { ScenarioId, ScenarioParams, TaxDistrict } from './types';

export interface Sourced<T> {
  value: T;
  source: string;
  status: 'confirmed' | 'estimated' | 'public-commitment';
  note?: string;
}

export const SOURCES = {
  budgetOrder2026:
    'https://www.in.gov/dlgf/files/2026-reports/2026-budget-orders/Hamilton-260115-2026-Budget-Order.pdf',
  countyRateSheet2026:
    'https://www.hamiltoncounty.in.gov/DocumentCenter/View/31240/2026-District-Rates-PDF',
  dlgfDetermination:
    'https://www.in.gov/dlgf/files/referendum-documentation2/2026-november-referendum-documents/26-015-Noblesville-Schools-Operating-Determination.pdf',
  sea1Memo:
    'https://www.in.gov/dlgf/files/2025-memos/250612-Cockerill-Memo-Legislation-Affecting-Deductions,-Exemptions,-and-Credits.pdf',
  districtReferendumPage: 'https://www.noblesvilleschools.org/referendum',
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

export const REFERENDUM = {
  currentOperating: {
    value: 0.37, source: SOURCES.countyRateSheet2026, status: 'confirmed',
    note: '2018 operating referendum; last levy pay-2026.',
  } as Sourced<number>,
  debt: {
    value: 0.08, source: SOURCES.countyRateSheet2026, status: 'confirmed',
    note: '2010 referendum debt; continues through 2032 regardless of the 2026 vote.',
  } as Sourced<number>,
  proposedMax: {
    value: 0.57, source: SOURCES.dlgfDetermination, status: 'confirmed',
    note: 'Ballot-authorized maximum rate; max annual levy $43,842,578; up to 8 years.',
  } as Sourced<number>,
  committed2027: {
    value: 0.41, source: SOURCES.districtReferendumPage, status: 'public-commitment',
    note: 'District public commitment for 2027 only; not legally binding; later years may be higher, up to $0.57.',
  } as Sourced<number>,
};

export const CURRENT_REFERENDUM_TOTAL: Sourced<number> = {
  value: REFERENDUM.currentOperating.value + REFERENDUM.debt.value, // 0.45
  source: SOURCES.countyRateSheet2026, status: 'confirmed',
};

/** Certified pay-2026 total district rates (DLGF budget order). Match patterns are tested against ArcGIS TAXDISTNAM. */
export const DISTRICTS: TaxDistrict[] = [
  { name: 'Noblesville–Fall Creek', match: /fall\s*creek/i, totalRate2026: 2.4503 },
  { name: 'Noblesville–Delaware', match: /delaware/i, totalRate2026: 2.4813 },
  { name: 'Noblesville–Wayne', match: /wayne/i, totalRate2026: 2.4737 },
  { name: 'Noblesville City', match: /city/i, totalRate2026: 2.5549 },
  { name: 'Noblesville Township', match: /township|twp/i, totalRate2026: 1.8444 },
];

export function findDistrict(taxDistrictName: string): TaxDistrict | null {
  if (!/noblesville/i.test(taxDistrictName)) return null;
  return DISTRICTS.find((d) => d.match.test(taxDistrictName)) ?? null;
}

/** Non-referendum portion of the certified total; held at 2026 levels for pay-2027 scenarios (estimated). */
export function nonReferendumRate(d: TaxDistrict): number {
  return d.totalRate2026 - CURRENT_REFERENDUM_TOTAL.value;
}

export const SCENARIOS: Record<ScenarioId, ScenarioParams> = {
  current: {
    id: 'current', label: 'Current (pay-2026)', payYear: 2026,
    standardDeduction: DEDUCTIONS[2026].value.standard,
    supplementalRate: DEDUCTIONS[2026].value.supplementalRate,
    referendumOperatingRate: REFERENDUM.currentOperating.value,
    referendumDebtRate: REFERENDUM.debt.value,
  },
  passCommitted: {
    id: 'passCommitted', label: 'If it passes — committed 2027 rate ($0.41)', payYear: 2027,
    standardDeduction: DEDUCTIONS[2027].value.standard,
    supplementalRate: DEDUCTIONS[2027].value.supplementalRate,
    referendumOperatingRate: REFERENDUM.committed2027.value,
    referendumDebtRate: REFERENDUM.debt.value,
  },
  passMax: {
    id: 'passMax', label: 'If it passes — authorized maximum ($0.57)', payYear: 2027,
    standardDeduction: DEDUCTIONS[2027].value.standard,
    supplementalRate: DEDUCTIONS[2027].value.supplementalRate,
    referendumOperatingRate: REFERENDUM.proposedMax.value,
    referendumDebtRate: REFERENDUM.debt.value,
  },
  fail: {
    id: 'fail', label: 'If it fails (pay-2027)', payYear: 2027,
    standardDeduction: DEDUCTIONS[2027].value.standard,
    supplementalRate: DEDUCTIONS[2027].value.supplementalRate,
    referendumOperatingRate: 0,
    referendumDebtRate: REFERENDUM.debt.value,
  },
};
