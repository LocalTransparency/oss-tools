import type { BillBreakdown, TaxDistrict } from './types';
import { SCENARIOS } from './assumptions';
import { computeBill } from './engine';

export interface ScenarioResults {
  current: BillBreakdown;
  passCommitted: BillBreakdown;
  passMax: BillBreakdown;
  fail: BillBreakdown;
}

export function computeAllScenarios(grossAV: number, district: TaxDistrict): ScenarioResults {
  return {
    current: computeBill(grossAV, district, SCENARIOS.current),
    passCommitted: computeBill(grossAV, district, SCENARIOS.passCommitted),
    passMax: computeBill(grossAV, district, SCENARIOS.passMax),
    fail: computeBill(grossAV, district, SCENARIOS.fail),
  };
}
