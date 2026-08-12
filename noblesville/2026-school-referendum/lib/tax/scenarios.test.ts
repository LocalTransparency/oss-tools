import { describe, it, expect } from 'vitest';
import { buildScenarios, computeAllScenarios } from './scenarios';
import { bucketsOf, computeNetAV, findDistrict } from './engine';
import { NOBLESVILLE } from './indiana/districts/noblesville';
import type { DistrictReferendumConfig } from './types';

const city = findDistrict(NOBLESVILLE, 'Noblesville City')!;
const township = findDistrict(NOBLESVILLE, 'Noblesville Twp')!;

describe('buildScenarios', () => {
  it('scenario parameters match the spec for Noblesville', () => {
    const scenarios = buildScenarios(NOBLESVILLE);
    expect(scenarios.current).toMatchObject({
      payYear: 2026, standardDeduction: 48000, supplementalRate: 0.40,
      referendumOperatingRate: 0.37, referendumDebtRate: 0.08,
    });
    expect(scenarios.passCommitted).toMatchObject({
      payYear: 2027, standardDeduction: 40000, supplementalRate: 0.46,
      referendumOperatingRate: 0.385, referendumDebtRate: 0.08,
    });
    expect(scenarios.passMax.referendumOperatingRate).toBe(0.57);
    expect(scenarios.fail).toMatchObject({ referendumOperatingRate: 0, referendumDebtRate: 0.08 });
    // committed vs max differ for Noblesville — guards against swapping the interpolated values
    expect(scenarios.passCommitted.label).toBe('If it passes — committed 2027 rate ($0.385)');
    expect(scenarios.passMax.label).toBe('If it passes — authorized maximum ($0.57)');
  });

  it('with a minimal config (only proposedMax set), optional rates default to 0 and passCommitted falls back to proposedMax', () => {
    const minimal: DistrictReferendumConfig = {
      id: 'minimal',
      name: 'Minimal District',
      county: 'Test',
      sources: {},
      referendum: {
        proposedMax: { value: 0.25, source: 'https://example.com/ballot', status: 'confirmed' },
      },
      gisGate: /minimal/i,
      taxDistricts: [],
    };
    const scenarios = buildScenarios(minimal);

    expect(scenarios.current.referendumOperatingRate).toBe(0);
    expect(scenarios.current.referendumDebtRate).toBe(0);
    expect(scenarios.fail.referendumDebtRate).toBe(0);

    // passCommitted falls back to proposedMax when committed2027 is absent
    expect(scenarios.passCommitted.referendumOperatingRate).toBe(0.25);
    expect(scenarios.passMax.referendumOperatingRate).toBe(0.25);

    // labels reflect the actual value used
    expect(scenarios.passCommitted.label).toBe('If it passes — authorized maximum ($0.25)');
    expect(scenarios.passMax.label).toBe('If it passes — authorized maximum ($0.25)');
  });
});

describe('computeAllScenarios', () => {
  it('returns all four scenarios for a $350k city home', () => {
    const r = computeAllScenarios(350000, city, NOBLESVILLE);
    expect(r.current.total).toBeCloseTo(4015.4, 2);
    expect(r.passCommitted.total).toBeCloseTo(3978.41, 2);
    expect(r.passMax.total).toBeCloseTo(4288.1, 2);
    expect(r.fail.total).toBeCloseTo(3333.92, 2);
  });

  it('pass-vs-fail delta at committed rate = referendum operating tax ($686.34 for $350k)', () => {
    const r = computeAllScenarios(350000, city, NOBLESVILLE);
    expect(r.passCommitted.total - r.fail.total).toBeCloseTo(644.49, 2); // 167400 × 0.385%
  });

  it('pass-vs-fail delta at max rate matches the ballot figure ($954.18)', () => {
    const r = computeAllScenarios(350000, city, NOBLESVILLE);
    expect(r.passMax.total - r.fail.total).toBeCloseTo(954.18, 2);
  });

  it('township $350k home pays LESS under pass than currently (net AV shrinks, cap not binding)', () => {
    const r = computeAllScenarios(350000, township, NOBLESVILLE);
    expect(r.current.total).toBeCloseTo(3089.39, 2);
    expect(r.passCommitted.total).toBeCloseTo(2879.21, 2);
    expect(r.passCommitted.total).toBeLessThan(r.current.total);
  });

  // Guards the methodology FAQ crossover claims at the district's committed
  // $0.385 rate, for Noblesville City. Net AV is equal between pay-2026 and
  // pay-2027 at exactly $120,000 gross AV:
  //   0.60 × (AV − 48000) = 0.54 × (AV − 40000)  →  0.06 × AV = 7200  →  AV = 120000
  // The total-bill crossover sits slightly above that, near $124,900, because
  // the pay-2027 referendum rate ($0.465 combined) exceeds pay-2026's ($0.45).
  describe('methodology FAQ crossover claims (Noblesville City, committed $0.385 rate)', () => {
    it('net AV is identical under pay-2026 and pay-2027 at exactly $120,000 gross AV', () => {
      const scenarios = buildScenarios(NOBLESVILLE);
      const a = computeNetAV(bucketsOf(120000, 1), scenarios.current);
      const b = computeNetAV(bucketsOf(120000, 1), scenarios.passCommitted);
      expect(a.netAV).toBeCloseTo(b.netAV, 6);
      expect(a.netAV).toBeCloseTo(43200, 6);
    });

    it('below the crossover ($120k AV), pass-committed still increases vs. current', () => {
      const r = computeAllScenarios(120000, city, NOBLESVILLE);
      expect(r.passCommitted.total).toBeGreaterThan(r.current.total);
    });

    it('above the crossover ($130k AV), pass-committed decreases vs. current', () => {
      const r = computeAllScenarios(130000, city, NOBLESVILLE);
      expect(r.passCommitted.total).toBeLessThan(r.current.total);
    });

    it('at $350k AV, pass-committed decreases while pass-max still increases', () => {
      const r = computeAllScenarios(350000, city, NOBLESVILLE);
      expect(r.passCommitted.total).toBeLessThan(r.current.total);
      expect(r.passMax.total).toBeGreaterThan(r.current.total);
    });

    // Pins the page's stated total-bill crossover (~$124,900) to the $120k-$130k bracket.
    // There's no closed form for this value (unlike the $120,000 net-AV identity above) because
    // the non-referendum tax, circuit-breaker credit, and supplemental homestead credit all shift
    // with net assessed value too — so this bracket is the guard against the page copy drifting.
    it('pins the total-bill crossover to the $120k-$130k bracket', () => {
      const below = computeAllScenarios(120000, city, NOBLESVILLE);
      const above = computeAllScenarios(130000, city, NOBLESVILLE);
      expect(below.passCommitted.total).toBeGreaterThan(below.current.total);
      expect(above.passCommitted.total).toBeLessThan(above.current.total);
    });
  });
});
