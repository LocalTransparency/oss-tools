import { describe, it, expect } from 'vitest';
import * as assumptions from './assumptions';
import { DISTRICTS } from './districts';

const VALID_STATUSES = ['confirmed', 'estimated', 'public-commitment'];

/** Structural check — a Sourced<T> at runtime, not by import type. */
function isSourced(x: unknown): x is { value: unknown; source: unknown; status: unknown } {
  if (typeof x !== 'object' || x === null) return false;
  const obj = x as Record<string, unknown>;
  return 'value' in obj && typeof obj.source === 'string' && typeof obj.status === 'string';
}

/**
 * Walks every exported value in a module/object graph and collects every
 * Sourced-shaped value found, at any depth (a Sourced value's own `value` is
 * walked too, so a future nested Sourced isn't missed; RegExp/primitive
 * leaves stop the walk naturally since they carry no own-enumerable object
 * properties `Object.entries` would find).
 */
function collectSourced(
  x: unknown,
  path: string,
  out: Array<{ path: string; source: string; status: string }>,
): void {
  if (x === null || typeof x !== 'object') return;
  if (isSourced(x)) {
    out.push({ path, source: x.source as string, status: x.status as string });
  }
  for (const [key, value] of Object.entries(x as Record<string, unknown>)) {
    collectSourced(value, `${path}.${key}`, out);
  }
}

// Finding 8: Sourced<T>.source/.status had no validation anywhere — a typo'd
// or missing source URL, or a status outside the three legal values, would
// sit undetected in a file this tool's whole premise depends on being
// trustworthy and verifiable. One structural test covers every exported
// Sourced value across lib/tax/indiana/ without needing type machinery or a
// hand-maintained list that drifts as districts/assumptions are added.
describe('every Sourced value across lib/tax/indiana/ — source and status are well-formed (Finding 8)', () => {
  it('cites an https:// source and a valid status', () => {
    const found: Array<{ path: string; source: string; status: string }> = [];
    collectSourced(assumptions, 'assumptions', found);
    collectSourced(DISTRICTS, 'DISTRICTS', found);

    // Sanity check that the walker actually found something real — a bug
    // that made collectSourced find nothing would otherwise pass vacuously.
    expect(found.length).toBeGreaterThan(10);

    for (const { path, source, status } of found) {
      expect(source, `${path}.source`).toMatch(/^https:\/\//);
      expect(VALID_STATUSES, `${path}.status`).toContain(status);
    }
  });
});
