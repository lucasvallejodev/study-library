import { NextResponse } from 'next/server';

import { createAnnotation, listAnnotations, toAnnotation } from '@/lib/data';
import { parseSince, route } from '@/lib/http';
import { NewAnnotationSchema } from '@study/core';

export const dynamic = 'force-dynamic';

/** GET /api/annotations?doc=&chapter=&type=highlight,note&color=&tag=&since=7d&q=&free=1 */
export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;

  const rows = await listAnnotations({
    chapterId: p.get('chapter') ?? undefined,
    color: p.get('color') ?? undefined,
    documentId: p.get('doc') ?? undefined,
    free: p.get('free') === '1',
    limit: p.get('limit') ? Number(p.get('limit')) : undefined,
    q: p.get('q') ?? undefined,
    since: parseSince(p.get('since')),
    tag: p.get('tag') ?? undefined,
    type: p.get('type') ?? undefined,
  });

  return NextResponse.json(rows.map(toAnnotation));
});

/** POST /api/annotations — selectors from the reader, or `quote` from CLI/AI callers. */
export const POST = route(async (req: Request) => {
  const input = NewAnnotationSchema.parse(await req.json());
  const row = await createAnnotation(input);

  return NextResponse.json(toAnnotation(row), { status: 201 });
});
