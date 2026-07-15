const ENDPOINT =
  'https://services5.arcgis.com/beYj0ONLvCt8qxHA/arcgis/rest/services/Parcels_Current_Open_Data/FeatureServer/0/query';

const OUT_FIELDS = [
  'PARCELNO', 'STPRCLNO', 'LOCADDRESS', 'LOCCITY', 'LOCZIP',
  'AVTOTGROSS', 'AVTAXYR', 'HOMESTEAD', 'hmstd_code', 'TAXDISTCOD', 'TAXDISTNAM', 'PROPERTYREPORT',
].join(',');

export interface ParcelCandidate {
  parcelNo: string;
  stateParcelNo: string;
  address: string;
  city: string;
  zip: string;
  grossAV: number;
  assessmentYear: number;
  homestead: boolean;
  taxDistrictName: string;
  propertyReportUrl: string;
}

export function sanitizeSearchTerm(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9\s\-&]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildQueryUrl(term: string): string {
  const where =
    `UPPER(LOCADDRESS) LIKE '%${term}%' AND UPPER(TAXDISTNAM) LIKE '%NOBLESVILLE%'`;
  const params = new URLSearchParams({
    where,
    outFields: OUT_FIELDS,
    resultRecordCount: '10',
    returnGeometry: 'false',
    f: 'json',
  });
  return `${ENDPOINT}?${params}`;
}

// Observed convention (captured live in lib/lookup/fixtures/sample-response.json,
// Hamilton County Parcels_Current_Open_Data FeatureServer):
//   - hmstd_code is an integer: 1 when a homestead deduction is active, 0 otherwise.
//   - HOMESTEAD is a string that mirrors it: "Active" when active, null otherwise.
// hmstd_code is the more reliable field (always a number, never missing in the
// sample), so it is checked first; HOMESTEAD is a fallback for payload shapes where
// hmstd_code might be absent.
function isHomestead(attrs: Record<string, unknown>): boolean {
  const code = attrs.hmstd_code;
  if (typeof code === 'number') return code === 1;
  if (typeof code === 'string' && code.trim() !== '') return code.trim() === '1';

  const h = attrs.HOMESTEAD;
  if (typeof h === 'string') return h.trim().toUpperCase() === 'ACTIVE';

  return false;
}

export function parseResponse(json: unknown): ParcelCandidate[] {
  if (!json || typeof json !== 'object') return [];
  const features = (json as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((f) => {
    const attrs = (f as { attributes?: Record<string, unknown> }).attributes;
    if (!attrs) return [];
    const grossAV = Number(attrs.AVTOTGROSS);
    if (!Number.isFinite(grossAV)) return [];
    return [{
      parcelNo: String(attrs.PARCELNO ?? ''),
      stateParcelNo: String(attrs.STPRCLNO ?? ''),
      address: String(attrs.LOCADDRESS ?? ''),
      city: String(attrs.LOCCITY ?? ''),
      zip: String(attrs.LOCZIP ?? ''),
      grossAV,
      assessmentYear: Number(attrs.AVTAXYR) || 0,
      homestead: isHomestead(attrs),
      taxDistrictName: String(attrs.TAXDISTNAM ?? ''),
      propertyReportUrl: String(attrs.PROPERTYREPORT ?? ''),
    }];
  });
}

export async function searchParcels(term: string): Promise<ParcelCandidate[]> {
  // Defense-in-depth: sanitize here regardless of whether the caller already
  // did (sanitization is idempotent), so no raw input ever reaches the where
  // clause built by buildQueryUrl.
  const safe = sanitizeSearchTerm(term);
  let json: unknown;
  try {
    const res = await fetch(buildQueryUrl(safe), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('upstream');
    json = await res.json();
  } catch {
    // Non-200, network failure (DNS, connection refused), timeout abort, and
    // body/JSON read failures are all collapsed into the documented contract.
    throw new Error('upstream');
  }
  return parseResponse(json);
}
