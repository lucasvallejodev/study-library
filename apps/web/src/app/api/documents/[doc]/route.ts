import { rm } from "node:fs/promises";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { documentDir } from "@study/core";
import { getDb, t } from "@/lib/db";
import { documentProgress, getDocument } from "@/lib/data";
import { HttpError, route } from "@/lib/http";

type Ctx = { params: Promise<{ doc: string }> };

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { doc: id } = await params;
  const doc = await getDocument(id);
  const progress = await documentProgress(id);
  const counts = await getDb()
    .select({ chapterId: t.annotations.chapterId, n: sql<number>`count(*)::int` })
    .from(t.annotations)
    .where(eq(t.annotations.documentId, id))
    .groupBy(t.annotations.chapterId);
  return NextResponse.json({
    ...doc,
    chapters: doc.chapters.map((c) => ({
      ...c,
      percent: progress.find((p) => p.chapterId === c.id)?.percent ?? 0,
      annotationCount: counts.find((x) => x.chapterId === c.id)?.n ?? 0,
    })),
  });
});

/** DELETE /api/documents/:doc?force=1 — refuses while annotations exist unless forced. */
export const DELETE = route(async (req: Request, { params }: Ctx) => {
  const { doc: id } = await params;
  await getDocument(id);
  const force = new URL(req.url).searchParams.get("force") === "1";
  const db = getDb();
  const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(t.annotations).where(eq(t.annotations.documentId, id))) as [{ n: number }];
  if (n > 0 && !force) throw new HttpError(409, `${id} has ${n} annotations. Export them first (lib export ${id}) or pass force=1.`);
  await db.delete(t.annotations).where(eq(t.annotations.documentId, id));
  await db.delete(t.readingProgress).where(eq(t.readingProgress.documentId, id));
  await db.delete(t.documents).where(eq(t.documents.id, id));
  await rm(documentDir(id), { recursive: true, force: true });
  return NextResponse.json({ deleted: id, annotationsDeleted: n });
});
