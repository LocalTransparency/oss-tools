import { describe, it, expect } from 'vitest';
import { findDistrict, nonReferendumRate, currentReferendumTotal } from '../../engine';
import { NOBLESVILLE } from './noblesville';

describe('Noblesville district data integrity', () => {
  it('has five tax districts, each with a positive non-referendum rate', () => {
    expect(NOBLESVILLE.taxDistricts).toHaveLength(5);
    for (const d of NOBLESVILLE.taxDistricts) {
      expect(nonReferendumRate(NOBLESVILLE, d)).toBeGreaterThan(0);
    }
  });

  it('non-referendum rate = certified total minus 0.45', () => {
    const city = findDistrict(NOBLESVILLE, 'Noblesville City')!;
    expect(city.totalRate2026).toBeCloseTo(2.5549, 4);
    expect(nonReferendumRate(NOBLESVILLE, city)).toBeCloseTo(2.1049, 4);
    expect(currentReferendumTotal(NOBLESVILLE)).toBeCloseTo(0.45, 4);
  });

  // Inputs are the REAL ArcGIS TAXDISTNAM strings (verified against the live parcel
  // service), not fabricated labels — this is what a real address lookup returns.
  it('matches the real GIS TAXDISTNAM for every Noblesville taxing district', () => {
    expect(findDistrict(NOBLESVILLE, 'Noblesville City')?.name).toBe('Noblesville City');
    expect(findDistrict(NOBLESVILLE, 'Noblesville Twp')?.name).toBe('Noblesville Township');
    expect(findDistrict(NOBLESVILLE, 'Noblesville FC')?.name).toBe('Noblesville–Fall Creek');
    expect(findDistrict(NOBLESVILLE, 'Nob Wayne')?.name).toBe('Noblesville–Wayne');
    expect(findDistrict(NOBLESVILLE, 'Noblesville SE')?.name).toBe('Noblesville–Delaware');
  });

  it('does not match non-Noblesville districts (incl. the HSE side of split townships)', () => {
    expect(findDistrict(NOBLESVILLE, 'Carmel City')).toBeNull();
    expect(findDistrict(NOBLESVILLE, 'Fishers')).toBeNull();
    expect(findDistrict(NOBLESVILLE, 'Delaware')).toBeNull(); // bare "Delaware" is the HSE portion
    expect(findDistrict(NOBLESVILLE, 'Fall Creek')).toBeNull(); // bare "Fall Creek" is the HSE portion
  });

  it('every sourced referendum value cites an http source', () => {
    expect(NOBLESVILLE.referendum.currentOperating!.source).toMatch(/^https?:\/\//);
    expect(NOBLESVILLE.referendum.debt!.source).toMatch(/^https?:\/\//);
    expect(NOBLESVILLE.referendum.proposedMax.source).toMatch(/^https?:\/\//);
    expect(NOBLESVILLE.referendum.committed2027!.source).toMatch(/^https?:\/\//);
  });
});
