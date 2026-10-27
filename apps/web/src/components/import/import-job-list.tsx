import Link from 'next/link';

import type { ImportJob, ImportReport, JobStatus } from './import-types';

const MAX_LISTED_WARNINGS = 50;

const StatusStyles: Record<JobStatus, string> = {
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  queued: 'bg-panel text-muted',
  running: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
};

type JobListProps = {
  expandedId?: number;
  jobs: ImportJob[];
  onToggle: (jobId: number) => void;
  reports: Record<number, ImportReport | null>;
};

export function ImportJobList({ expandedId, jobs, onToggle, reports }: JobListProps) {
  return (
    <ul className="mt-3 divide-y divide-line border-y border-line">
      {jobs.length === 0 && <li className="py-4 text-sm text-muted">No imports yet.</li>}
      {jobs.map(job => (
        <ImportJobRow
          key={job.id}
          job={job}
          expanded={expandedId === job.id}
          report={reports[job.id]}
          onToggle={() => onToggle(job.id)}
        />
      ))}
    </ul>
  );
}

type JobRowProps = {
  expanded: boolean;
  job: ImportJob;
  onToggle: () => void;
  report?: ImportReport | null;
};

function ImportJobRow({ expanded, job, onToggle, report }: JobRowProps) {
  const showDetails = expanded || job.status === 'running';

  return (
    <li className="py-3 text-sm">
      <button onClick={onToggle} className="flex w-full items-center gap-3 text-left">
        <StatusBadge status={job.status} />
        <span className="flex-1 truncate">{job.originalName ?? job.input}</span>
        <span className="text-xs text-muted">{new Date(job.createdAt).toLocaleString()}</span>
      </button>
      {job.status === 'failed' && <p className="mt-2 text-red-600">{job.error}</p>}
      {job.status === 'done' && job.documentId && <OpenDocumentLink documentId={job.documentId} />}
      {showDetails && (
        <div className="mt-2 space-y-2">
          {report && <ReportSummary report={report} />}
          {job.log && (
            <pre className="max-h-48 overflow-auto rounded bg-panel p-3 text-xs text-muted">
              {job.log}
            </pre>
          )}
        </div>
      )}
    </li>
  );
}

function OpenDocumentLink({ documentId }: { documentId: string }) {
  return (
    <p className="mt-1">
      <Link href={`/read/${documentId}`} className="text-accent hover:underline">
        Open {documentId} →
      </Link>
    </p>
  );
}

function ReportSummary({ report }: { report: ImportReport }) {
  return (
    <div className="rounded bg-panel p-3">
      <p>
        {report.chapterCount} chapters · {report.totalWords.toLocaleString()} words ·{' '}
        {report.warnings.length} warnings
      </p>
      {report.warnings.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-muted">
          {report.warnings.slice(0, MAX_LISTED_WARNINGS).map((warning, index) => (
            <li key={index}>
              <code>{warning.code}</code> {warning.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`w-16 rounded-full px-2 py-0.5 text-center text-xs ${StatusStyles[status]}`}>
      {status}
    </span>
  );
}
