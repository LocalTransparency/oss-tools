import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ParcelCandidate } from './arcgis';

const candidate: ParcelCandidate = {
  parcelNo: '160', stateParcelNo: '29', address: '1234 CONNER ST', city: 'Noblesville',
  zip: '46060', grossAV: 350000, assessmentYear: 2026, homestead: true,
  taxDistrictName: 'Noblesville City', propertyReportUrl: '',
};

describe('lookup cache', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
  });

  it('returns undefined on a miss', async () => {
    const { getCached } = await import('./cache');
    expect(getCached('NOPE')).toBeUndefined();
  });

  it('returns the cached value on a hit', async () => {
    const { getCached, setCached } = await import('./cache');
    setCached('1234 CONNER ST', [candidate]);
    expect(getCached('1234 CONNER ST')).toEqual([candidate]);
  });

  it('expires entries after the 10 minute TTL', async () => {
    vi.useFakeTimers();
    const { getCached, setCached } = await import('./cache');
    setCached('1234 CONNER ST', [candidate]);

    vi.advanceTimersByTime(10 * 60 * 1000 - 1);
    expect(getCached('1234 CONNER ST')).toEqual([candidate]);

    vi.advanceTimersByTime(2);
    expect(getCached('1234 CONNER ST')).toBeUndefined();
  });

  it('evicts the least-recently-used entry once over the 500 entry cap', async () => {
    const { getCached, setCached } = await import('./cache');
    for (let i = 0; i < 500; i++) {
      setCached(`KEY${i}`, [{ ...candidate, parcelNo: String(i) }]);
    }
    // All 500 still present.
    expect(getCached('KEY0')).toBeDefined();
    expect(getCached('KEY499')).toBeDefined();

    // Reading KEY0 marks it as recently used, so KEY1 becomes the oldest.
    getCached('KEY0');

    setCached('KEY500', [candidate]);

    expect(getCached('KEY1')).toBeUndefined(); // evicted (oldest untouched entry)
    expect(getCached('KEY0')).toBeDefined(); // spared, was touched
    expect(getCached('KEY500')).toBeDefined(); // newly added
  });

  it('does not cache failures (caller never calls setCached on error, so a later getCached still misses)', async () => {
    const { getCached } = await import('./cache');
    expect(getCached('1234 FAIL ST')).toBeUndefined();
    expect(getCached('1234 FAIL ST')).toBeUndefined();
  });
});
