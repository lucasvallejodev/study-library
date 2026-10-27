import { NextResponse } from 'next/server';

import { notFound, route } from '@/lib/http';
import { readImportReport } from '@/lib/import-report';
import { getJob, type JobRow } from '@/lib/jobs';
import type { ImportReport } from '@study/core';

type Ctx = { params: Promise<{ id: string }> };

const finishedJobReport = async (job: JobRow): Promise<ImportReport | null> =>
  job.status === 'done' && job.documentId ? readImportReport(job.documentId) : null;

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const job = await getJob(Number(id));

  if (!job) notFound(`Job ${id}`);

  const report = await finishedJobReport(job);

  return NextResponse.json({ ...job, report });
});
