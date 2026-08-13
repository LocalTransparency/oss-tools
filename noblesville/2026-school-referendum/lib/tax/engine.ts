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

const VALID_CAP_CLASSES: readonly CapClass[] = [1, 2, 3];

/**
 * True only for an actual 1/2/3 cap class. `capClass: CapClass` is a
 * compile-time promise only — a value crossing the `/api/lookup` JSON
 * boundary (see EnrichedParcelCandidate in lib/lookup/arcgis.ts) can still
 * arrive as `undefined`, `null`, `0`, or anything else at runtime. Exported
 * so every place that treats a capClass as trustworthy — bucket math here,
 * and the cap-class disclosure shown to the visitor in Calculator.tsx — uses
 * the same definition of "valid" instead of two definitions drifting apart.
 */
export function isValidCapClass(value: unknown): value is CapClass {
  return (VALID_CAP_CLASSES as readonly unknown[]).includes(value);
}

/**
 * Route a single gross AV entirely to one cap class.
 *
 * `capClass: CapClass` is a compile-time promise only. Every real caller
 * gets this value from parsed JSON that crossed the `/api/lookup` boundary
 * (see EnrichedParcelCandidate in lib/lookup/arcgis.ts) — a missing or
 * malformed field still reaches this function at runtime as `undefined`,
 * `null`, `0`, or some other value the type does not rule out. Matching only
 * 1/2/3 and letting anything else fall through to `{cap1:0, cap2:0, cap3:0}`
 * (this function's prior behavior) silently prices a real parcel at $0 —
 * worse than crashing, since it renders a confident-looking wrong answer
 * with no signal anything failed. So an invalid class here does not zero the
 * parcel: it falls back to class 1 (homestead), the assumption this tool
 * used for its entire prior existence, which covers ~84% of Hamilton County
 * parcels and is visibly correctable via CapClassPanel's manual override.
 *
 * The fallback lives here, not at the call site, so every caller — present
 * and future — gets it automatically; there is no separate boundary check to
 * remember to add or to accidentally skip.
 */
export function bucketsOf(grossAV: number, capClass: CapClass): AvBuckets {
  const cls: CapClass = isValidCapClass(capClass) ? capClass : 1;
  return {
    cap1: cls === 1 ? grossAV : 0,
    cap2: cls === 2 ? grossAV : 0,
    cap3: cls === 3 ? grossAV : 0,
  };
}

export function totalGrossAV(b: AvBuckets): number {
  return b.cap1 + b.cap2 + b.cap3;
}

/**
 * Floors every bucket at zero. This is the real backstop against a negative
 * bucket — from a mistyped growth rate compounding an AV negative (see
 * projectReferendumLine), or a negative value reaching computeBill directly —
 * ever being treated as real. Without this, a negative cap1 round-trips
 * through the deduction math in computeNetAV into a CONFIDENT POSITIVE net AV
 * (standardDeduction = min(-175000, 48000) = -175000, afterStandard floors to
 * 0, supplemental = min(0, -175000 × 0.75) = -131250, and
 * max(0, 0 − (-131250)) manufactures 131,250 out of nothing), and a negative
 * bucket fed straight to computeBill's per-class circuit-breaker cap
 * (`grossByClass[c] * CIRCUIT_BREAKER_RATES.value[c]`) produces a negative
 * cap threshold that inflates the credit instead of shrinking it. Both
 * computeNetAV and computeBill apply this at their own entry point, so
 * neither can be bypassed by calling the other directly.
 */
export function floorBuckets(buckets: AvBuckets): AvBuckets {
  return {
    cap1: Math.max(0, buckets.cap1),
    cap2: Math.max(0, buckets.cap2),
    cap3: Math.max(0, buckets.cap3),
  };
}

/**
 * Loud invariant: a parcel with positive gross AV whose constructed buckets
 * sum to zero is a contradiction, not a legitimate $0 estimate, and must
 * never render as one. bucketsOf's fallback above should make this
 * unreachable through the normal capClass path — this assertion is a second
 * line of defense against any other way an inconsistent AvBuckets could
 * reach the UI (a future bypass of bucketsOf, a bug elsewhere in bucket
 * construction), so that failure is loud instead of a silently wrong number.
 */
