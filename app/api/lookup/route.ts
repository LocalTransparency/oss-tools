import { NextResponse } from 'next/server';
import { sanitizeSearchTerm, searchParcels } from '@/lib/lookup/arcgis';

export const dynamic = 'force-dynamic';

// Privacy: this route intentionally never logs the query or the results.
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('q') ?? '';
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
