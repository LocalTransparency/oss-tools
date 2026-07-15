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
});
