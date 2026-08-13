import { NextResponse } from 'next/server';
import { sanitizeSearchTerm, type EnrichedParcelCandidate, type ParcelCandidate } from '@/lib/lookup/arcgis';
import { COUNTY_SOURCES } from '@/lib/lookup/counties';
import { getCached, setCached } from '@/lib/lookup/cache';
import { inferCapClass } from '@/lib/tax/indiana/capClass';

export const dynamic = 'force-dynamic';

// Privacy: this route intentionally never logs the query or the results.
// It is a POST (not a GET with a ?q= query string) because hosting access
// logs record request URLs — including GET query strings — but request
// bodies are not access-logged, which is what lets us promise that no
// addresses or lookups are stored.
//
// Successful lookups are cached in memory (see lib/lookup/cache.ts) to cut
// down on repeat calls to the county service during busy periods — never
// written to disk or logs. Errors are never cached, so a transient upstream
// failure doesn't get "stuck" for other visitors searching the same term.
export async function POST(request: Request) {
  const { q } = (await request.json().catch(() => null)) ?? {};
  const raw = typeof q === 'string' ? q : '';
  const term = sanitizeSearchTerm(raw);
  if (term.length < 4) {
    return NextResponse.json({ error: 'query-too-short' }, { status: 400 });
  }

  let candidates: ParcelCandidate[];
  const cached = getCached(term);
  if (cached) {
    candidates = cached;
  } else {
    try {
      candidates = await COUNTY_SOURCES.hamilton.search(term);
    } catch (err) {
      // searchParcels (lib/lookup/arcgis.ts) collapses network failure,
      // non-200, timeout, and response-body read failure into
      // Error('upstream') — the county service, or the network path to it,
      // is genuinely unavailable. Anything else thrown out of search (e.g. a
      // regression in parseResponse) is OUR bug, not the county's, and must
      // not be reported under the same identity — a real parsing defect
      // should never be indistinguishable from a county outage.
      if (err instanceof Error && err.message === 'upstream') {
        return NextResponse.json({ error: 'upstream' }, { status: 502 });
      }
      return NextResponse.json({ error: 'internal' }, { status: 500 });
    }
    setCached(term, candidates);
  }

  // Enrichment runs on both the cache-hit and cache-miss path, and both must
  // fail identically: a throw here is our bug (the cache-hit path used to
  // leave this uncaught, surfacing a raw framework 500 while the cache-miss
  // path returned a friendly 502 for the exact same failure). It is never
  // reported as 'upstream' — a cache hit makes no county call this request,
  // so blaming the county would be misleading.
  try {
    return NextResponse.json({ candidates: candidates.map(withCapClassInference) });
  } catch {
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

// Enriches a raw parcel candidate with a best-guess constitutional cap class
// (see lib/tax/indiana/capClass.ts) so the UI can pre-fill it. This is a
// derived, deterministic view computed at response time — the cache above
// still stores plain ParcelCandidate values, never the enriched shape.
function withCapClassInference(c: ParcelCandidate): EnrichedParcelCandidate {
  const inference = inferCapClass({
    homesteadCode: c.homesteadCode,
    propertyClass: c.propertyClass,
    assessmentYear: c.assessmentYear,
  });
  return {
    ...c,
    capClass: inference.capClass,
    capClassConfidence: inference.confidence,
    capClassReason: inference.reason,
  };
}
