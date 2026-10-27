import { NextResponse } from "next/server";
import { indexDocument, reindexLibrary } from "@study/core/db";
import { getDb } from "@/lib/db";
import { getDocument } from "@/lib/data";
import { route } from "@/lib/http";

/** POST /api/reindex {doc?} — rebuild DB rows from library/ (annotations untouched). */
export const POST = route(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { doc?: string };
  if (body.doc) {
    await getDocument(body.doc);
    await indexDocument(getDb(), body.doc);
    return NextResponse.json({ indexed: [body.doc], removed: [] });
  }
  return NextResponse.json(await reindexLibrary(getDb()));
});
