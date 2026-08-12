import type { AvBuckets, BillBreakdown, CapClass, DistrictReferendumConfig, ScenarioParams, TaxDistrict } from './types';
import { CAP2_AV_DEDUCTION, CIRCUIT_BREAKER_RATES, HOMESTEAD_CREDIT, SUPP_DEDUCTION_CAP_RATE } from './indiana/assumptions';

/** Resolve an ArcGIS TAXDISTNAM to one of the config's tax districts (gisGate filters first). */
export function findDistrict(config: DistrictReferendumConfig, taxDistrictName: string): TaxDistrict | null {
  if (!config.gisGate.test(taxDistrictName)) return null;
  return config.taxDistricts.find((d) => d.match.test(taxDistrictName)) ?? null;
}

/** Current referendum total rate: existing operating + existing debt (missing → 0). */
export function currentReferendumTotal(config: DistrictReferendumConfig): number {
  return (config.referendum.currentOperating?.value ?? 0) + (config.referendum.debt?.value ?? 0);
}

/** Non-referendum portion of the certified total; held at 2026 levels for pay-2027 scenarios (estimated). */
export function nonReferendumRate(config: DistrictReferendumConfig, d: TaxDistrict): number {
  return d.totalRate2026 - currentReferendumTotal(config);
}

/** Route a single gross AV entirely to one cap class. */
export function bucketsOf(grossAV: number, capClass: CapClass): AvBuckets {
  return {
    cap1: capClass === 1 ? grossAV : 0,
    cap2: capClass === 2 ? grossAV : 0,
    cap3: capClass === 3 ? grossAV : 0,
  };
}

export function totalGrossAV(b: AvBuckets): number {
  return b.cap1 + b.cap2 + b.cap3;
}

/**
 * Net AV by cap class. Homestead standard + supplemental deductions apply to
 * cap-1 AV only; the SEA 1 Cap 2 deduction applies to cap-2 AV; cap-3 AV gets
 * nothing. Each bucket is floored at zero independently.
 */
export function computeNetAV(buckets: AvBuckets, s: ScenarioParams) {
  const standardDeduction = Math.min(buckets.cap1, s.standardDeduction);
  const afterStandard = Math.max(0, buckets.cap1 - standardDeduction);
  const supplementalDeduction = Math.min(
    afterStandard * s.supplementalRate,
    buckets.cap1 * SUPP_DEDUCTION_CAP_RATE.value,
  );
  const cap1Net = Math.max(0, afterStandard - supplementalDeduction);

  const cap2Rate = CAP2_AV_DEDUCTION.value[s.payYear] ?? 0;
  const cap2Deduction = buckets.cap2 * cap2Rate;
  const cap2Net = Math.max(0, buckets.cap2 - cap2Deduction);

  const cap3Net = Math.max(0, buckets.cap3);

  return {
    standardDeduction,
    supplementalDeduction,
    cap2Deduction,
    netAV: cap1Net + cap2Net + cap3Net,
    byClass: { 1: cap1Net, 2: cap2Net, 3: cap3Net } as Record<CapClass, number>,
  };
}

export function computeBill(
  grossAV: number,
  district: TaxDistrict,
  s: ScenarioParams,
  config: DistrictReferendumConfig,
): BillBreakdown {
  const { standardDeduction, supplementalDeduction, netAV } = computeNetAV(grossAV, s);

  const nonRefRate = nonReferendumRate(config, district);
  const nonReferendumGross = (netAV * nonRefRate) / 100;

  const circuitBreakerCap = grossAV * CIRCUIT_BREAKER_RATE.value;
  const circuitBreakerCredit = Math.max(0, nonReferendumGross - circuitBreakerCap);
  const afterCap = nonReferendumGross - circuitBreakerCredit;

  const supplementalHomesteadCredit = Math.min(
    afterCap * HOMESTEAD_CREDIT.value.rate,
    HOMESTEAD_CREDIT.value.max,
  );
  const nonReferendumNet = afterCap - supplementalHomesteadCredit;

  const referendumOperatingTax = (netAV * s.referendumOperatingRate) / 100;
  const referendumDebtTax = (netAV * s.referendumDebtRate) / 100;
  const referendumTax = referendumOperatingTax + referendumDebtTax;

  return {
    scenario: s.id,
    grossAV,
    standardDeduction,
    supplementalDeduction,
    netAV,
    nonReferendumRate: nonRefRate,
    nonReferendumGross,
    circuitBreakerCap,
    circuitBreakerCredit,
    supplementalHomesteadCredit,
    nonReferendumNet,
    referendumOperatingTax,
    referendumDebtTax,
    referendumTax,
    total: nonReferendumNet + referendumTax,
  };
}
