import type { ScenarioParams } from './types';
import { SUPP_DEDUCTION_CAP_RATE } from './assumptions';

export function computeNetAV(grossAV: number, s: ScenarioParams) {
  const afterStandard = Math.max(0, grossAV - s.standardDeduction);
  const supplementalDeduction = Math.min(
    afterStandard * s.supplementalRate,
    grossAV * SUPP_DEDUCTION_CAP_RATE.value,
  );
  const netAV = Math.max(0, afterStandard - supplementalDeduction);
  return { standardDeduction: s.standardDeduction, supplementalDeduction, netAV };
}
