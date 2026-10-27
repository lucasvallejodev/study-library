import { NextResponse } from 'next/server';
import { z } from 'zod';

import { saveProgress } from '@/lib/data';
import { route } from '@/lib/http';

const Body = z.object({
  chapterId: z.string(),
  documentId: z.string(),
  position: z.number(),
});

export const POST = route(async (req: Request) => {
  const body = Body.parse(await req.json());

  await saveProgress(body.documentId, body.chapterId, body.position);

  return NextResponse.json({ ok: true });
});
