import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  sanitizeSearchTerm, normalizeStreetSuffixes, buildQueryUrl, parseResponse, searchParcels,
} from './arcgis';
import fixture from './fixtures/sample-response.json';

describe('sanitizeSearchTerm', () => {
  it('uppercases, trims, collapses whitespace', () => {
    expect(sanitizeSearchTerm('  1234  conner st ')).toBe('1234 CONNER ST');
  });
  it('strips SQL-meaningful characters', () => {
    expect(sanitizeSearchTerm(`123' OR 1=1;--`)).toBe('123 OR 11--');
  });
});

describe('normalizeStreetSuffixes', () => {
  it('replaces a full suffix word with its USPS abbreviation', () => {
    expect(normalizeStreetSuffixes('1234 CONNER STREET')).toBe('1234 CONNER ST');
  });
  it('replaces LANE with LN', () => {
    expect(normalizeStreetSuffixes('SMITH LANE')).toBe('SMITH LN');
  });
  it('does not touch a suffix word embedded inside a longer word', () => {
    expect(normalizeStreetSuffixes('LANEWOOD DR')).toBe('LANEWOOD DR');
  });
  it('leaves already-abbreviated input unchanged', () => {
    expect(normalizeStreetSuffixes('1234 CONNER ST')).toBe('1234 CONNER ST');
  });
  it('normalizes multiple common suffixes across the map', () => {
    expect(normalizeStreetSuffixes('DRIVE ROAD COURT CIRCLE AVENUE')).toBe('DR RD CT CIR AVE');
    expect(normalizeStreetSuffixes('BOULEVARD PLACE TRAIL PARKWAY TERRACE')).toBe('BLVD PL TRL PKWY TER');
    expect(normalizeStreetSuffixes('HIGHWAY SQUARE POINT CROSSING RIDGE COMMONS')).toBe('HWY SQ PT XING RDG CMNS');
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
  it('throws Error(upstream) on network failure (rejected fetch)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(searchParcels('123 MAIN ST')).rejects.toThrow('upstream');
  });
  it('sanitizes the term before building the query URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ features: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await searchParcels(`123' OR 1=1;-- main st`);
    const calledUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const where = calledUrl.searchParams.get('where')!;
    // The only single quotes allowed are the four that delimit the two LIKE
    // patterns; none of the caller's quotes may survive into the clause.
    expect(where).toContain("LIKE '%123 OR 11-- MAIN ST%'");
    expect(where.match(/'/g)).toHaveLength(4);
  });
  it('normalizes full street-suffix words to USPS abbreviations before querying', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ features: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await searchParcels('1234 conner street');
    const calledUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const where = calledUrl.searchParams.get('where')!;
    expect(where).toContain("LIKE '%1234 CONNER ST%'");
  });
});
