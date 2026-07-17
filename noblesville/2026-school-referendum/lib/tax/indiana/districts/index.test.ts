import { describe, it, expect } from 'vitest';
import { DISTRICTS } from './index';

describe('district registry', () => {
  it('every registry key matches its config id', () => {
    for (const [key, config] of Object.entries(DISTRICTS)) {
      expect(config.id).toBe(key);
    }
  });
});
