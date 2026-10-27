import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { documentDir } from "@study/core";
import { notFound, route } from "@/lib/http";
import { getJob } from "@/lib/jobs";

type Ctx = { params: Promise<{ id: string }> };

/** Job status; once done, includes the document's import report. */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const job = await getJob(Number(id));
  if (!job) notFound(`Job ${id}`);
  let report = null;
  if (job.status === "done" && job.documentId) {
    const file = path.join(documentDir(job.documentId), "import-report.json");
    if (existsSync(file)) report = JSON.parse(await readFile(file, "utf8"));
  }
  return NextResponse.json({ ...job, report });
});
