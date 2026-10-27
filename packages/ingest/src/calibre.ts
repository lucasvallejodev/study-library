import { open } from 'node:fs/promises';

import { Patterns } from './patterns';
import { run } from './tools';

const PALM_DATABASE_HEADER_BYTES = 86;
const PALM_DATABASE_TYPE_START = 60;
const PALM_DATABASE_TYPE_END = 68;
const FIRST_RECORD_OFFSET_POSITION = 78;
const MOBI_HEADER_PROBE_BYTES = 16;
const MOBI_ENCRYPTION_TYPE_POSITION = 12;
const UNENCRYPTED = 0;

const EBOOK_CONVERT_TIMEOUT_MS = 600_000;
const ERROR_TAIL_LINES = 5;

const readBytes = async (
  file: Awaited<ReturnType<typeof open>>,
  length: number,
  position: number
): Promise<Buffer> => {
  const buffer = Buffer.alloc(length);

  await file.read(buffer, 0, length, position);

  return buffer;
};

/**
 * Tells whether a Mobipocket/KF8 file is DRM-protected.
 *
 * @remarks
 * These files are PalmDB containers; record 0 holds the MOBI header, whose bytes 12–13 are the
 * encryption type (0 = none). Files that are not PalmDB books report `false`.
 *
 * @param file - Path of the `.mobi`, `.azw`, `.azw3` or `.prc` file.
 * @returns True when the MOBI header declares an encryption type.
 */
export const isMobiEncrypted = async (file: string): Promise<boolean> => {
  const handle = await open(file, 'r');

  try {
    const header = await readBytes(handle, PALM_DATABASE_HEADER_BYTES, 0);
    const kind = header.toString('latin1', PALM_DATABASE_TYPE_START, PALM_DATABASE_TYPE_END);

    if (!Patterns.mobiPalmDatabaseType.test(kind)) return false;
    const firstRecordOffset = header.readUInt32BE(FIRST_RECORD_OFFSET_POSITION);
    const mobiHeader = await readBytes(handle, MOBI_HEADER_PROBE_BYTES, firstRecordOffset);

    return mobiHeader.readUInt16BE(MOBI_ENCRYPTION_TYPE_POSITION) !== UNENCRYPTED;
  } finally {
    await handle.close();
  }
};

/**
 * Converts a MOBI/AZW/AZW3 file to EPUB with Calibre's `ebook-convert`.
 *
 * @param input - Path of the Kindle file.
 * @param output - Path where the EPUB is written.
 * @throws An `Error` when the file is DRM-protected or the conversion fails, and
 * {@link MissingToolError} when Calibre is not installed.
 */
export const convertToEpub = async (input: string, output: string): Promise<void> => {
  if (await isMobiEncrypted(input)) {
    throw new Error(
      'This Kindle file is DRM-protected and cannot be imported. Only DRM-free books are supported.'
    );
  }

  const result = await run('ebook-convert', [input, output], undefined, EBOOK_CONVERT_TIMEOUT_MS);

  if (result.code !== 0) {
    const errorTail = (result.stderr || result.stdout)
      .trim()
      .split('\n')
      .slice(-ERROR_TAIL_LINES)
      .join('\n');

    throw new Error(`ebook-convert failed: ${errorTail}`);
  }
};
