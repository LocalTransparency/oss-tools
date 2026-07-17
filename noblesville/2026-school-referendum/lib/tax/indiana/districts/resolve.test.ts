import { describe, it, expect } from 'vitest';
import { resolveTaxDistrict } from './resolve';

describe('resolveTaxDistrict', () => {
  it('resolves a Noblesville taxing-district name to its config and rate row', () => {
    const r = resolveTaxDistrict('Noblesville City');
    expect(r).not.toBeNull();
    expect(r!.config.id).toBe('noblesville');
    expect(r!.district.name).toBe('Noblesville City');
  });

  // Real ArcGIS TAXDISTNAM values (the abbreviated forms the parcel service returns).
  it('resolves the abbreviated GIS names', () => {
    expect(resolveTaxDistrict('Noblesville Twp')!.district.name).toBe('Noblesville Township');
    expect(resolveTaxDistrict('Noblesville FC')!.district.name).toBe('Noblesville–Fall Creek');
    expect(resolveTaxDistrict('Nob Wayne')!.district.name).toBe('Noblesville–Wayne');
    expect(resolveTaxDistrict('Noblesville SE')!.district.name).toBe('Noblesville–Delaware');
  });

  it('returns null for a district with no config (uncovered)', () => {
    expect(resolveTaxDistrict('Clay Township')).toBeNull();
    expect(resolveTaxDistrict('Carmel City')).toBeNull();
  });
});
