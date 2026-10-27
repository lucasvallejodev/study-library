import { NextResponse } from 'next/server';

import { search, toAnnotation } from '@/lib/data';
import { HttpError, route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams.get('q')?.trim();

  if (!q) throw new HttpError(400, 'Missing q');
  const res = await search(q);

  return NextResponse.json({ ...res, notes: res.notes.map(toAnnotation) });
});
