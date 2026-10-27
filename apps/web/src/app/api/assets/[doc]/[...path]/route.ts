import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { notFound, route } from '@/lib/http';
import { resolveInDocument } from '@study/core';

const TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

type Ctx = { params: Promise<{ doc: string; path: string[] }> };

/** Serves library/<doc>/assets/* (content-hashed names, so cache forever). */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { doc, path: parts } = await params;

  if (parts[0] !== 'assets') notFound('Asset');
  const file = resolveInDocument(doc, parts.join('/'));

  await stat(file);
  const ext = path.extname(file).toLowerCase();

  return new Response(new Uint8Array(await readFile(file)), {
    headers: {
      'cache-control': 'public, max-age=31536000, immutable',
      'content-type': TYPES[ext] ?? 'application/octet-stream',
      // SVGs from imported books must never run scripts.
      ...(ext === '.svg' ? { 'content-security-policy': "script-src 'none'" } : {}),
    },
  });
});
