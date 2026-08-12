import type { AvBuckets, DistrictReferendumConfig } from './types';
import { DEDUCTIONS } from './indiana/assumptions';
import { computeNetAV } from './engine';

export interface ProjectionRow {
  year: number;
  growthFactor: number;
  grossAV: number;
  netAV: number;
  operatingRate: number;
  operatingTax: number;
  debtRate: number;
  debtTax: number;
  annual: number;
  monthly: number;
}

export interface ProjectionStats {
  /** Second year's operating-only monthly amount minus the base year's. */
  firstYearChange: number;
  /** Mean, across every projected year, of that year's operating-only excess over the base year. */
  averageIncreaseVsBase: number;
  /** Final year's operating-only monthly amount minus the base year's. */
  finalYearIncrease: number;
  /** Mean of the successive year-over-year differences in the operating-only monthly amount. */
  averageYearOverYearStep: number;
}

/**
 * Year-by-year referendum line (operating + debt) across a district's published
 * schedule. Scope deliberately matches the district's own calculator so the two
 * are directly comparable: non-referendum rates and the circuit breaker are NOT
 * projected, because this tool's non-referendum rate is derived from the
 * certified pay-2026 total and holding it flat for eight years would let the
 * weakest input dominate every total.
 *
 * The entered AV is treated as the base-year (2026) gross AV, matching the
 * county parcel layer's AVTAXYR.
 */
export function projectReferendumLine(
  buckets: AvBuckets,
  config: DistrictReferendumConfig,
  opts: { avGrowth?: Record<number, number> } = {},
): ProjectionRow[] {
  const projection = config.referendum.projection;
  if (!projection) return [];

  const growth = opts.avGrowth ?? projection.avGrowth.value;
  const years = Object.keys(projection.operatingRates.value).map(Number).sort((a, b) => a - b);
  const debtRate = config.referendum.debt?.value ?? 0;
  const debtEndYear = config.referendum.debtEndYear?.value ?? Infinity;

  let growthFactor = 1;
  return years.map((year, i) => {
    if (i > 0) growthFactor *= 1 + (growth[year] ?? 0);

    const grown: AvBuckets = {
      cap1: buckets.cap1 * growthFactor,
      cap2: buckets.cap2 * growthFactor,
      cap3: buckets.cap3 * growthFactor,
    };
    const deductions = DEDUCTIONS[year];
    const { netAV } = computeNetAV(grown, {
      id: 'passCommitted',
      label: '',
      payYear: year,
      standardDeduction: deductions.value.standard,
      supplementalRate: deductions.value.supplementalRate,
      referendumOperatingRate: 0,
      referendumDebtRate: 0,
    });

    const operatingRate = projection.operatingRates.value[year];
    const yearDebtRate = year <= debtEndYear ? debtRate : 0;
    const operatingTax = (netAV * operatingRate) / 100;
    const debtTax = (netAV * yearDebtRate) / 100;
    const annual = operatingTax + debtTax;

    return {
      year,
      growthFactor,
      grossAV: grown.cap1 + grown.cap2 + grown.cap3,
      netAV,
      operatingRate,
      operatingTax,
      debtRate: yearDebtRate,
      debtTax,
      annual,
      monthly: annual / 12,
    };
  });
}

/**
 * Four distinct statistics over the same series. They answer different
 * questions and routinely differ by a large factor; each is defined here once
 * so the UI and the methodology page cannot drift from the arithmetic.
 *
 * Each row's own `annual`/`monthly` fields total the full referendum line
 * (operating + debt), since debt is genuinely on the bill each of those years.
 * These four statistics, however, measure the effect of the 2026 vote itself,
 * so they track the operating-rate trajectory only: referendum debt is levied
 * through debtEndYear regardless of this vote's outcome, so including it here
 * would mix an unrelated, unconditional charge into a measurement of the
 * question being decided.
 */
export function projectionStats(rows: ProjectionRow[]): ProjectionStats {
  if (rows.length < 2) {
    return { firstYearChange: 0, averageIncreaseVsBase: 0, finalYearIncrease: 0, averageYearOverYearStep: 0 };
  }
  const operatingMonthly = (r: ProjectionRow) => r.operatingTax / 12;

  const base = rows[0];
  const future = rows.slice(1);
  const final = rows[rows.length - 1];

  const steps = rows.slice(1).map((r, i) => operatingMonthly(r) - operatingMonthly(rows[i]));

  return {
    firstYearChange: operatingMonthly(future[0]) - operatingMonthly(base),
    averageIncreaseVsBase:
      future.reduce((s, r) => s + (operatingMonthly(r) - operatingMonthly(base)), 0) / future.length,
    finalYearIncrease: operatingMonthly(final) - operatingMonthly(base),
    averageYearOverYearStep: steps.reduce((s, d) => s + d, 0) / steps.length,
  };
}
