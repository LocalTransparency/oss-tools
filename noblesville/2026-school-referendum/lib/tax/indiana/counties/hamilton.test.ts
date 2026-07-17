import { describe, it, expect } from 'vitest';
import { HAMILTON, nameUncoveredDistrict } from './hamilton';
import { DISTRICTS } from '../districts';

describe('Hamilton county roster', () => {
  it('names the county', () => {
    expect(HAMILTON.name).toBe('Hamilton');
  });

  it('every roster configId points to a registered district config', () => {
    for (const d of HAMILTON.schoolDistricts) {
      if (d.configId) expect(DISTRICTS[d.configId]).toBeDefined();
    }
  });

  it('names a verified district from its TAXDISTNAM', () => {
    expect(nameUncoveredDistrict('11 - Noblesville City')).toBe('Noblesville Schools');
  });

  it('returns null for an unverified/unknown district (generic fallback)', () => {
    expect(nameUncoveredDistrict('Clay Township')).toBeNull();
    expect(nameUncoveredDistrict('Carmel City')).toBeNull();
  });
});
