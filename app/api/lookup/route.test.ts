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
    const res = await POST(req({ q: '1234 conner st' }));
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
