import { NextResponse } from 'next/server';

import { createSession, listSessions } from '@/lib/data';
import { parseSince, route } from '@/lib/http';
import { StudySessionInputSchema } from '@study/core';

export const dynamic = 'force-dynamic';

/** GET /api/sessions?doc=&chapter=&since=14d */
export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;

  const rows = await listSessions({
    chapterId: p.get('chapter') ?? undefined,
    documentId: p.get('doc') ?? undefined,
    since: parseSince(p.get('since')),
  });

  return NextResponse.json(rows);
});

export const POST = route(async (req: Request) => {
  const input = StudySessionInputSchema.parse(await req.json());

  return NextResponse.json(await createSession(input), { status: 201 });
});