export function assertBucketsConsistent(grossAV: number, buckets: AvBuckets): void {
  if (grossAV > 0 && totalGrossAV(buckets) === 0) {
    throw new Error(
      `Inconsistent AvBuckets: grossAV ${grossAV} is positive but the constructed buckets sum to zero. ` +
        'This would render as a $0 estimate and must not pass silently.',
    );
  }
}

/**
 * Net AV by cap class. Homestead standard + supplemental deductions apply to
 * cap-1 AV only; the SEA 1 Cap 2 deduction applies to cap-2 AV; cap-3 AV gets
 * nothing. Each bucket is floored at zero independently.
 */
export function computeNetAV(rawBuckets: AvBuckets, s: ScenarioParams) {
  // Floor first, before any deduction math — see floorBuckets' doc for why a
  // negative bucket must never reach the arithmetic below.
  const buckets = floorBuckets(rawBuckets);

  const standardDeduction = Math.min(buckets.cap1, s.standardDeduction);
  const afterStandard = Math.max(0, buckets.cap1 - standardDeduction);
  const supplementalDeduction = Math.min(
    afterStandard * s.supplementalRate,
    buckets.cap1 * SUPP_DEDUCTION_CAP_RATE.value,
  );
  const cap1Net = Math.max(0, afterStandard - supplementalDeduction);

  // A pay year missing from this table must throw, the same way
  // projectReferendumLine throws for a pay year missing from DEDUCTIONS —
  // silently defaulting to 0% (the prior behavior) skips the cap-2 deduction
  // entirely and OVERSTATES the tax with no signal anything is wrong.
  const cap2Rate = CAP2_AV_DEDUCTION.value[s.payYear];
  if (cap2Rate === undefined) {
    throw new Error(
      `Missing CAP2_AV_DEDUCTION entry for pay year ${s.payYear}; extend lib/tax/indiana/assumptions.ts before pricing it.`,
    );
  }
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
  rawBuckets: AvBuckets,
  district: TaxDistrict,
  s: ScenarioParams,
  config: DistrictReferendumConfig,
): BillBreakdown {
  // Floor at this entry point too (see floorBuckets' doc). computeNetAV
  // floors internally, but computeBill also builds grossByClass directly
  // from the buckets below for the per-class circuit-breaker cap — that read
  // has to see the same floored values, or a negative bucket handed straight
  // to computeBill (bypassing computeNetAV's own floor) still inflates the
  // credit (Finding 2).
  const buckets = floorBuckets(rawBuckets);
  const { standardDeduction, supplementalDeduction, cap2Deduction, netAV, byClass } =
    computeNetAV(buckets, s);

  const nonRefRate = nonReferendumRate(config, district);
  const nonReferendumGross = (netAV * nonRefRate) / 100;

  // Each class's cap is a percentage of that class's GROSS AV; a parcel's total
  // cap is the sum. Credits are computed per class so a mixed parcel cannot use
  // one class's headroom to shelter another class's liability.
  const classes: CapClass[] = [1, 2, 3];
  const grossByClass: Record<CapClass, number> = { 1: buckets.cap1, 2: buckets.cap2, 3: buckets.cap3 };

  let circuitBreakerCap = 0;
  let circuitBreakerCredit = 0;
  let cap1AfterCap = 0;
  for (const c of classes) {
    const cap = grossByClass[c] * CIRCUIT_BREAKER_RATES.value[c];
    const gross = (byClass[c] * nonRefRate) / 100;
    const credit = Math.max(0, gross - cap);
    circuitBreakerCap += cap;
    circuitBreakerCredit += credit;
    if (c === 1) cap1AfterCap = gross - credit;
  }
  const afterCap = nonReferendumGross - circuitBreakerCredit;

  // The supplemental homestead credit is a homestead benefit: it is computed
  // from post-cap cap-1 liability only, and referendum taxes are excluded.
  const supplementalHomesteadCredit = Math.min(
    cap1AfterCap * HOMESTEAD_CREDIT.value.rate,
    HOMESTEAD_CREDIT.value.max,
  );
  const nonReferendumNet = afterCap - supplementalHomesteadCredit;

  const referendumOperatingTax = (netAV * s.referendumOperatingRate) / 100;
  const referendumDebtTax = (netAV * s.referendumDebtRate) / 100;
  const referendumTax = referendumOperatingTax + referendumDebtTax;

  return {
    scenario: s.id,
    grossAV: totalGrossAV(buckets),
    standardDeduction,
    supplementalDeduction,
    cap2Deduction,
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
