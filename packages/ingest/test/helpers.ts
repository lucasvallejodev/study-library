import { existsSync } from 'node:fs';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { Fetcher } from '../src/url';

export const repo = path.resolve(import.meta.dirname, '../../..');

export async function useTempLibrary(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'study-test-lib-'));

  process.env.LIBRARY_DIR = dir;

  return dir;
}

export const fixtureImageFetcherWith404Fallback: Fetcher = async url => {
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
