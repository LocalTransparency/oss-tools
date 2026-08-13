import { describe, it, expect } from 'vitest';
import { DISTRICTS } from './index';
import { resolveTaxDistrict } from './resolve';
import { bucketsOf, nonReferendumRate } from '../../engine';
import { buildScenarios, computeAllScenarios } from '../../scenarios';
import { DEDUCTIONS, CAP2_AV_DEDUCTION } from '../assumptions';

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

// Finding 4: a district's operatingRates schedule (lib/tax/indiana/districts/*.ts)
// and the pay-year assumption tables it draws on (lib/tax/indiana/assumptions.ts)
// are two files edited independently. The README describes extending a
// district's operatingRates past 2034 as a routine data edit — but
// projectReferendumLine throws for any year missing from either table (see
// lib/tax/projection.ts and lib/tax/engine.ts's computeNetAV), and nothing
// upstream of that throw caught it before this fix (see
// components/ProjectionErrorBoundary.tsx for the runtime half of this guard).
// This test is the loud, pre-deploy half: it fails in CI the moment a
// projection schedule outruns the assumption tables, instead of a visitor
// discovering it as a blank page on election week.
describe('every district\'s projection schedule stays inside the assumption tables (data integrity)', () => {
  it('every year in operatingRates has a matching DEDUCTIONS and CAP2_AV_DEDUCTION entry', () => {
    for (const [id, config] of ALL) {
      const projection = config.referendum.projection;
      if (!projection) continue;
      for (const year of Object.keys(projection.operatingRates.value).map(Number)) {
        expect(DEDUCTIONS[year], `${id}: DEDUCTIONS is missing pay year ${year}`).toBeDefined();
        expect(
          CAP2_AV_DEDUCTION.value[year],
          `${id}: CAP2_AV_DEDUCTION is missing pay year ${year}`,
        ).toBeDefined();
      }
    }
  });
});

describe('scenario shape per district', () => {
  it('for a positive-AV homestead, pass-at-max is the highest and fail the lowest total', () => {
    for (const [, config] of ALL) {
      const district = config.taxDistricts[0];
      const r = computeAllScenarios(bucketsOf(350000, 1), district, config);
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
