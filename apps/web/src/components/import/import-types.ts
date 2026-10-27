export type ImportWarning = {
  chapterId?: string;
  code: string;
  message: string;
};

export type ImportReport = {
  chapterCount: number;
  totalWords: number;
  warnings: ImportWarning[];
};

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export type ImportJob = {
  createdAt: string;
  documentId: string | null;
  error: string | null;
  id: number;
  input: string;
  inputType: string;
  log: string;
  originalName: string | null;
  report?: ImportReport | null;
  status: JobStatus;
};
