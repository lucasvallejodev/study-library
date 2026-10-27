import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contentHash, countWords, DocumentSchema, parseChapterFile, ChapterFrontmatterSchema } from "../src/index";

const dir = path.resolve(import.meta.dirname, "../../../fixtures/library/sample-doc");

describe("document.json contract (hand-made fixture)", () => {
  it("validates and matches its chapter files", async () => {
    const doc = DocumentSchema.parse(JSON.parse(await readFile(path.join(dir, "document.json"), "utf8")));
    expect(doc.chapters).toHaveLength(2);
    for (const ch of doc.chapters) {
      const { front, body } = parseChapterFile(await readFile(path.join(dir, ch.file), "utf8"));
      expect(ChapterFrontmatterSchema.parse(front)).toEqual({ id: ch.id, title: ch.title, order: ch.order, document: doc.id });
      expect(contentHash(body.trim())).toBe(ch.contentHash);
      expect(countWords(body)).toBe(ch.wordCount);
    }
  });

  it("rejects ids that would break URLs", () => {
    expect(() => DocumentSchema.parse({ id: "Bad Id", title: "x", kind: "book", source: { type: "url", url: "https://a.b", importedAt: new Date().toISOString() }, chapters: [] })).toThrow();
  });
});
