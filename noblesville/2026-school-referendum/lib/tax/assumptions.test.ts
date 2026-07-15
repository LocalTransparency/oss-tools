import { describe, it, expect } from 'vitest';
import {
  DISTRICTS, SCENARIOS, CURRENT_REFERENDUM_TOTAL,
  nonReferendumRate, findDistrict, HOMESTEAD_CREDIT, CIRCUIT_BREAKER_RATE,
} from './assumptions';

describe('assumptions integrity', () => {
  it('has five districts, each with a positive non-referendum rate', () => {
    expect(DISTRICTS).toHaveLength(5);
    for (const d of DISTRICTS) {
      expect(nonReferendumRate(d)).toBeGreaterThan(0);
    }
  });

  it('non-referendum rate = certified total minus 0.45', () => {
    const city = findDistrict('Noblesville City')!;
    expect(city.totalRate2026).toBeCloseTo(2.5549, 4);
    expect(nonReferendumRate(city)).toBeCloseTo(2.1049, 4);
    expect(CURRENT_REFERENDUM_TOTAL.value).toBeCloseTo(0.45, 4);
  });

  it('matches district name variants from GIS', () => {
    expect(findDistrict('11 - Noblesville City')?.name).toBe('Noblesville City');
    expect(findDistrict('NOBLESVILLE TOWNSHIP')?.name).toBe('Noblesville Township');
    expect(findDistrict('Noblesville Fall Creek')?.name).toBe('Noblesville–Fall Creek');
    expect(findDistrict('Noblesville Wayne')?.name).toBe('Noblesville–Wayne');
    expect(findDistrict('Noblesville Delaware')?.name).toBe('Noblesville–Delaware');
    expect(findDistrict('Carmel City')).toBeNull();
  });

  it('scenario parameters match the spec', () => {
    expect(SCENARIOS.current).toMatchObject({
      payYear: 2026, standardDeduction: 48000, supplementalRate: 0.40,
      referendumOperatingRate: 0.37, referendumDebtRate: 0.08,
    });
    expect(SCENARIOS.passCommitted).toMatchObject({
      payYear: 2027, standardDeduction: 40000, supplementalRate: 0.46,
      referendumOperatingRate: 0.41, referendumDebtRate: 0.08,
    });
    expect(SCENARIOS.passMax.referendumOperatingRate).toBe(0.57);
    expect(SCENARIOS.fail).toMatchObject({ referendumOperatingRate: 0, referendumDebtRate: 0.08 });
  });

  it('every sourced value cites an http source', () => {
    expect(CURRENT_REFERENDUM_TOTAL.source).toMatch(/^https?:\/\//);
    expect(HOMESTEAD_CREDIT.source).toMatch(/^https?:\/\//);
    expect(CIRCUIT_BREAKER_RATE.source).toMatch(/^https?:\/\//);
  });
});
