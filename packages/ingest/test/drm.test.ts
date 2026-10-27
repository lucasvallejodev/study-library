import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { isMobiEncrypted } from '../src/calibre';

const RECORD_COUNT_POSITION = 76;
const FIRST_RECORD_OFFSET_POSITION = 78;
const FIRST_RECORD_OFFSET = 100;
const ENCRYPTION_TYPE_POSITION = 12;

async function palmDatabaseWithOneMobiRecord(encryption: number): Promise<string> {
  const buf = Buffer.alloc(200);

  buf.write('BOOKMOBI', 60, 'latin1');
  buf.writeUInt16BE(1, RECORD_COUNT_POSITION);
  buf.writeUInt32BE(FIRST_RECORD_OFFSET, FIRST_RECORD_OFFSET_POSITION);
  buf.writeUInt16BE(encryption, FIRST_RECORD_OFFSET + ENCRYPTION_TYPE_POSITION);
  const file = path.join(os.tmpdir(), `fake-${encryption}-${Date.now()}.mobi`);

  await writeFile(file, buf);

  return file;
}

describe('Kindle DRM detection', () => {
  it('accepts DRM-free MOBI files', async () => {
    expect(await isMobiEncrypted(await palmDatabaseWithOneMobiRecord(0))).toBe(false);
  });
  it('detects encrypted MOBI files', async () => {
    expect(await isMobiEncrypted(await palmDatabaseWithOneMobiRecord(2))).toBe(true);
  });
});
