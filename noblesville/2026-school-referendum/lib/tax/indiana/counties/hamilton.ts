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
    { name: 'Noblesville Schools', gisGate: /noblesville/i, configId: 'noblesville' },
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
