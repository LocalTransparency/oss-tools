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
