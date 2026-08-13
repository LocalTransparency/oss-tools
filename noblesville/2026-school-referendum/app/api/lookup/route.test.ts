import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/lookup/counties', () => ({
  COUNTY_SOURCES: { hamilton: { county: 'Hamilton', search: vi.fn() } },
}));

// Wraps the real inferCapClass so every test keeps its normal behavior by
// default; individual tests below (Finding 6) override it with
// mockImplementationOnce to simulate an enrichment-time bug distinct from an
// upstream/county failure.
vi.mock('@/lib/tax/indiana/capClass', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tax/indiana/capClass')>();
  return { ...actual, inferCapClass: vi.fn(actual.inferCapClass) };
});

import { POST } from './route';
import { COUNTY_SOURCES } from '@/lib/lookup/counties';
import { parseResponse } from '@/lib/lookup/arcgis';

const mockSearch = vi.mocked(COUNTY_SOURCES.hamilton.search);

function req(body: unknown) {
  return new Request('http://localhost/api/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function rawReq(body: string) {
  return new Request('http://localhost/api/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

// Stubs the county search response from raw ArcGIS-shaped attributes (the
// field names the upstream service actually returns — see
// lib/lookup/arcgis.ts) and drives the route the same way real callers do:
// a POST with a JSON `{ q }` body. This route has no GET handler and
// deliberately never accepts the query as a `?q=` URL parameter — see the
// privacy comment in route.ts (hosting access logs record GET query
// strings, not POST bodies).
function getLookup(query: string, attrs: Record<string, unknown>[]) {
  mockSearch.mockResolvedValueOnce(
    parseResponse({ features: attrs.map((a) => ({ attributes: a })) })
  );
  return POST(req({ q: query }));
}

beforeEach(() => mockSearch.mockReset());

describe('POST /api/lookup', () => {
  it('returns candidates for a valid query', async () => {
    mockSearch.mockResolvedValue([
      {
        parcelNo: '160', stateParcelNo: '29', address: '1234 CONNER ST', city: 'Noblesville',
        zip: '46060', grossAV: 350000, assessmentYear: 2026, homestead: true,
        taxDistrictName: 'Noblesville City', propertyReportUrl: 'https://example.test/r',
        homesteadCode: 1, propertyClass: '510', avLand: 0, avImprove: 0, deededAcres: 0,
      },
    ]);
    const res = await POST(req({ q: '1234 conner st' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates).toHaveLength(1);
    expect(mockSearch).toHaveBeenCalledWith('1234 CONNER ST'); // sanitized before calling
  });

  it('rejects queries shorter than 4 characters', async () => {
    const res = await POST(req({ q: '12' }));
    expect(res.status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('maps upstream failure to 502', async () => {
    const err = new Error('upstream');
    mockSearch.mockRejectedValueOnce(err);
    // A query term not used by other tests in this file, so it can't hit a
    // cache entry left behind by an earlier successful lookup.
    const res = await POST(req({ q: '5678 failure ave' }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('upstream');
  });

  it('treats a malformed or missing body as too-short', async () => {
    const res = await POST(rawReq('not json'));
    expect(res.status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toBe('query-too-short');
  });

  it('treats a JSON null body as too-short (not a 500)', async () => {
    const res = await POST(rawReq('null'));
    expect(res.status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toBe('query-too-short');
  });
});

// Finding 6: the cache-hit path used to call withCapClassInference outside
// any try/catch while the cache-miss path wrapped the equivalent call — a
// throw there gave a cache-miss visitor a friendly 502 and a cache-hit
// visitor a raw framework 500. Both paths must fail the same, deliberate
// way, and it must not be reported as 'upstream' — no county call happens
// on a cache hit, so blaming the county would be misleading.
describe('POST /api/lookup — enrichment failures are handled the same way on every path (Finding 6)', () => {
  const result = [
    {
      parcelNo: '555', stateParcelNo: '5', address: '5 INTERNAL LN', city: 'Noblesville',
      zip: '46060', grossAV: 200000, assessmentYear: 2026, homestead: true,
      taxDistrictName: 'Noblesville City', propertyReportUrl: '',
      homesteadCode: 1, propertyClass: '510', avLand: 0, avImprove: 0, deededAcres: 0,
    },
  ];

  it('reports a cache-miss enrichment failure as a distinct internal error, not upstream', async () => {
    mockSearch.mockResolvedValueOnce(result);
    const infer = vi.mocked((await import('@/lib/tax/indiana/capClass')).inferCapClass);
    infer.mockImplementationOnce(() => { throw new Error('enrichment blew up'); });

    const res = await POST(req({ q: '5 internal ln cache-miss' }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('internal');
  });

  it('reports a cache-hit enrichment failure the same way (500 internal), not a raw framework 500 and not 502', async () => {
    mockSearch.mockResolvedValueOnce(result);
    const first = await POST(req({ q: '6 internal ln cache-hit' }));
    expect(first.status).toBe(200); // primes the cache

    const infer = vi.mocked((await import('@/lib/tax/indiana/capClass')).inferCapClass);
    infer.mockImplementationOnce(() => { throw new Error('enrichment blew up'); });

    const second = await POST(req({ q: '6 internal ln cache-hit' }));
    expect(second.status).toBe(500);
    expect((await second.json()).error).toBe('internal');
    expect(mockSearch).toHaveBeenCalledTimes(1); // still served from cache, no extra county call
  });

  it('a non-"upstream" failure out of the county search is also reported as internal, distinct from a real outage', async () => {
    // Simulates a regression inside arcgis.ts's parsing (e.g. parseResponse
    // throwing) rather than a genuine network/HTTP failure — searchParcels
    // only throws Error('upstream') for the latter, so anything else must
    // not be reported under the same 502 identity.
    mockSearch.mockRejectedValueOnce(new Error('parse-regression'));
    const res = await POST(req({ q: '7 internal ln parse-bug' }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('internal');
  });
});

describe('POST /api/lookup — caching', () => {
  const result = [
    {
      parcelNo: '999', stateParcelNo: '1', address: '99 CACHE LN', city: 'Noblesville',
      zip: '46060', grossAV: 200000, assessmentYear: 2026, homestead: true,
      taxDistrictName: 'Noblesville City', propertyReportUrl: '',
      homesteadCode: 1, propertyClass: '510', avLand: 0, avImprove: 0, deededAcres: 0,
    },
  ];

  it('caches a successful result and serves the second identical query without hitting searchParcels', async () => {
    mockSearch.mockResolvedValue(result);

    const first = await POST(req({ q: '99 cache ln' }));
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    // toMatchObject, not toEqual: the route adds derived capClass fields
    // (Task 11) to every candidate at response time, so the response is a
    // superset of the cached raw parcel data — that enrichment is exercised
    // separately below.
    expect(firstBody.candidates).toMatchObject(result);
    expect(mockSearch).toHaveBeenCalledTimes(1);

    const second = await POST(req({ q: '99 cache ln' }));
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.candidates).toMatchObject(result);
    expect(mockSearch).toHaveBeenCalledTimes(1); // still 1 — served from cache

    // Guards against the cache-hit and cache-miss paths ever enriching a
    // candidate differently — e.g. one branch's call to
    // withCapClassInference changing, or the cache starting to store
    // post-enrichment objects. Without this, a cached visitor and a fresh
    // visitor could silently see different capClass values for the same
    // parcel and every assertion above would still pass.
    expect(secondBody).toEqual(firstBody);
  });

  it('does not cache an upstream failure, so the next identical query retries', async () => {
    mockSearch.mockRejectedValueOnce(new Error('upstream'));
    mockSearch.mockResolvedValueOnce(result);

    const first = await POST(req({ q: '77 retry rd' }));
    expect(first.status).toBe(502);

    const second = await POST(req({ q: '77 retry rd' }));
    expect(second.status).toBe(200);
    expect((await second.json()).candidates).toMatchObject(result);
    expect(mockSearch).toHaveBeenCalledTimes(2); // retried — the failure wasn't cached
  });
});

describe('POST /api/lookup — cap class fields', () => {
  it('returns an inferred cap class with its confidence and reason', async () => {
    const res = await getLookup('1 MAIN ST', [
      { AVTOTGROSS: 350000, AVTAXYR: 2026, hmstd_code: 1, PROPCLASS: '510', TAXDISTNAM: 'Noblesville City', DEEDACRES: 0.25 },
    ]);
    const body = await res.json();
    expect(body.candidates[0].capClass).toBe(1);
    expect(body.candidates[0].capClassConfidence).toBe('high');
    expect(body.candidates[0].capClassReason).toMatch(/1% cap/);
  });

  it('flags an unconfirmed homestead code as low confidence', async () => {
    // A different query term than the previous test — this route's cache
    // is a module-level singleton with no reset between tests in this file
    // (see the "77 retry rd" comment above), so reusing a term here would
    // return the previous test's cached candidate instead of exercising a
    // fresh search.
    const res = await getLookup('2 MAIN ST', [
      { AVTOTGROSS: 350000, AVTAXYR: 2026, hmstd_code: -1, PROPCLASS: '510', TAXDISTNAM: 'Noblesville City', DEEDACRES: 5.68 },
    ]);
    const body = await res.json();
    expect(body.candidates[0].capClass).toBe(2);
    expect(body.candidates[0].capClassConfidence).toBe('low');
    expect(body.candidates[0].deededAcres).toBeCloseTo(5.68, 2);
  });
});
