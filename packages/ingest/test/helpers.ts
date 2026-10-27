import { existsSync } from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { Fetcher } from '../src/url';

export const repo = path.resolve(import.meta.dirname, '../../..');
import { readdirSync } from 'node:fs';

export const sample = (prefix: string) =>
  path.join(
    repo,
    'samples',
    readdirSync(path.join(repo, 'samples')).find(f => f.startsWith(prefix))!
  );

export async function useTempLibrary(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'study-test-lib-'));

  process.env.LIBRARY_DIR = dir;

  return dir;
}

/** Serves fixtures/images/<name>.png for any URL ending in <name>.png; everything else 404s. */
export const fixtureFetcher: Fetcher = async url => {
  const name = new URL(url).pathname.split('/').pop() ?? '';
  const file = path.join(repo, 'fixtures/images', name);

  if (existsSync(file)) {
    return {
      body: await readFile(file),
      contentType: 'image/png',
      ok: true,
      status: 200,
    };
  }

  return {
    body: Buffer.alloc(0),
    contentType: '',
    ok: false,
    status: 404,
  };
};
