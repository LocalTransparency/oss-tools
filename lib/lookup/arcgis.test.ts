import { describe, it, expect, vi, afterEach } from 'vitest';
import { sanitizeSearchTerm, buildQueryUrl, parseResponse, searchParcels } from './arcgis';
import fixture from './fixtures/sample-response.json';

describe('sanitizeSearchTerm', () => {
  it('uppercases, trims, collapses whitespace', () => {
    expect(sanitizeSearchTerm('  1234  conner st ')).toBe('1234 CONNER ST');
  });
  it('strips SQL-meaningful characters', () => {
    expect(sanitizeSearchTerm(`123' OR 1=1;--`)).toBe('123 OR 11--');
  });
});

describe('buildQueryUrl', () => {
  it('targets the county FeatureServer with a LIKE clause and Noblesville district filter', () => {
    const url = new URL(buildQueryUrl('1234 CONNER ST'));
    expect(url.hostname).toBe('services5.arcgis.com');
    const where = url.searchParams.get('where')!;
    expect(where).toContain("LIKE '%1234 CONNER ST%'");
    expect(where).toContain("TAXDISTNAM) LIKE '%NOBLESVILLE%'");
    expect(url.searchParams.get('resultRecordCount')).toBe('10');
    expect(url.searchParams.get('returnGeometry')).toBe('false');
  });
});

describe('parseResponse', () => {
  it('maps real county features to ParcelCandidates', () => {
    const parcels = parseResponse(fixture);
    expect(parcels.length).toBeGreaterThan(0);
    const p = parcels[0];
    expect(p.address).toBeTruthy();
    expect(p.grossAV).toBeGreaterThan(0);
    expect(p.assessmentYear).toBeGreaterThanOrEqual(2025);
    expect(typeof p.homestead).toBe('boolean');
    expect(p.taxDistrictName).toMatch(/noblesville/i);
  });
  it('returns [] for malformed payloads', () => {
    expect(parseResponse({})).toEqual([]);
    expect(parseResponse(null)).toEqual([]);
    expect(parseResponse({ error: { code: 400 } })).toEqual([]);
  });
  // Fixture-specific: the live Hamilton County FeatureServer response captured in
  // lib/lookup/fixtures/sample-response.json encodes homestead status two ways that
  // agree with each other: HOMESTEAD is null / "Active" (string), and hmstd_code is
  // the paired integer 0 / 1. This fixture contains at least one of each, so we
  // assert the parser actually distinguishes them instead of defaulting everything
  // to the same boolean.
  it('distinguishes homestead vs non-homestead parcels per the real HOMESTEAD/hmstd_code convention', () => {
    const parcels = parseResponse(fixture);
    expect(parcels.some((p) => p.homestead)).toBe(true);
    expect(parcels.some((p) => !p.homestead)).toBe(true);
  });
});

describe('searchParcels', () => {
  afterEach(() => vi.restoreAllMocks());
  it('throws on upstream failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })));
    await expect(searchParcels('123 MAIN ST')).rejects.toThrow('upstream');
  });
});
