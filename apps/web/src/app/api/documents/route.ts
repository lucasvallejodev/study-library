import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { listLibrary } from "@/lib/data";

export const dynamic = "force-dynamic";

/** GET /api/documents?chapters=1 — documents (and optionally their chapter lists). */
export const GET = route(async (req: Request) => {
  const withChapters = new URL(req.url).searchParams.get("chapters") === "1";
  const cards = await listLibrary();
  return NextResponse.json(
    cards.map(({ doc, percent, lastRead, annotationCount }) => ({
      id: doc.id,
      title: doc.title,
      authors: doc.authors,
      kind: doc.kind,
      chapterCount: doc.chapters.length,
      percent: Math.round(percent * 100) / 100,
      lastRead: lastRead?.toISOString() ?? null,
      annotationCount,
      ...(withChapters ? { chapters: doc.chapters.map(({ id, title, order, matter, wordCount }) => ({ id, title, order, matter, wordCount })) } : {}),
    })),
  );
});
