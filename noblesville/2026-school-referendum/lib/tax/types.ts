export interface Sourced<T> {
  value: T;
  source: string;
  status: 'confirmed' | 'estimated' | 'public-commitment';
  note?: string;
}

export type ScenarioId = 'current' | 'passCommitted' | 'passMax' | 'fail';

export interface ScenarioParams {
  id: ScenarioId;
  label: string;
  payYear: 2026 | 2027;
  standardDeduction: number;
  supplementalRate: number;        // fraction of post-standard remainder, e.g. 0.46
  referendumOperatingRate: number; // per $100 net AV
  referendumDebtRate: number;      // per $100 net AV
}

export interface TaxDistrict {
  name: string;
  match: RegExp;        // matched against ArcGIS TAXDISTNAM
  totalRate2026: number; // certified pay-2026 total, per $100
}

export interface DistrictReferendumConfig {
  id: string;                           // 'noblesville'
  name: string;                         // 'Noblesville Schools'
  county: string;                       // 'Hamilton'
  sources: Record<string, string>;      // district-specific URLs (DLGF determination,
                                        //   county rate sheet, budget order, district page)
  referendum: {
    proposedMax: Sourced<number>;       // required — every ballot question has one
    currentOperating?: Sourced<number>; // optional — existing operating referendum, if any
    debt?: Sourced<number>;             // optional — existing referendum debt, if any
    debtEndYear?: Sourced<number>;
    committed2027?: Sourced<number>;    // optional — voluntary public commitment
    // Plain-language summary of what THIS district's 2026 question actually does —
    // e.g. Carmel repeals BOTH its referendums, while HSE keeps its debt. Rendered
    // above the scenarios so the situation is clear before reading the numbers.
    explainer?: string;
  };
  gisGate: RegExp;                      // coarse filter on ArcGIS TAXDISTNAM, e.g. /noblesville/i
  taxDistricts: TaxDistrict[];          // certified pay-2026 rates + match patterns
}

export interface BillBreakdown {
  scenario: ScenarioId;
  grossAV: number;
  standardDeduction: number;
  supplementalDeduction: number;
  netAV: number;
  nonReferendumRate: number;       // per $100
  nonReferendumGross: number;
  circuitBreakerCap: number;       // 1% of gross AV
  circuitBreakerCredit: number;
  supplementalHomesteadCredit: number;
  nonReferendumNet: number;
  referendumOperatingTax: number;
  referendumDebtTax: number;
  referendumTax: number;
  total: number;
}
