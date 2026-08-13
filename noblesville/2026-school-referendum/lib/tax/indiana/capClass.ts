import type { CapClass } from '../types';

export interface CapClassInference {
  capClass: CapClass;
  confidence: 'high' | 'low';
  reason: string;
}

/**
 * Infers a parcel's DOMINANT constitutional cap class (IC 6-1.1-20.6) from
 * Hamilton County's public parcel attributes.
 *
 * This is a dominant-class inference, not an allocation, and that distinction
 * is the whole point. Indiana splits a single parcel across classes — e.g. a
 * homestead on more than one acre is capped at 1% on the dwelling plus one
 * acre, and 2% on the remaining land — and Hamilton County's open parcel data
 * publishes no such allocation. Treat this function's output as a starting
 * estimate only; it must never be presented as authoritative, and callers
 * must offer a manual override.
 *
 * Class definitions and cap rates follow the state's own DLGF Referendum
 * Impact Calculator, whose property-type dropdown encodes the three classes
 * with the cap rate as each option's value:
 *   https://gateway.ifionline.org/CalculatorsDLGF/RefCalculator.aspx
 *     1% — "Homestead (Owner-occupied residence)"
 *     2% — "Residential Rental, Non-Homestead Residential, and Agricultural"
 *     3% — "Other"
 *
 * The PROPCLASS prefix mapping below (1xx agricultural, 2xx industrial, 3xx
 * commercial, 4xx commercial/utility, 5xx residential, 6xx+ other) follows
 * Indiana's Property Tax Management System Code List Manual, published under
 * 50 IAC 26:
 *   https://www.in.gov/dlgf/files/2026-memos/Property-Tax-Management-System-Code-List-Manual-260514.pdf
 * Only the 1xx (agricultural) and 5xx (residential) prefixes can ever fall
 * under the state's 2% class; every other prefix is "Other" (3%).
 */

/**
 * The pay year this tool's projection treats as its ungrown base.
 *
 * Deliberately NOT a `Sourced<number>` like the numeric assumptions in
 * assumptions.ts: those are externally-sourced legal facts (a deduction
 * schedule, a cap rate) with a citable URL. This is an internal tool
 * convention with no such source — it just has to move in lockstep with two
 * other places that hardcode the same "2026 is the base year" assumption:
 * DEDUCTIONS[2026] in lib/tax/indiana/assumptions.ts, and the 'current'
 * scenario's `payYear: 2026` in lib/tax/scenarios.ts. A year rollover must
 * update all three together.
 */
const BASE_ASSESSMENT_YEAR = 2026;

/** State DLGF calculator wording for each cap class — quoted verbatim below, not paraphrased. */
export const CLASS_LABEL: Record<CapClass, string> = {
  1: 'Homestead (Owner-occupied residence)',
  2: 'Residential Rental, Non-Homestead Residential, and Agricultural',
  3: 'Other',
};

export function inferCapClass(attrs: {
  homesteadCode: number | null;
  propertyClass: string;
  assessmentYear: number;
}): CapClassInference {
  const { homesteadCode, propertyClass, assessmentYear } = attrs;
  const leading = propertyClass.trim().charAt(0);
  const isResidentialOrAg = leading === '5' || leading === '1';

  const staleYear = assessmentYear !== BASE_ASSESSMENT_YEAR;
  const yearNote = staleYear
    ? ` Assessed value is for ${assessmentYear || 'an unknown year'}, not the ${BASE_ASSESSMENT_YEAR} base this projection assumes.`
    : '';

  if (homesteadCode === 1) {
    return {
      capClass: 1,
      confidence: staleYear ? 'low' : 'high',
      reason: `An active homestead deduction places this parcel in the state's "${CLASS_LABEL[1]}" class (1% cap).${yearNote}`,
    };
  }

  // hmstd_code = -1 appears on a large number of Noblesville-district parcels
  // in Hamilton County's open data (observed 2026-08-12) and its meaning is
  // unconfirmed with the county. It gets its own named branch — never a
  // silent fall-through into 0/non-homestead — and always lowers confidence.
  if (homesteadCode === null || homesteadCode === -1) {
    const fallbackClass: CapClass = isResidentialOrAg ? 2 : 3;
    const codeDescription = homesteadCode === null ? 'missing' : 'unconfirmed (-1)';
    return {
      capClass: fallbackClass,
      confidence: 'low',
      reason:
        `The county's homestead code for this parcel is ${codeDescription}, so it is treated as ` +
        `non-homestead — state class "${CLASS_LABEL[fallbackClass]}". Confirm your own homestead status.${yearNote}`,
    };
  }

  if (!leading) {
    return {
      capClass: 3,
      confidence: 'low',
      reason: `No property class is published for this parcel, so it defaults to the state's "${CLASS_LABEL[3]}" class (3% cap).${yearNote}`,
    };
  }

  const inferredClass: CapClass = isResidentialOrAg ? 2 : 3;
  return {
    capClass: inferredClass,
    confidence: staleYear ? 'low' : 'high',
    reason: `Property class ${propertyClass} without an active homestead deduction falls under the state's "${CLASS_LABEL[inferredClass]}" class.${yearNote}`,
  };
}
