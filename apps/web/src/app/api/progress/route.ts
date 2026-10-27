import { NextResponse } from 'next/server';
import { z } from 'zod';

import { saveProgress } from '@/lib/data';
import { route } from '@/lib/http';

const ProgressBodySchema = z.object({
  chapterId: z.string(),
  documentId: z.string(),
  position: z.number(),
});

export const POST = route(async (req: Request) => {
  const { chapterId, documentId, position } = ProgressBodySchema.parse(await req.json());

  await saveProgress(documentId, chapterId, position);

  return NextResponse.json({ ok: true });
});
