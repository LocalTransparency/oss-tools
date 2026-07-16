import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/lookup/arcgis', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/lookup/arcgis')>();
  return { ...mod, searchParcels: vi.fn() };
});

import { POST } from './route';
import { searchParcels } from '@/lib/lookup/arcgis';

const mockSearch = vi.mocked(searchParcels);

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

beforeEach(() => mockSearch.mockReset());

describe('POST /api/lookup', () => {
  it('returns candidates for a valid query', async () => {
    mockSearch.mockResolvedValue([
      {
        parcelNo: '160', stateParcelNo: '29', address: '1234 CONNER ST', city: 'Noblesville',
        zip: '46060', grossAV: 350000, assessmentYear: 2026, homestead: true,
        taxDistrictName: 'Noblesville City', propertyReportUrl: 'https://example.test/r',
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
    },
  ];

  it('caches a successful result and serves the second identical query without hitting searchParcels', async () => {
    mockSearch.mockResolvedValue(result);

    const first = await POST(req({ q: '99 cache ln' }));
    expect(first.status).toBe(200);
    expect((await first.json()).candidates).toEqual(result);
    expect(mockSearch).toHaveBeenCalledTimes(1);

    const second = await POST(req({ q: '99 cache ln' }));
    expect(second.status).toBe(200);
    expect((await second.json()).candidates).toEqual(result);
    expect(mockSearch).toHaveBeenCalledTimes(1); // still 1 — served from cache
  });

  it('does not cache an upstream failure, so the next identical query retries', async () => {
    mockSearch.mockRejectedValueOnce(new Error('upstream'));
    mockSearch.mockResolvedValueOnce(result);

    const first = await POST(req({ q: '77 retry rd' }));
    expect(first.status).toBe(502);

    const second = await POST(req({ q: '77 retry rd' }));
    expect(second.status).toBe(200);
    expect((await second.json()).candidates).toEqual(result);
    expect(mockSearch).toHaveBeenCalledTimes(2); // retried — the failure wasn't cached
  });
});
