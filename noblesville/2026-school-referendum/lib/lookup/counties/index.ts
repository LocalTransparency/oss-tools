import { hamilton } from './hamilton';

/** Registry of county lookup sources. Add a county by adding one entry here. */
export const COUNTY_SOURCES = { hamilton } as const;

export type CountyId = keyof typeof COUNTY_SOURCES;
