import { describe, it, expect } from 'vitest';
import { inferCapClass } from './capClass';

const at = (homesteadCode: number | null, propertyClass: string, assessmentYear = 2026) =>
  inferCapClass({ homesteadCode, propertyClass, assessmentYear });

describe('inferCapClass', () => {
  it('an active homestead is cap 1', () => {
    expect(at(1, '510')).toMatchObject({ capClass: 1, confidence: 'high' });
  });

  it('non-homestead residential is cap 2', () => {
    expect(at(0, '510')).toMatchObject({ capClass: 2, confidence: 'high' });
    expect(at(0, '599')).toMatchObject({ capClass: 2, confidence: 'high' });
  });

  it('agricultural land is cap 2', () => {
    expect(at(0, '100')).toMatchObject({ capClass: 2, confidence: 'high' });
  });

  it('commercial and industrial are cap 3', () => {
    expect(at(0, '400')).toMatchObject({ capClass: 3, confidence: 'high' });
    expect(at(0, '340')).toMatchObject({ capClass: 3, confidence: 'high' });
    expect(at(0, '685')).toMatchObject({ capClass: 3, confidence: 'high' });
  });

  // Hamilton County's parcel layer uses -1 on thousands of parcels and its
  // meaning is unconfirmed. Treat as non-homestead but never silently.
  it('an unconfirmed homestead code (-1) is low confidence', () => {
    const r = at(-1, '510');
    expect(r.capClass).toBe(2);
    expect(r.confidence).toBe('low');
    expect(r.reason).toMatch(/unconfirmed/i);
  });

  it('a missing homestead code is low confidence', () => {
    expect(at(null, '510').confidence).toBe('low');
  });

  it('an off-base assessment year is low confidence even when the class is clear', () => {
    const r = at(1, '510', 2025);
    expect(r.capClass).toBe(1);
    expect(r.confidence).toBe('low');
    expect(r.reason).toMatch(/2026/);
  });

  it('an unrecognized property class falls back to cap 3 at low confidence', () => {
    expect(at(0, '')).toMatchObject({ capClass: 3, confidence: 'low' });
  });
});
