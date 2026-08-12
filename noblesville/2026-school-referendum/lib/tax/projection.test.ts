import { describe, it, expect } from 'vitest';
import { projectReferendumLine, projectionStats } from './projection';
import { bucketsOf } from './engine';
import { NOBLESVILLE } from './indiana/districts/noblesville';
import { SHERIDAN } from './indiana/districts/sheridan';

const rows = projectReferendumLine(bucketsOf(350000, 1), NOBLESVILLE);
const byYear = (y: number) => rows.find((r) => r.year === y)!;

describe('projectReferendumLine', () => {
  it('covers 2026 through 2034 with 2026 as the ungrown base', () => {
    expect(rows.map((r) => r.year)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034]);
    expect(byYear(2026).growthFactor).toBe(1);
    expect(byYear(2026).grossAV).toBeCloseTo(350000, 6);
  });

  it('compounds the district\'s AV growth assumption', () => {
    expect(byYear(2027).growthFactor).toBeCloseTo(1.053, 6);
    expect(byYear(2028).growthFactor).toBeCloseTo(1.053 * 1.035, 6);
  });

  it('reproduces the operating line for a $350k homestead', () => {
    expect(byYear(2026).operatingTax).toBeCloseTo(670.44, 2);
    expect(byYear(2027).operatingTax).toBeCloseTo(683.06, 2);
    expect(byYear(2034).operatingTax).toBeCloseTo(850.98, 2);
  });

  it('carries the referendum debt rate only through its final levy year', () => {
    expect(byYear(2032).debtRate).toBeCloseTo(0.08, 6);
    expect(byYear(2033).debtRate).toBe(0);
    expect(byYear(2034).debtTax).toBe(0);
  });

  it('accepts an overridden growth assumption', () => {
    const flat = projectReferendumLine(bucketsOf(350000, 1), NOBLESVILLE, {
      avGrowth: { 2027: 0, 2028: 0, 2029: 0, 2030: 0, 2031: 0, 2032: 0, 2033: 0, 2034: 0 },
    });
    expect(flat.find((r) => r.year === 2034)!.growthFactor).toBe(1);
    expect(flat.find((r) => r.year === 2034)!.grossAV).toBeCloseTo(350000, 6);
  });

  it('returns an empty array for a district with no published schedule', () => {
    expect(SHERIDAN.referendum.projection).toBeUndefined();
    expect(projectReferendumLine(bucketsOf(350000, 1), SHERIDAN)).toEqual([]);
  });
});

describe('projectionStats — each statistic has one exact definition', () => {
  const s = projectionStats(rows);

  it('firstYearChange is 2027 monthly minus 2026 monthly', () => {
    expect(s.firstYearChange).toBeCloseTo(1.05, 2);
  });

  it('averageIncreaseVsBase is the mean of each year\'s excess over 2026', () => {
    expect(s.averageIncreaseVsBase).toBeCloseTo(8.19, 2);
  });

  it('finalYearIncrease is 2034 monthly minus 2026 monthly', () => {
    expect(s.finalYearIncrease).toBeCloseTo(15.05, 2);
  });

  it('averageYearOverYearStep is the mean of the eight successive differences', () => {
    expect(s.averageYearOverYearStep).toBeCloseTo(1.88, 2);
  });

  it('the year-over-year mean equals (final − base) / 8 by construction', () => {
    expect(s.averageYearOverYearStep).toBeCloseTo(s.finalYearIncrease / 8, 6);
  });

  it('the two averages are different statistics over the same series', () => {
    expect(s.averageIncreaseVsBase).not.toBeCloseTo(s.averageYearOverYearStep, 1);
  });
});
