export type JsonValue =
  boolean | JsonValue[] | null | number | string | { [key: string]: JsonValue };

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

export type ImportJob = {
  documentId: string | null;
  error: string | null;
  id: number;
  log: string;
  report?: ImportReport | null;
  status: string;
};

export type AnnotationSelector = {
  exact?: string;
  type: string;
};

export type Annotation = {
  body: string | null;
  chapterId: string | null;
  color: string | null;
  createdAt: string;
  documentId: string | null;
  id: string;
  orphaned: boolean;
  selectors: AnnotationSelector[];
  tags: string[];
  type: string;
};

export type DocumentBundle = {
  assets: string[];
  document: JsonValue;
  files: Record<string, string>;
  report: JsonValue;
};

export type ChapterFileEntry = { file: string };

export type EditableDocument = { chapters: ChapterFileEntry[] };

export type BundleUpdateResult = { chapters: number; ok: boolean };

export type HealthStatus = { ok: boolean };

export type StudySessionFile = Record<string, JsonValue> & { chapterId?: string | null };
