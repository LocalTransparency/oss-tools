import { describe, it, expect } from 'vitest';
import { resolveTaxDistrict } from './resolve';

describe('resolveTaxDistrict', () => {
  it('resolves a Noblesville taxing-district name to its config and rate row', () => {
    const r = resolveTaxDistrict('11 - Noblesville City');
    expect(r).not.toBeNull();
    expect(r!.config.id).toBe('noblesville');
    expect(r!.district.name).toBe('Noblesville City');
  });

  it('resolves GIS name variants (whitespace, casing)', () => {
    expect(resolveTaxDistrict('NOBLESVILLE TOWNSHIP')!.district.name).toBe('Noblesville Township');
    expect(resolveTaxDistrict('Noblesville Fall Creek')!.district.name).toBe('Noblesville–Fall Creek');
  });

  it('returns null for a district with no config (uncovered)', () => {
    expect(resolveTaxDistrict('Clay Township')).toBeNull();
    expect(resolveTaxDistrict('Carmel City')).toBeNull();
  });
});
