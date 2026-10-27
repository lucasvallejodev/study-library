import { NextResponse } from "next/server";
import { NewAnnotationSchema } from "@study/core";
import { createAnnotation, listAnnotations, toAnnotation } from "@/lib/data";
import { parseSince, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/annotations?doc=&chapter=&type=highlight,note&color=&tag=&since=7d&q=&free=1 */
export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const rows = await listAnnotations({
    documentId: p.get("doc") ?? undefined,
    chapterId: p.get("chapter") ?? undefined,
    type: p.get("type") ?? undefined,
    color: p.get("color") ?? undefined,
    tag: p.get("tag") ?? undefined,
    since: parseSince(p.get("since")),
    q: p.get("q") ?? undefined,
    free: p.get("free") === "1",
    limit: p.get("limit") ? Number(p.get("limit")) : undefined,
  });
  return NextResponse.json(rows.map(toAnnotation));
});

/** POST /api/annotations — selectors from the reader, or `quote` from CLI/AI callers. */
export const POST = route(async (req: Request) => {
  const input = NewAnnotationSchema.parse(await req.json());
  const row = await createAnnotation(input);
  return NextResponse.json(toAnnotation(row), { status: 201 });
});
