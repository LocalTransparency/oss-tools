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

  it('names verified districts from their TAXDISTNAM', () => {
    expect(nameUncoveredDistrict('Noblesville City')).toBe('Noblesville Schools');
    expect(nameUncoveredDistrict('Fishers')).toBe('Hamilton Southeastern Schools');
    expect(nameUncoveredDistrict('Carmel')).toBe('Carmel Clay Schools');
    // Hamilton Heights is uncovered (no referendum) but still named:
    expect(nameUncoveredDistrict('Arcadia')).toBe('Hamilton Heights School Corporation');
  });

  it('returns null for a truly unknown/unresolved district (generic fallback)', () => {
    expect(nameUncoveredDistrict('White River')).toBeNull(); // intentionally omitted (unresolved)
    expect(nameUncoveredDistrict('Somewhere Else')).toBeNull();
  });
});
