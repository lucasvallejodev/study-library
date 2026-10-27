'use client';

import { useCallback, useEffect, useState } from 'react';

import type { ImportJob, ImportReport } from './import-types';

const POLL_INTERVAL_MS = 1000;

async function fetchJobs(): Promise<ImportJob[] | undefined> {
  const response = await fetch('/api/import/jobs', { cache: 'no-store' });

  return response.ok ? ((await response.json()) as ImportJob[]) : undefined;
}

async function fetchReport(jobId: number): Promise<ImportReport | null> {
  const response = await fetch(`/api/import/jobs/${jobId}`);
  const job = (await response.json()) as ImportJob;

  return job.report ?? null;
}

function hasActiveJob(jobs: ImportJob[]): boolean {
  return jobs.some(job => job.status === 'queued' || job.status === 'running');
}

export function useImportJobs(): { jobs: ImportJob[]; refresh: () => Promise<void> } {
  const [jobs, setJobs] = useState<ImportJob[]>([]);

  const refresh = useCallback(
    () =>
      fetchJobs().then(latest => {
        if (latest) setJobs(latest);
      }),
    []
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const active = hasActiveJob(jobs);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [active, refresh]);

  return { jobs, refresh };
}

export function useImportReports(
  jobs: ImportJob[],
  expandedId: number | undefined
): Record<number, ImportReport | null> {
  const [reports, setReports] = useState<Record<number, ImportReport | null>>({});

  useEffect(() => {
    if (expandedId === undefined || reports[expandedId] !== undefined) return;
    const job = jobs.find(candidate => candidate.id === expandedId);

    if (job?.status !== 'done') return;

    void fetchReport(expandedId).then(report => {
      setReports(loaded => ({ ...loaded, [expandedId]: report }));
    });
  }, [expandedId, jobs, reports]);

  return reports;
}
