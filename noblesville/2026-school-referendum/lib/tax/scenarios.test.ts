import { describe, it, expect } from 'vitest';
import { computeAllScenarios } from './scenarios';
import { findDistrict } from './assumptions';

const city = findDistrict('Noblesville City')!;
const township = findDistrict('Noblesville Township')!;

describe('computeAllScenarios', () => {
  it('returns all four scenarios for a $350k city home', () => {
    const r = computeAllScenarios(350000, city);
    expect(r.current.total).toBeCloseTo(4015.4, 2);
    expect(r.passCommitted.total).toBeCloseTo(4020.26, 2);
    expect(r.passMax.total).toBeCloseTo(4288.1, 2);
    expect(r.fail.total).toBeCloseTo(3333.92, 2);
  });

  it('pass-vs-fail delta at committed rate = referendum operating tax ($686.34 for $350k)', () => {
    const r = computeAllScenarios(350000, city);
    expect(r.passCommitted.total - r.fail.total).toBeCloseTo(686.34, 2); // 167400 × 0.41%
  });

  it('pass-vs-fail delta at max rate matches the ballot figure ($954.18)', () => {
    const r = computeAllScenarios(350000, city);
    expect(r.passMax.total - r.fail.total).toBeCloseTo(954.18, 2);
  });

  it('township $350k home pays LESS under pass than currently (net AV shrinks, cap not binding)', () => {
    const r = computeAllScenarios(350000, township);
    expect(r.current.total).toBeCloseTo(3089.39, 2);
    expect(r.passCommitted.total).toBeCloseTo(2921.06, 2);
    expect(r.passCommitted.total).toBeLessThan(r.current.total);
  });

  // Guards the methodology FAQ ("Why does my estimate go down if it passes?"),
  // which claims: crossover near $440k AV, decrease above it, increase below it —
  // at the district's committed $0.41 rate, for Noblesville City.
  describe('methodology FAQ crossover claims (Noblesville City, committed $0.41 rate)', () => {
    it('at $440k AV, pass-committed total ≈ current total (crossover point)', () => {
      const r = computeAllScenarios(440000, city);
      expect(r.passCommitted.total).toBeCloseTo(r.current.total, 0); // within $1
    });

    it('at $500k AV, pass-committed decreases and pass-max increases vs. current', () => {
      const r = computeAllScenarios(500000, city);
      expect(r.passCommitted.total).toBeLessThan(r.current.total);
      expect(r.passMax.total).toBeGreaterThan(r.current.total);
    });

    it('at $350k AV, pass-committed increases vs. current', () => {
      const r = computeAllScenarios(350000, city);
      expect(r.passCommitted.total).toBeGreaterThan(r.current.total);
    });
  });
});
