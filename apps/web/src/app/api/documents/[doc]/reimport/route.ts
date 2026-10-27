import { NextResponse } from 'next/server';

import { getDocument } from '@/lib/data';
import { route } from '@/lib/http';
import { enqueueJob } from '@/lib/jobs';

type Ctx = { params: Promise<{ doc: string }> };

export const POST = route(async (_req: Request, { params }: Ctx) => {
  const { doc } = await params;

  await getDocument(doc);
  const job = await enqueueJob({ input: doc, inputType: 'reimport' });

  return NextResponse.json(job, { status: 202 });
});
