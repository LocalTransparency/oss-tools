import type { DistrictId } from '../districts';

export interface CountySchoolDistrict {
  name: string;          // public-facing school corporation name
  gisGate: RegExp;       // matched against ArcGIS TAXDISTNAM
  configId?: DistrictId; // present when full referendum data exists
}

/**
 * Hamilton County's school districts. Entries are added only once their
 * TAXDISTNAM → school-corporation mapping is verified against county parcel
 * data — a wrong name is worse than a generic "not covered" message, so
 * unverified districts are intentionally omitted (they fall through to the
 * generic message via nameUncoveredDistrict returning null).
 */
export const HAMILTON = {
  name: 'Hamilton',
  schoolDistricts: [
    // Covered — full referendum data (gisGate mirrors the config's, for parity).
    { name: 'Noblesville Schools', gisGate: /noblesville|nob\s+wayne/i, configId: 'noblesville' },
    { name: 'Hamilton Southeastern Schools', gisGate: /fishers|^delaware$|^fall\s*creek$/i, configId: 'hamilton-southeastern' },
    { name: 'Carmel Clay Schools', gisGate: /carmel/i, configId: 'carmel-clay' },
    { name: 'Westfield Washington Schools', gisGate: /westfield/i, configId: 'westfield-washington' },
    { name: 'Sheridan Community Schools', gisGate: /sheridan/i, configId: 'sheridan' },
    // Uncovered — no 2026 referendum, but named so its residents get a specific
    // (not generic) "not covered" message. Its northern-Hamilton towns are
    // unambiguous; no configId because there's no referendum to model.
    { name: 'Hamilton Heights School Corporation', gisGate: /arcadia|cicero|atlanta|jackson/i },
  ] as CountySchoolDistrict[],
};

/**
 * Friendly name for the school district a TAXDISTNAM belongs to, or null when
 * it isn't a verified Hamilton County district (caller shows a generic message).
 */
export function nameUncoveredDistrict(taxDistrictName: string): string | null {
  const match = HAMILTON.schoolDistricts.find((d) => d.gisGate.test(taxDistrictName));
  return match ? match.name : null;
}
