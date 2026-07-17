import { describe, it, expect } from 'vitest';
import { DISTRICTS } from './index';
import { resolveTaxDistrict } from './resolve';
import { nonReferendumRate } from '../../engine';
import { buildScenarios, computeAllScenarios } from '../../scenarios';

const ALL = Object.entries(DISTRICTS);

describe('all Hamilton district configs — data integrity', () => {
  it('each config id matches its registry key', () => {
    for (const [key, config] of ALL) expect(config.id).toBe(key);
  });

  it('each config has at least one tax district, all with a positive non-referendum rate', () => {
    for (const [, config] of ALL) {
      expect(config.taxDistricts.length).toBeGreaterThan(0);
      for (const d of config.taxDistricts) {
        expect(nonReferendumRate(config, d)).toBeGreaterThan(0);
      }
    }
  });

  it('proposedMax and every present optional referendum rate cites an http(s) source', () => {
    for (const [, config] of ALL) {
      const r = config.referendum;
      const sourced = [r.proposedMax, r.currentOperating, r.debt, r.committed2027].filter(Boolean);
      for (const s of sourced) expect(s!.source).toMatch(/^https?:\/\//);
    }
  });

  it('every district links to its DLGF determination PDF', () => {
    for (const [, config] of ALL) {
      expect(config.referendum.proposedMax.source).toMatch(/in\.gov\/dlgf\/.*Determination\.pdf$/i);
    }
  });
});

describe('scenario shape per district', () => {
  it('for a positive-AV homestead, pass-at-max is the highest and fail the lowest total', () => {
    for (const [, config] of ALL) {
      const district = config.taxDistricts[0];
      const r = computeAllScenarios(350000, district, config);
      expect(r.fail.total).toBeLessThanOrEqual(r.current.total);
      expect(r.passMax.total).toBeGreaterThanOrEqual(r.passCommitted.total);
      expect(r.passMax.total).toBeGreaterThan(r.fail.total);
    }
  });
});

describe('Carmel Clay — full repeal-and-replace of both referendums', () => {
  it('current referendum total is the combined 0.24 (operating 0.19 + safety 0.05)', () => {
    const carmel = DISTRICTS['carmel-clay'];
    const s = buildScenarios(carmel);
    expect(s.current.referendumOperatingRate).toBe(0.24);
    expect(s.current.referendumDebtRate).toBe(0); // nothing continues
    expect(s.fail.referendumOperatingRate).toBe(0);
    expect(s.fail.referendumDebtRate).toBe(0); // fail drops the whole 0.24
    expect(s.passMax.referendumOperatingRate).toBe(0.4274);
  });
});

describe('HSE / Westfield — operating replaced, debt continues', () => {
  it('debt rate is unchanged across all four scenarios', () => {
    for (const id of ['hamilton-southeastern', 'westfield-washington'] as const) {
      const s = buildScenarios(DISTRICTS[id]);
      const debt = DISTRICTS[id].referendum.debt!.value;
      expect(debt).toBeGreaterThan(0);
      for (const key of ['current', 'passCommitted', 'passMax', 'fail'] as const) {
        expect(s[key].referendumDebtRate).toBe(debt);
      }
    }
  });
});

describe('cross-district resolution has no overlaps', () => {
  it('each real GIS name resolves to exactly one config', () => {
    const cases: Array<[string, string]> = [
      ['Noblesville City', 'noblesville'],
      ['Noblesville FC', 'noblesville'],
      ['Nob Wayne', 'noblesville'],
      ['Fishers', 'hamilton-southeastern'],
      ['Fall Creek', 'hamilton-southeastern'],
      ['Delaware', 'hamilton-southeastern'],
      ['Carmel', 'carmel-clay'],
      ['Carmel Washington', 'carmel-clay'],
      ['Westfield', 'westfield-washington'],
      ['Sheridan', 'sheridan'],
      ['Sheridan Rural', 'sheridan'],
    ];
    for (const [name, id] of cases) {
      const r = resolveTaxDistrict(name);
      expect(r, `${name} should resolve`).not.toBeNull();
      expect(r!.config.id, `${name} → ${id}`).toBe(id);
    }
  });
});
