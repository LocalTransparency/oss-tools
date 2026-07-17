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

  it('resolves the other Hamilton districts to their configs (real GIS names)', () => {
    expect(resolveTaxDistrict('Fishers')!.config.id).toBe('hamilton-southeastern');
    expect(resolveTaxDistrict('Carmel')!.config.id).toBe('carmel-clay');
    expect(resolveTaxDistrict('Westfield')!.config.id).toBe('westfield-washington');
    expect(resolveTaxDistrict('Sheridan')!.config.id).toBe('sheridan');
  });

  it('resolves the HSE side of split townships (not Noblesville)', () => {
    expect(resolveTaxDistrict('Delaware')!.config.id).toBe('hamilton-southeastern');
    expect(resolveTaxDistrict('Fall Creek')!.config.id).toBe('hamilton-southeastern');
    // ...while the Noblesville-schools portions still resolve to Noblesville
    expect(resolveTaxDistrict('Noblesville SE')!.config.id).toBe('noblesville');
    expect(resolveTaxDistrict('Noblesville FC')!.config.id).toBe('noblesville');
  });

  it('returns null for uncovered districts', () => {
    expect(resolveTaxDistrict('Arcadia')).toBeNull();      // Hamilton Heights — no referendum
    expect(resolveTaxDistrict('White River')).toBeNull();  // intentionally omitted (unresolved)
  });
});
