import { NOBLESVILLE } from './noblesville';
import { HAMILTON_SOUTHEASTERN } from './hamilton-southeastern';
import { CARMEL_CLAY } from './carmel-clay';
import { WESTFIELD_WASHINGTON } from './westfield-washington';
import { SHERIDAN } from './sheridan';

export const DISTRICTS = {
  noblesville: NOBLESVILLE,
  'hamilton-southeastern': HAMILTON_SOUTHEASTERN,
  'carmel-clay': CARMEL_CLAY,
  'westfield-washington': WESTFIELD_WASHINGTON,
  sheridan: SHERIDAN,
} as const;

export type DistrictId = keyof typeof DISTRICTS;
