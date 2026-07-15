import { NextResponse } from 'next/server';
import { sanitizeSearchTerm, searchParcels } from '@/lib/lookup/arcgis';

export const dynamic = 'force-dynamic';

// Privacy: this route intentionally never logs the query or the results.
// It is a POST (not a GET with a ?q= query string) because hosting access
// logs record request URLs — including GET query strings — but request
// bodies are not access-logged, which is what lets us promise that no
// addresses or lookups are stored.
export async function POST(request: Request) {
  const { q } = (await request.json().catch(() => null)) ?? {};
  const raw = typeof q === 'string' ? q : '';
  const term = sanitizeSearchTerm(raw);
  if (term.length < 4) {
    return NextResponse.json({ error: 'query-too-short' }, { status: 400 });
  }
  try {
    const candidates = await searchParcels(term);
    return NextResponse.json({ candidates });
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }
}
