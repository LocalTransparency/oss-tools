import { NOBLESVILLE } from './noblesville';

export const DISTRICTS = { noblesville: NOBLESVILLE } as const;

export type DistrictId = keyof typeof DISTRICTS;
