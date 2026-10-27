import 'server-only';

import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  type Annotation,
  type ChapterEntry,
  chapterRoute,
  documentDir,
  documentExists,
  libraryDir,
  type LibraryDocument,
  readDocument,
} from '@study/core';

import { type AnnotationRow, listAnnotations, toAnnotation } from './annotations';
import { flattenLineBreaks, indentContinuationLines } from './patterns';
import { listSessions, type SessionRow } from './sessions';

/** Where {@link exportDocumentAnnotations} wrote a document's backup. */
export type AnnotationExport = {
  count: number;
  json: string;
  markdown: string;
};

/** Where {@link exportNotebookNotes} wrote the free notes. */
export type NotebookExport = {
  count: number;
  json: string;
};

type StoredQuestion = SessionRow['questions'][number];

const EXPORT_ANNOTATION_LIMIT = 100_000;
const EXPORT_SESSION_LIMIT = 10_000;
const JSON_INDENT = 2;
const ISO_DATE_LENGTH = 10;
const PERCENT = 100;
const LIST_ITEM_INDENT = '  ';
const SEPARATOR = ' · ';

const JsonFileName = 'annotations.json';
const MarkdownFileName = 'annotations.md';
const NotebookFileName = 'notebook-notes.json';

const toJsonText = (value: unknown): string => `${JSON.stringify(value, null, JSON_INDENT)}\n`;

const optionalPart = (value: boolean | string | null | undefined, text: string): string =>
  value ? `${SEPARATOR}${text}` : '';

const hashtags = (tags: string[]): string => tags.map(tag => `#${tag}`).join(' ');

const annotationSummaryLine = (docId: string, chapterId: string, row: AnnotationRow): string => {
  const link = chapterRoute(docId, chapterId, row.id);
  const color = optionalPart(row.color, row.color ?? '');
  const tags = optionalPart(row.tags.length > 0, hashtags(row.tags));
  const orphaned = optionalPart(row.orphaned, 'orphaned');

  return `- **${row.type}**${color}${tags}${SEPARATOR}[link](${link})${orphaned}`;
};

const annotationLines = (docId: string, chapterId: string, row: AnnotationRow): string[] => {
  const lines = [annotationSummaryLine(docId, chapterId, row)];

  if (row.quote) lines.push('', `${LIST_ITEM_INDENT}> ${flattenLineBreaks(row.quote)}`);

  if (row.body) {
    lines.push('', `${LIST_ITEM_INDENT}${indentContinuationLines(row.body, LIST_ITEM_INDENT)}`);
  }

  lines.push('');

  return lines;
};

const chapterSection = (docId: string, chapter: ChapterEntry, rows: AnnotationRow[]): string[] => {
  const items = rows.filter(row => row.chapterId === chapter.id);

  if (!items.length) return [];

  return [
    `## ${chapter.title}`,
    '',
    ...items.flatMap(row => annotationLines(docId, chapter.id, row)),
  ];
};

const documentNotesSection = (rows: AnnotationRow[]): string[] => {
  const notes = rows.filter(row => !row.chapterId);

  if (!notes.length) return [];

  return ['## Document notes', '', ...notes.flatMap(row => [`- ${row.body ?? ''}`, ''])];
};

const scorePercent = (score: number): string => `score ${Math.round(score * PERCENT)}%`;

const sessionHeading = (session: SessionRow): string => {
  const date = session.createdAt.toISOString().slice(0, ISO_DATE_LENGTH);
  const chapter = optionalPart(session.chapterId, session.chapterId ?? '');
  const score = session.score == null ? '' : `${SEPARATOR}${scorePercent(session.score)}`;

  return `### ${date}${SEPARATOR}${session.kind}${chapter}${score}`;
};

const answerMark = (correct: boolean | undefined): string => {
  if (correct === false) return '✗';

  return correct ? '✓' : '•';
};

const questionLine = (question: StoredQuestion): string => {
  const answer = question.answer ? `\n  - Answer: ${question.answer}` : '';
  const feedback = question.feedback ? `\n  - Feedback: ${question.feedback}` : '';

  return `- ${answerMark(question.correct)} ${question.question}${answer}${feedback}`;
};

const sessionLines = (session: SessionRow): string[] => [
  sessionHeading(session),
  '',
  ...(session.summary ? [session.summary, ''] : []),
  ...session.questions.map(questionLine),
  '',
];

const studySessionsSection = (sessions: SessionRow[]): string[] => {
  if (!sessions.length) return [];

  return ['## Study sessions', '', ...sessions.flatMap(sessionLines)];
};

const annotationsMarkdown = (
  doc: LibraryDocument,
  rows: AnnotationRow[],
  sessions: SessionRow[],
  exportedAt: string
): string => {
  const lines = [
    `# ${doc.title} — annotations`,
    '',
    `Exported ${exportedAt}`,
    '',
    ...doc.chapters.flatMap(chapter => chapterSection(doc.id, chapter, rows)),
    ...documentNotesSection(rows),
    ...studySessionsSection(sessions),
  ];

  return `${lines.join('\n')}\n`;
};

const serializeSession = (
  session: SessionRow
): Omit<SessionRow, 'createdAt'> & { createdAt: string } => ({
  ...session,
  createdAt: session.createdAt.toISOString(),
});

/**
 * Backs up a document's annotations and study history into its library folder.
 *
 * @remarks
 * Writes `annotations.json` (machine-readable, oldest annotation first) and `annotations.md`
 * (grouped by chapter, then document notes, then study sessions).
 *
 * @param docId - Document slug.
 * @returns How many annotations were exported and the paths of both files.
 */
export const exportDocumentAnnotations = async (docId: string): Promise<AnnotationExport> => {
  const doc = await readDocument(docId);
  const rows = await listAnnotations({ documentId: docId, limit: EXPORT_ANNOTATION_LIMIT });
  const annotations = rows.toReversed();
  const sessions = await listSessions({ documentId: docId, limit: EXPORT_SESSION_LIMIT });
  const exportedAt = new Date().toISOString();
  const dir = documentDir(docId);
  const jsonPath = path.join(dir, JsonFileName);
  const markdownPath = path.join(dir, MarkdownFileName);

  const json = {
    annotations: annotations.map(toAnnotation),
    documentId: docId,
    exportedAt,
    studySessions: sessions.map(serializeSession),
  };

  await writeFile(jsonPath, toJsonText(json));
  await writeFile(markdownPath, annotationsMarkdown(doc, annotations, sessions, exportedAt));

  return {
    count: annotations.length,
    json: jsonPath,
    markdown: markdownPath,
  };
};

/**
 * Lists every free note (annotations attached to no document) for the notebook backup.
 *
 * @returns The notes in API shape, newest first.
 */
export const exportFreeNotes = async (): Promise<Annotation[]> => {
  const notes = await listAnnotations({ free: true, limit: EXPORT_ANNOTATION_LIMIT });

  return notes.map(toAnnotation);
};

/**
 * Backs up every free note into `notebook-notes.json` at the root of the library.
 *
 * @returns How many notes were exported and the path of the file.
 */
export const exportNotebookNotes = async (): Promise<NotebookExport> => {
  const notes = await exportFreeNotes();
  const jsonPath = path.join(libraryDir(), NotebookFileName);

  await writeFile(jsonPath, toJsonText({ exportedAt: new Date().toISOString(), notes }));

  return { count: notes.length, json: jsonPath };
};

export { documentExists };
