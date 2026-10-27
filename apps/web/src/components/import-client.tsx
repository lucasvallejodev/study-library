'use client';

import { useRef, useState } from 'react';

import { errorMessageOf, postJson } from '@/components/http';

import { ImportJobList } from './import/import-job-list';
import { useImportJobs, useImportReports } from './import/use-import-jobs';

const ACCEPTED_FILE_TYPES = '.epub,.mobi,.azw,.azw3,.prc,.html,.htm,.md';

export function ImportClient() {
  const { jobs, refresh } = useImportJobs();
  const [error, setError] = useState<string>();
  const [expandedId, setExpandedId] = useState<number>();
  const reports = useImportReports(jobs, expandedId);

  async function uploadFiles(files: FileList | File[]) {
    setError(undefined);

    for (const file of Array.from(files)) {
      const form = new FormData();

      form.append('file', file);
      const response = await fetch('/api/import', { body: form, method: 'POST' });

      if (!response.ok) setError(await errorMessageOf(response));
    }

    await refresh();
  }

  async function importUrl(url: string, clearUrl: () => void) {
    setError(undefined);
    const response = await postJson('/api/import', { url });

    if (!response.ok) setError(await errorMessageOf(response));
    else clearUrl();
    await refresh();
  }

  function toggleJob(jobId: number) {
    setExpandedId(expandedId === jobId ? undefined : jobId);
  }

  return (
    <>
      <DropZone onFiles={uploadFiles} />
      <UrlImportForm onImport={importUrl} />
      {error && (
        <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
      <h2 className="mt-10 text-xs font-semibold uppercase tracking-wider text-muted">
        Recent imports
      </h2>
      <ImportJobList jobs={jobs} reports={reports} expandedId={expandedId} onToggle={toggleJob} />
    </>
  );
}

function dropZoneClass(dragging: boolean): string {
  const state = dragging ? 'border-accent bg-panel' : 'border-line hover:border-accent';

  return `mt-8 cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition ${state}`;
}

function DropZone({ onFiles }: { onFiles: (files: FileList) => Promise<void> }) {
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function onDragOver(event: React.DragEvent) {
    event.preventDefault();
    setDragging(true);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    void onFiles(event.dataTransfer.files);
  }

  function onChoose(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void onFiles(event.target.files);
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => fileInput.current?.click()}
      className={dropZoneClass(dragging)}
    >
      <p className="font-serif text-lg text-ink">Drop books here or click to choose</p>
      <p className="mt-1 text-sm text-muted">.epub · .mobi · .azw · .azw3 · .html · .md</p>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={onChoose}
      />
    </div>
  );
}

type UrlImportFormProps = { onImport: (url: string, clearUrl: () => void) => Promise<void> };

function UrlImportForm({ onImport }: UrlImportFormProps) {
  const [url, setUrl] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await onImport(url, () => setUrl(''));
  }

  return (
    <form onSubmit={submit} className="mt-4 flex gap-2">
      <input
        type="url"
        required
        value={url}
        onChange={event => setUrl(event.target.value)}
        placeholder="https://example.com/an-article-worth-studying"
        className="flex-1 rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-accent"
      />
      <button className="rounded-md bg-accent px-4 py-2 text-white">Import URL</button>
    </form>
  );
}
