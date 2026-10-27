import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { notFound, route } from '@/lib/http';
import { resolveInDocument } from '@study/core';

const ImageContentTypes: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const ASSETS_FOLDER = 'assets';
const FALLBACK_CONTENT_TYPE = 'application/octet-stream';
const CACHE_FOREVER_SINCE_NAMES_ARE_CONTENT_HASHED = 'public, max-age=31536000, immutable';
const NoScriptsInImportedSvg = { 'content-security-policy': "script-src 'none'" };

type Ctx = { params: Promise<{ doc: string; path: string[] }> };

const assetHeaders = (extension: string): Record<string, string> => ({
  'cache-control': CACHE_FOREVER_SINCE_NAMES_ARE_CONTENT_HASHED,
  'content-type': ImageContentTypes[extension] ?? FALLBACK_CONTENT_TYPE,
  ...(extension === '.svg' ? NoScriptsInImportedSvg : {}),
});

export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { doc, path: parts } = await params;

  if (parts[0] !== ASSETS_FOLDER) notFound('Asset');

  const file = resolveInDocument(doc, parts.join('/'));

  await stat(file);

  const extension = path.extname(file).toLowerCase();

  return new Response(new Uint8Array(await readFile(file)), { headers: assetHeaders(extension) });
});
