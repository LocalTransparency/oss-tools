import type { BillBreakdown, DistrictReferendumConfig, ScenarioId, ScenarioParams, TaxDistrict } from './types';
import { DEDUCTIONS } from './indiana/assumptions';
import { computeBill } from './engine';

export interface ScenarioResults {
  current: BillBreakdown;
  passCommitted: BillBreakdown;
  passMax: BillBreakdown;
  fail: BillBreakdown;
}

/** Derive the four scenarios from statewide deductions + a district config (absent rates → 0; absent committed2027 → proposedMax). */
export function buildScenarios(config: DistrictReferendumConfig): Record<ScenarioId, ScenarioParams> {
  const currentOperatingRate = config.referendum.currentOperating?.value ?? 0;
  const debtRate = config.referendum.debt?.value ?? 0;
  const proposedMaxRate = config.referendum.proposedMax.value;
  const committedRate = config.referendum.committed2027?.value ?? proposedMaxRate;

  return {
    current: {
      id: 'current', label: 'Current (pay-2026)', payYear: 2026,
      standardDeduction: DEDUCTIONS[2026].value.standard,
      supplementalRate: DEDUCTIONS[2026].value.supplementalRate,
      referendumOperatingRate: currentOperatingRate,
      referendumDebtRate: debtRate,
    },
    passCommitted: {
      id: 'passCommitted',
      label: `If it passes — committed 2027 rate ($${committedRate.toFixed(2)})`,
      payYear: 2027,
      standardDeduction: DEDUCTIONS[2027].value.standard,
      supplementalRate: DEDUCTIONS[2027].value.supplementalRate,
      referendumOperatingRate: committedRate,
      referendumDebtRate: debtRate,
    },
    passMax: {
      id: 'passMax',
      label: `If it passes — authorized maximum ($${proposedMaxRate.toFixed(2)})`,
      payYear: 2027,
      standardDeduction: DEDUCTIONS[2027].value.standard,
      supplementalRate: DEDUCTIONS[2027].value.supplementalRate,
      referendumOperatingRate: proposedMaxRate,
      referendumDebtRate: debtRate,
    },
    fail: {
      id: 'fail', label: 'If it fails (pay-2027)', payYear: 2027,
      standardDeduction: DEDUCTIONS[2027].value.standard,
      supplementalRate: DEDUCTIONS[2027].value.supplementalRate,
      referendumOperatingRate: 0,
      referendumDebtRate: debtRate,
    },
  };
}

export function computeAllScenarios(
  grossAV: number,
  district: TaxDistrict,
  config: DistrictReferendumConfig,
): ScenarioResults {
  const scenarios = buildScenarios(config);
  return {
    current: computeBill(grossAV, district, scenarios.current, config),
    passCommitted: computeBill(grossAV, district, scenarios.passCommitted, config),
    passMax: computeBill(grossAV, district, scenarios.passMax, config),
    fail: computeBill(grossAV, district, scenarios.fail, config),
  };
}
