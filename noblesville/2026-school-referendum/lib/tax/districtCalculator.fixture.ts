/**
 * Verbatim transcription of the constants and arithmetic in Noblesville
 * Schools' published referendum calculator, for cross-checking this tool's
 * projection against the district's own model.
 *
 * Source: https://noblesvilleschoolsorg.finalsite.com/uploaded/NoblesvilleSchools_ReferendumCalculator.html
 * Retrieved: 2026-08-12
 *
 * TEST-ONLY. Never import from application code — the district's calculator is
 * a cross-check, not a source of truth for statewide law.
 *
 * To refresh: re-download the file, re-read its `<script>` config block, and
 * update both the constants and the retrieval date above.
 */
export const DISTRICT_AV_GROWTH: Record<number, number> = {
  2027: 0.053, 2028: 0.035, 2029: 0.035, 2030: 0.035,
  2031: 0.035, 2032: 0.035, 2033: 0.035, 2034: 0.035,
};

export const DISTRICT_RATES: Record<number, number> = {
  2026: 0.37, 2027: 0.385, 2028: 0.425, 2029: 0.465,
  2030: 0.505, 2031: 0.545, 2032: 0.545, 2033: 0.545, 2034: 0.545,
};

export const DISTRICT_YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034];
export const DISTRICT_HD = [48000, 40000, 30000, 20000, 10000, 0, 0, 0, 0];
export const DISTRICT_SH_PCT = [0.4, 0.46, 0.52, 0.57, 0.62, 0.667, 0.667, 0.667, 0.667];
export const DISTRICT_CAP2_PCT = [0.06, 0.12, 0.19, 0.25, 0.3, 0.334, 0.334, 0.334, 0.334];

/** The district's `calculate()`, reduced to the annual referendum levy per year. */
export function districtCalculatorAnnual(av1Base: number, av2Base = 0, av3Base = 0): Record<number, number> {
  const growthFactors = [1];
  let cumFactor = 1;
  for (let i = 1; i < DISTRICT_YEARS.length; i++) {
    cumFactor *= 1 + (DISTRICT_AV_GROWTH[DISTRICT_YEARS[i]] || 0);
    growthFactors.push(cumFactor);
  }

  const out: Record<number, number> = {};
  for (let i = 0; i < DISTRICT_YEARS.length; i++) {
    const f = growthFactors[i];
    const av1 = av1Base * f, av2 = av2Base * f, av3 = av3Base * f;
    const hdVal = -Math.min(av1, DISTRICT_HD[i]);
    const shVal = -(av1 + hdVal) * DISTRICT_SH_PCT[i];
    const cap2Val = -av2 * DISTRICT_CAP2_PCT[i];
    const navVal = av1 + av2 + av3 + hdVal + shVal + cap2Val;
    out[DISTRICT_YEARS[i]] = (navVal * DISTRICT_RATES[DISTRICT_YEARS[i]]) / 100;
  }
  return out;
}
