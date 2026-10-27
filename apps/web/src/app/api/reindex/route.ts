import { NextResponse } from 'next/server';

import { getDocument } from '@/lib/data';
import { getDb } from '@/lib/db';
import { route } from '@/lib/http';
import { readOptionalJson } from '@/lib/search-params';
import { indexDocument, reindexLibrary } from '@study/core/db';

type ReindexRequest = { doc?: string };

const reindexOneDocument = async (docId: string): Promise<Response> => {
  await getDocument(docId);
  await indexDocument(getDb(), docId);

  return NextResponse.json({ indexed: [docId], removed: [] });
};

export const POST = route(async (req: Request) => {
  const { doc } = await readOptionalJson<ReindexRequest>(req);

  if (doc) return reindexOneDocument(doc);

  return NextResponse.json(await reindexLibrary(getDb()));
});
