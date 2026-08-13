import { describe, it, expect } from 'vitest';
import { fmtRate } from './format';

describe('fmtRate', () => {
  it('keeps a half-cent rate at three decimals', () => {
    expect(fmtRate(0.385)).toBe('0.385');
  });

  it('renders whole-cent rates at two decimals', () => {
    expect(fmtRate(0.57)).toBe('0.57');
    expect(fmtRate(0.37)).toBe('0.37');
    expect(fmtRate(0.4)).toBe('0.40');
    expect(fmtRate(0.25)).toBe('0.25');
  });

  it('never rounds a half-cent away', () => {
    expect(fmtRate(0.385)).not.toBe('0.39');
    expect(fmtRate(0.545)).toBe('0.545');
    expect(fmtRate(0.465)).toBe('0.465');
  });

  it('handles zero', () => {
    expect(fmtRate(0)).toBe('0.00');
  });
});
