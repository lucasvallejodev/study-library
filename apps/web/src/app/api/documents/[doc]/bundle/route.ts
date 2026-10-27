import { NextResponse } from 'next/server';

import { BundleInputSchema, readBundle, writeBundle } from '@/lib/bundle';
import { getDocument } from '@/lib/data';
import { route } from '@/lib/http';

type Ctx = { params: Promise<{ doc: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { doc } = await params;

  await getDocument(doc);

  return NextResponse.json(await readBundle(doc));
});

export const PUT = route(async (req: Request, { params }: Ctx) => {
  const { doc } = await params;

  await getDocument(doc);
  const updated = await writeBundle(doc, BundleInputSchema.parse(await req.json()));

  return NextResponse.json({ chapters: updated.chapters.length, ok: true });
});
