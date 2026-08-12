import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/lookup/counties', () => ({
  COUNTY_SOURCES: { hamilton: { county: 'Hamilton', search: vi.fn() } },
}));

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
    // toMatchObject, not toEqual: the route adds derived capClass fields
    // (Task 11) to every candidate at response time, so the response is a
    // superset of the cached raw parcel data — that enrichment is exercised
    // separately below.
    expect((await first.json()).candidates).toMatchObject(result);
    expect(mockSearch).toHaveBeenCalledTimes(1);

    const second = await POST(req({ q: '99 cache ln' }));
    expect(second.status).toBe(200);
    expect((await second.json()).candidates).toMatchObject(result);
    expect(mockSearch).toHaveBeenCalledTimes(1); // still 1 — served from cache
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
