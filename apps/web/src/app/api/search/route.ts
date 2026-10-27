import { NextResponse } from 'next/server';

import { search, toAnnotation } from '@/lib/data';
import { badRequest, route } from '@/lib/http';
import { searchParamsOf } from '@/lib/search-params';

export const dynamic = 'force-dynamic';

const requiredSearchText = (params: URLSearchParams): string => {
  const text = params.get('q')?.trim();

  if (!text) return badRequest('Missing q');

  return text;
};

export const GET = route(async (req: Request) => {
  const text = requiredSearchText(searchParamsOf(req));
  const results = await search(text);

  return NextResponse.json({ ...results, notes: results.notes.map(toAnnotation) });
});
