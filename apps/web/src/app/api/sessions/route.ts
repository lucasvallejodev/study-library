import { NextResponse } from "next/server";
import { StudySessionInputSchema } from "@study/core";
import { createSession, listSessions } from "@/lib/data";
import { parseSince, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/sessions?doc=&chapter=&since=14d */
export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const rows = await listSessions({
    documentId: p.get("doc") ?? undefined,
    chapterId: p.get("chapter") ?? undefined,
    since: parseSince(p.get("since")),
  });
  return NextResponse.json(rows);
});

export const POST = route(async (req: Request) => {
  const input = StudySessionInputSchema.parse(await req.json());
  return NextResponse.json(await createSession(input), { status: 201 });
});
