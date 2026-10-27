import { open } from 'node:fs/promises';

import { run } from './tools';

/**
 * Mobipocket/KF8 files are PalmDB containers; record 0 holds the MOBI header whose
 * bytes 12-13 are the encryption type (0 = none). Non-zero means DRM.
 *
 * @param file
 */
export const isMobiEncrypted = async (file: string): Promise<boolean> => {
  const fh = await open(file, 'r');

  try {
    const header = Buffer.alloc(86);

    await fh.read(header, 0, 86, 0);
    const kind = header.toString('latin1', 60, 68);

    if (!/BOOKMOBI|TEXtREAd/.test(kind)) return false;
    const record0 = header.readUInt32BE(78);
    const rec = Buffer.alloc(16);

    await fh.read(rec, 0, 16, record0);

    return rec.readUInt16BE(12) !== 0;
  } finally {
    await fh.close();
  }
};

/**
 * Convert MOBI/AZW/AZW3 to EPUB with Calibre's ebook-convert.
 *
 * @param input
 * @param output
 */
export const convertToEpub = async (input: string, output: string): Promise<void> => {
  if (await isMobiEncrypted(input)) {
    throw new Error(
      'This Kindle file is DRM-protected and cannot be imported. Only DRM-free books are supported.'
    );
  }

  const res = await run('ebook-convert', [input, output], undefined, 10 * 60_000);

  if (res.code !== 0) {
    throw new Error(
      `ebook-convert failed: ${(res.stderr || res.stdout).trim().split('\n').slice(-5).join('\n')}`
    );
  }
};
