import { NextResponse } from 'next/server';

import { type AnnotationFilter, createAnnotation, listAnnotations, toAnnotation } from '@/lib/data';
import { HttpStatus, parseSince, route } from '@/lib/http';
import { isFlagSet, optionalNumberParam, optionalParam, searchParamsOf } from '@/lib/search-params';
import { NewAnnotationSchema } from '@study/core';

export const dynamic = 'force-dynamic';

const parseAnnotationFilter = (params: URLSearchParams): AnnotationFilter => ({
  chapterId: optionalParam(params, 'chapter'),
  color: optionalParam(params, 'color'),
  documentId: optionalParam(params, 'doc'),
  free: isFlagSet(params, 'free'),
  limit: optionalNumberParam(params, 'limit'),
  q: optionalParam(params, 'q'),
  since: parseSince(params.get('since')),
  tag: optionalParam(params, 'tag'),
  type: optionalParam(params, 'type'),
});

export const GET = route(async (req: Request) => {
  const filter = parseAnnotationFilter(searchParamsOf(req));
  const rows = await listAnnotations(filter);

  return NextResponse.json(rows.map(toAnnotation));
});

export const POST = route(async (req: Request) => {
  const input = NewAnnotationSchema.parse(await req.json());
  const row = await createAnnotation(input);

  return NextResponse.json(toAnnotation(row), { status: HttpStatus.created });
});
