import { NextResponse } from 'next/server';

import { createSession, listSessions, type SessionFilter } from '@/lib/data';
import { HttpStatus, parseSince, route } from '@/lib/http';
import { optionalParam, searchParamsOf } from '@/lib/search-params';
import { StudySessionInputSchema } from '@study/core';

export const dynamic = 'force-dynamic';

const parseSessionFilter = (params: URLSearchParams): SessionFilter => ({
  chapterId: optionalParam(params, 'chapter'),
  documentId: optionalParam(params, 'doc'),
  since: parseSince(params.get('since')),
});

export const GET = route(async (req: Request) => {
  const filter = parseSessionFilter(searchParamsOf(req));
  const rows = await listSessions(filter);

  return NextResponse.json(rows);
});

export const POST = route(async (req: Request) => {
  const input = StudySessionInputSchema.parse(await req.json());
  const session = await createSession(input);

  return NextResponse.json(session, { status: HttpStatus.created });
});
