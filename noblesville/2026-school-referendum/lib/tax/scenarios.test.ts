import { describe, it, expect } from 'vitest';
import { buildScenarios, computeAllScenarios } from './scenarios';
import { findDistrict } from './engine';
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
      referendumOperatingRate: 0.41, referendumDebtRate: 0.08,
    });
    expect(scenarios.passMax.referendumOperatingRate).toBe(0.57);
    expect(scenarios.fail).toMatchObject({ referendumOperatingRate: 0, referendumDebtRate: 0.08 });
    // committed vs max differ for Noblesville — guards against swapping the interpolated values
    expect(scenarios.passCommitted.label).toBe('If it passes — committed 2027 rate ($0.41)');
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
    expect(r.passCommitted.total).toBeCloseTo(4020.26, 2);
    expect(r.passMax.total).toBeCloseTo(4288.1, 2);
    expect(r.fail.total).toBeCloseTo(3333.92, 2);
  });

  it('pass-vs-fail delta at committed rate = referendum operating tax ($686.34 for $350k)', () => {
    const r = computeAllScenarios(350000, city, NOBLESVILLE);
    expect(r.passCommitted.total - r.fail.total).toBeCloseTo(686.34, 2); // 167400 × 0.41%
  });

  it('pass-vs-fail delta at max rate matches the ballot figure ($954.18)', () => {
    const r = computeAllScenarios(350000, city, NOBLESVILLE);
    expect(r.passMax.total - r.fail.total).toBeCloseTo(954.18, 2);
  });

  it('township $350k home pays LESS under pass than currently (net AV shrinks, cap not binding)', () => {
    const r = computeAllScenarios(350000, township, NOBLESVILLE);
    expect(r.current.total).toBeCloseTo(3089.39, 2);
    expect(r.passCommitted.total).toBeCloseTo(2921.06, 2);
    expect(r.passCommitted.total).toBeLessThan(r.current.total);
  });

  // Guards the methodology FAQ ("Why does my estimate go down if it passes?"),
  // which claims: crossover near $440k AV, decrease above it, increase below it —
  // at the district's committed $0.41 rate, for Noblesville City.
  describe('methodology FAQ crossover claims (Noblesville City, committed $0.41 rate)', () => {
    it('at $440k AV, pass-committed total ≈ current total (crossover point)', () => {
      const r = computeAllScenarios(440000, city, NOBLESVILLE);
      expect(r.passCommitted.total).toBeCloseTo(r.current.total, 0); // within $1
    });

    it('at $500k AV, pass-committed decreases and pass-max increases vs. current', () => {
      const r = computeAllScenarios(500000, city, NOBLESVILLE);
      expect(r.passCommitted.total).toBeLessThan(r.current.total);
      expect(r.passMax.total).toBeGreaterThan(r.current.total);
    });

    it('at $350k AV, pass-committed increases vs. current', () => {
      const r = computeAllScenarios(350000, city, NOBLESVILLE);
      expect(r.passCommitted.total).toBeGreaterThan(r.current.total);
    });
  });
});
