import type { CountyLookupSource } from '../types';
import { searchParcels } from '../arcgis';

/** Hamilton County, Indiana — backed by the county's public parcel FeatureServer. */
export const hamilton: CountyLookupSource = {
  county: 'Hamilton',
  search: (term) => searchParcels(term),
};
