import type { BillBreakdown, ScenarioParams, TaxDistrict } from './types';
import {
  CIRCUIT_BREAKER_RATE,
  HOMESTEAD_CREDIT,
  SUPP_DEDUCTION_CAP_RATE,
  nonReferendumRate,
} from './assumptions';

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
): BillBreakdown {
  const { standardDeduction, supplementalDeduction, netAV } = computeNetAV(grossAV, s);

  const nonRefRate = nonReferendumRate(district);
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
