import type { BillBreakdown, DistrictReferendumConfig, ScenarioParams, TaxDistrict } from './types';
import { CIRCUIT_BREAKER_RATE, HOMESTEAD_CREDIT, SUPP_DEDUCTION_CAP_RATE } from './indiana/assumptions';

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

export function computeNetAV(grossAV: number, s: ScenarioParams) {
  const afterStandard = Math.max(0, grossAV - s.standardDeduction);
  const supplementalDeduction = Math.min(
    afterStandard * s.supplementalRate,
    grossAV * SUPP_DEDUCTION_CAP_RATE.value,
  );
  const netAV = Math.max(0, afterStandard - supplementalDeduction);
  return { standardDeduction: s.standardDeduction, supplementalDeduction, netAV };
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
