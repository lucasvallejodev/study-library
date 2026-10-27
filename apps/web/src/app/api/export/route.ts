import { NextResponse } from 'next/server';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { getDocument } from '@/lib/data';
import { exportDocumentAnnotations, exportFreeNotes } from '@/lib/export';
import { route } from '@/lib/http';
import { libraryDir, listDocumentIds } from '@study/core';

/** POST /api/export {doc?} — writes annotations.json + annotations.md into each document folder. */
export const POST = route(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { doc?: string };
  const ids = body.doc ? [(await getDocument(body.doc)).id] : await listDocumentIds();
  const results = [];

  for (const id of ids) results.push({ id, ...(await exportDocumentAnnotations(id)) });

  if (!body.doc) {
    const free = await exportFreeNotes();
    const file = path.join(libraryDir(), 'notebook-notes.json');

    await writeFile(
      file,
      JSON.stringify({ exportedAt: new Date().toISOString(), notes: free }, null, 2) + '\n'
    );
    results.push({
      count: free.length,
      id: '(free notes)',
      json: file,
    });
  }

  return NextResponse.json(results);
});

/** GET /api/export?doc=&format=md|json — download a document's annotations. */
export const GET = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const doc = await getDocument(p.get('doc') ?? '');
  const out = await exportDocumentAnnotations(doc.id);
  const md = p.get('format') !== 'json';
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(md ? out.markdown : out.json, 'utf8');

  return new Response(content, {
    headers: {
      'content-disposition': `attachment; filename="${doc.id}-annotations.${md ? 'md' : 'json'}"`,
      'content-type': md ? 'text/markdown; charset=utf-8' : 'application/json',
    },
  });
});
