import { NextResponse } from 'next/server';

import { deleteAnnotation, getAnnotation, toAnnotation, updateAnnotation } from '@/lib/data';
import { route } from '@/lib/http';
import { AnnotationPatchSchema } from '@study/core';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const row = await getAnnotation(id);

  return NextResponse.json(toAnnotation(row));
});

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const patch = AnnotationPatchSchema.parse(await req.json());
  const row = await updateAnnotation(id, patch);

  return NextResponse.json(toAnnotation(row));
});

export const DELETE = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;

  await deleteAnnotation(id);

  return NextResponse.json({ deleted: id });
});
