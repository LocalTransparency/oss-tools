import type { DistrictReferendumConfig, TaxDistrict } from '../../types';
import { findDistrict } from '../../engine';
import { DISTRICTS } from './index';

/**
 * Resolve an ArcGIS TAXDISTNAM to the district config that owns it and the
 * specific tax-district rate row within that config. Returns null when no
 * registered district covers the name (an uncovered parcel).
 */
export function resolveTaxDistrict(
  taxDistrictName: string,
): { config: DistrictReferendumConfig; district: TaxDistrict } | null {
  for (const config of Object.values(DISTRICTS)) {
    const district = findDistrict(config, taxDistrictName);
    if (district) return { config, district };
  }
  return null;
}
