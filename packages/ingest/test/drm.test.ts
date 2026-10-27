import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isMobiEncrypted } from "../src/calibre";

/** Minimal PalmDB header with one record whose MOBI header declares an encryption type. */
async function fakeMobi(encryption: number): Promise<string> {
  const buf = Buffer.alloc(200);
  buf.write("BOOKMOBI", 60, "latin1");
  buf.writeUInt16BE(1, 76); // record count
  buf.writeUInt32BE(100, 78); // record 0 offset
  buf.writeUInt16BE(encryption, 100 + 12);
  const file = path.join(os.tmpdir(), `fake-${encryption}-${Date.now()}.mobi`);
  await writeFile(file, buf);
  return file;
}

describe("Kindle DRM detection", () => {
  it("accepts DRM-free MOBI files", async () => {
    expect(await isMobiEncrypted(await fakeMobi(0))).toBe(false);
  });
  it("detects encrypted MOBI files", async () => {
    expect(await isMobiEncrypted(await fakeMobi(2))).toBe(true);
  });
});
