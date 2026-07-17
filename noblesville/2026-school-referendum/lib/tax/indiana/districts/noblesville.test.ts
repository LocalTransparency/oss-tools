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

  it('matches district name variants from GIS', () => {
    expect(findDistrict(NOBLESVILLE, '11 - Noblesville City')?.name).toBe('Noblesville City');
    expect(findDistrict(NOBLESVILLE, 'NOBLESVILLE TOWNSHIP')?.name).toBe('Noblesville Township');
    expect(findDistrict(NOBLESVILLE, 'Noblesville Fall Creek')?.name).toBe('Noblesville–Fall Creek');
    expect(findDistrict(NOBLESVILLE, 'Noblesville Wayne')?.name).toBe('Noblesville–Wayne');
    expect(findDistrict(NOBLESVILLE, 'Noblesville Delaware')?.name).toBe('Noblesville–Delaware');
    expect(findDistrict(NOBLESVILLE, 'Carmel City')).toBeNull();
  });

  it('every sourced referendum value cites an http source', () => {
    expect(NOBLESVILLE.referendum.currentOperating!.source).toMatch(/^https?:\/\//);
    expect(NOBLESVILLE.referendum.debt!.source).toMatch(/^https?:\/\//);
    expect(NOBLESVILLE.referendum.proposedMax.source).toMatch(/^https?:\/\//);
    expect(NOBLESVILLE.referendum.committed2027!.source).toMatch(/^https?:\/\//);
  });
});
