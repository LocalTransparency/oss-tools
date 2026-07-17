import type { ParcelCandidate } from './arcgis';

/**
 * A per-county parcel lookup source. Each county's GIS has its own endpoint,
 * field names, and query conventions; an adapter hides those behind a uniform
 * search(). Adding a county = one adapter + one registry entry.
 */
export interface CountyLookupSource {
  county: string;
  search(term: string): Promise<ParcelCandidate[]>;
}
