import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/lookup/arcgis', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/lookup/arcgis')>();
  return { ...mod, searchParcels: vi.fn() };
});

import { GET } from './route';
import { searchParcels } from '@/lib/lookup/arcgis';

const mockSearch = vi.mocked(searchParcels);

function req(q: string) {
  return new Request(`http://localhost/api/lookup?q=${encodeURIComponent(q)}`);
}

beforeEach(() => mockSearch.mockReset());

describe('GET /api/lookup', () => {
  it('returns candidates for a valid query', async () => {
    mockSearch.mockResolvedValue([
      {
        parcelNo: '160', stateParcelNo: '29', address: '1234 CONNER ST', city: 'Noblesville',
        zip: '46060', grossAV: 350000, assessmentYear: 2026, homestead: true,
        taxDistrictName: 'Noblesville City', propertyReportUrl: 'https://example.test/r',
      },
    ]);
    const res = await GET(req('1234 conner st'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates).toHaveLength(1);
    expect(mockSearch).toHaveBeenCalledWith('1234 CONNER ST'); // sanitized before calling
  });

  it('rejects queries shorter than 4 characters', async () => {
    const res = await GET(req('12'));
    expect(res.status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('maps upstream failure to 502', async () => {
    const err = new Error('upstream');
    mockSearch.mockRejectedValueOnce(err);
    const res = await GET(req('1234 conner st'));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('upstream');
  });
});
