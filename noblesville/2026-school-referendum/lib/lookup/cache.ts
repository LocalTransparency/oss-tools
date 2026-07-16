import type { ParcelCandidate } from './arcgis';

// Module-level singleton: an in-memory, per-instance cache for successful
// county lookups. Never persisted, never logged — see app/api/lookup/route.ts
// for the privacy rationale (only successful results are ever cached).
const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ENTRIES = 500;

interface Entry {
  value: ParcelCandidate[];
  expiresAt: number;
}

const cache = new Map<string, Entry>();

export function getCached(key: string): ParcelCandidate[] | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;

  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }

  // Mark as most-recently-used: delete + re-set moves it to the end of the
  // Map's iteration order, which setCached's eviction relies on.
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

export function setCached(key: string, value: ParcelCandidate[]): void {
  cache.delete(key); // so a re-set also refreshes recency order
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });

  if (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
}
