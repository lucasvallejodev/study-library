import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';

import { getDocument } from '@/lib/data';
import {
  type AnnotationExport,
  exportDocumentAnnotations,
  exportNotebookNotes,
} from '@/lib/export';
import { route } from '@/lib/http';
import { readOptionalJson, searchParamsOf } from '@/lib/search-params';
import { listDocumentIds } from '@study/core';

type ExportRequest = { doc?: string };

type DownloadFormat = 'json' | 'md';

const FREE_NOTES_ID = '(free notes)';

const DownloadContentTypes: Record<DownloadFormat, string> = {
  json: 'application/json',
  md: 'text/markdown; charset=utf-8',
};

const documentIdsToExport = async (docId: string | undefined): Promise<string[]> =>
  docId ? [(await getDocument(docId)).id] : listDocumentIds();

type ExportResult = { id: string } & Partial<AnnotationExport>;

const exportDocuments = async (ids: string[]): Promise<ExportResult[]> => {
  const results: ExportResult[] = [];

  for (const id of ids) results.push({ id, ...(await exportDocumentAnnotations(id)) });

  return results;
};

const downloadFormat = (params: URLSearchParams): DownloadFormat =>
  params.get('format') === 'json' ? 'json' : 'md';

const exportFreeNotes = async (): Promise<ExportResult> => {
  const { count, json } = await exportNotebookNotes();

  return {
    count,
    id: FREE_NOTES_ID,
    json,
  };
};

const attachmentHeaders = (docId: string, format: DownloadFormat): Record<string, string> => ({
  'content-disposition': `attachment; filename="${docId}-annotations.${format}"`,
  'content-type': DownloadContentTypes[format],
});

export const POST = route(async (req: Request) => {
  const { doc } = await readOptionalJson<ExportRequest>(req);
  const ids = await documentIdsToExport(doc);
  const results = await exportDocuments(ids);

  if (!doc) results.push(await exportFreeNotes());

  return NextResponse.json(results);
});

export const GET = route(async (req: Request) => {
  const params = searchParamsOf(req);
  const doc = await getDocument(params.get('doc') ?? '');
  const format = downloadFormat(params);
  const files = await exportDocumentAnnotations(doc.id);
  const content = await readFile(format === 'md' ? files.markdown : files.json, 'utf8');

  return new Response(content, { headers: attachmentHeaders(doc.id, format) });
});
