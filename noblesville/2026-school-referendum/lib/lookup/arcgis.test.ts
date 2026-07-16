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
  it('replaces a full terminal suffix word with its USPS abbreviation', () => {
    expect(normalizeStreetSuffixes('1234 CONNER STREET')).toBe('1234 CONNER ST');
  });
  it('replaces terminal LANE with LN', () => {
    expect(normalizeStreetSuffixes('SMITH LANE')).toBe('SMITH LN');
  });
  it('does not touch a suffix word embedded inside a longer word', () => {
    expect(normalizeStreetSuffixes('LANEWOOD DR')).toBe('LANEWOOD DR');
  });
  it('leaves already-abbreviated input unchanged', () => {
    expect(normalizeStreetSuffixes('1234 CONNER ST')).toBe('1234 CONNER ST');
  });
  it('only normalizes the final token, leaving suffix-like name words alone', () => {
    expect(normalizeStreetSuffixes('RIDGE POINT DRIVE')).toBe('RIDGE POINT DR');
    expect(normalizeStreetSuffixes('TERRACE PARK BLVD')).toBe('TERRACE PARK BLVD');
  });
  it('normalizes every suffix in the map when terminal', () => {
    const pairs: Array<[string, string]> = [
      ['STREET', 'ST'], ['LANE', 'LN'], ['DRIVE', 'DR'], ['ROAD', 'RD'],
      ['COURT', 'CT'], ['CIRCLE', 'CIR'], ['AVENUE', 'AVE'], ['BOULEVARD', 'BLVD'],
      ['PLACE', 'PL'], ['TRAIL', 'TRL'], ['PARKWAY', 'PKWY'], ['TERRACE', 'TER'],
      ['HIGHWAY', 'HWY'], ['SQUARE', 'SQ'], ['POINT', 'PT'], ['CROSSING', 'XING'],
      ['RIDGE', 'RDG'], ['COMMONS', 'CMNS'],
    ];
    for (const [full, abbr] of pairs) {
      expect(normalizeStreetSuffixes(`123 OAK ${full}`)).toBe(`123 OAK ${abbr}`);
    }
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
  it('matches either variant when a normalized alternative differs from the raw term', () => {
    const url = new URL(buildQueryUrl('1234 CONNER STREET', '1234 CONNER ST'));
    const where = url.searchParams.get('where')!;
    expect(where).toContain("(UPPER(LOCADDRESS) LIKE '%1234 CONNER STREET%' OR UPPER(LOCADDRESS) LIKE '%1234 CONNER ST%')");
    expect(where).toContain("TAXDISTNAM) LIKE '%NOBLESVILLE%'");
  });
  it('keeps the single-condition clause when the normalized term is identical', () => {
    const url = new URL(buildQueryUrl('1234 CONNER ST', '1234 CONNER ST'));
    const where = url.searchParams.get('where')!;
    expect(where.match(/LOCADDRESS/g)).toHaveLength(1);
    expect(where.match(/'/g)).toHaveLength(4);
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
  it('queries both the raw term and the suffix-normalized term when they differ', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ features: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await searchParcels('1234 conner street');
    const calledUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const where = calledUrl.searchParams.get('where')!;
    expect(where).toContain("LIKE '%1234 CONNER STREET%'");
    expect(where).toContain("LIKE '%1234 CONNER ST%'");
    // Two LOCADDRESS LIKE patterns + the district filter = 6 delimiting quotes.
    expect(where.match(/'/g)).toHaveLength(6);
  });
  it('keeps a single LOCADDRESS condition when normalization is a no-op', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ features: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await searchParcels('1234 conner st');
    const calledUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const where = calledUrl.searchParams.get('where')!;
    expect(where.match(/LOCADDRESS/g)).toHaveLength(1);
    expect(where.match(/'/g)).toHaveLength(4);
  });
  it('sanitizes injection attempts even when the OR-variant clause is used', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ features: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await searchParcels(`123' OR 1=1;-- main street`);
    const calledUrl = new URL(String(fetchMock.mock.calls[0][0]));
    const where = calledUrl.searchParams.get('where')!;
    expect(where).toContain("LIKE '%123 OR 11-- MAIN STREET%'");
    expect(where).toContain("LIKE '%123 OR 11-- MAIN ST%'");
    // The only single quotes allowed are the six that delimit the three LIKE
    // patterns; none of the caller's quotes may survive into the clause.
    expect(where.match(/'/g)).toHaveLength(6);
  });
});
