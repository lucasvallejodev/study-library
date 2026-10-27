import path from "node:path/posix";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import type { ChapterMatter } from "@study/core";
import { cleanHtml, epubTypes, newHtmlDocument, parseXhtml, serialize } from "./html";
import { pandocHtmlToMarkdown, mapLimit } from "./tools";
import { AssetStore, appendFootnotes, tidyMarkdown, type FinishedChapter, type Warning } from "./writer";

export type EpubMetadata = {
  title: string;
  authors: string[];
  language?: string;
  description?: string;
  coverPath?: string;
};

type TocEntry = { title: string; file: string; fragment?: string; depth: number; hasChildren: boolean; parentFile?: string };

type ChapterSlice = {
  title: string;
  depth: number;
  matter: ChapterMatter;
  /** spine index + optional fragment where the chapter starts; ends at the next slice. */
  start: { spine: number; fragment?: string };
};

export type EpubParseOptions = {
  /** Max TOC depth used for chapter starts (default: all levels). */
  tocDepth?: number;
};

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  isArray: (name) => ["item", "itemref", "meta", "creator", "navPoint", "rootfile", "title", "language", "description"].includes(name),
  textNodeName: "#text",
});

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === "object" && "#text" in (value as object)) return text((value as { "#text": unknown })["#text"]);
  return "";
}

function splitHref(href: string, baseFile: string): { file: string; fragment?: string } {
  const [rawPath, fragment] = href.split("#");
  const decoded = decodeURIComponent(rawPath ?? "");
  const file = decoded ? path.normalize(path.join(path.dirname(baseFile), decoded)) : baseFile;
  return fragment ? { file, fragment: decodeURIComponent(fragment) } : { file };
}

export class EpubBook {
  private docs = new Map<string, Document>();
  readonly warnings: Warning[] = [];

  private constructor(
    private zip: JSZip,
    readonly opfPath: string,
    readonly metadata: EpubMetadata,
    readonly spine: string[],
    readonly manifest: Map<string, { href: string; mediaType: string; properties: string }>,
    private navPath: string | undefined,
    private ncxPath: string | undefined,
  ) {}

  static async load(data: Buffer): Promise<EpubBook> {
    const zip = await JSZip.loadAsync(data);
    const containerXml = await zip.file("META-INF/container.xml")?.async("string");
    if (!containerXml) throw new Error("Not an EPUB: META-INF/container.xml missing");
    if (zip.file("META-INF/encryption.xml")) {
      const enc = await zip.file("META-INF/encryption.xml")!.async("string");
      // Font obfuscation (IDPF and Adobe) is fine; any other encryption method means DRM.
      const fontObfuscation = ["http://www.idpf.org/2008/embedding", "http://ns.adobe.com/pdf/enc#RC"];
      const methods = [...enc.matchAll(/EncryptionMethod[^>]*Algorithm="([^"]+)"/g)].map((m) => m[1]!);
      if (methods.some((m) => !fontObfuscation.includes(m))) {
        throw new Error("This EPUB is DRM-protected and cannot be imported. Only DRM-free books are supported.");
      }
    }
    const container = xml.parse(containerXml);
    const rootfiles = container?.container?.rootfiles?.rootfile ?? [];
    const opfPath: string | undefined = rootfiles[0]?.["@_full-path"];
    if (!opfPath) throw new Error("EPUB container.xml has no rootfile");
    const opfXml = await zip.file(opfPath)?.async("string");
    if (!opfXml) throw new Error(`EPUB OPF not found at ${opfPath}`);
    const opf = xml.parse(opfXml).package;
    const md = opf.metadata ?? {};
    const manifest = new Map<string, { href: string; mediaType: string; properties: string }>();
    for (const item of opf.manifest?.item ?? []) {
      manifest.set(item["@_id"], {
        href: path.normalize(path.join(path.dirname(opfPath), decodeURIComponent(item["@_href"]))),
        mediaType: item["@_media-type"] ?? "",
        properties: item["@_properties"] ?? "",
      });
    }
    const spine = (opf.spine?.itemref ?? [])
      .map((ref: Record<string, string>) => manifest.get(ref["@_idref"]!)?.href)
      .filter((h: string | undefined): h is string => !!h);

    let coverPath = [...manifest.values()].find((m) => m.properties.split(/\s+/).includes("cover-image"))?.href;
    if (!coverPath) {
      const coverMeta = (md.meta ?? []).find((m: Record<string, string>) => m["@_name"] === "cover");
      if (coverMeta) coverPath = manifest.get(coverMeta["@_content"])?.href;
    }
    const navPath = [...manifest.values()].find((m) => m.properties.split(/\s+/).includes("nav"))?.href;
    const tocId = opf.spine?.["@_toc"];
    const ncxPath = (tocId && manifest.get(tocId)?.href) || [...manifest.values()].find((m) => m.mediaType === "application/x-dtbncx+xml")?.href;

    const titles: unknown[] = md.title ?? [];
    const metadata: EpubMetadata = {
      title: text(titles[0]) || "Untitled",
      authors: (md.creator ?? []).map(text).filter(Boolean),
      language: text(md.language) || undefined,
      description: text(md.description).replace(/<[^>]+>/g, "") || undefined,
      coverPath,
    };
    return new EpubBook(zip, opfPath, metadata, spine, manifest, navPath, ncxPath);
  }

  async file(p: string): Promise<Buffer | undefined> {
    const f = this.zip.file(p);
    return f ? Buffer.from(await f.async("uint8array")) : undefined;
  }

  async doc(p: string): Promise<Document | undefined> {
    if (this.docs.has(p)) return this.docs.get(p);
    const raw = await this.zip.file(p)?.async("string");
    if (raw === undefined) return undefined;
    const doc = parseXhtml(raw);
    this.docs.set(p, doc);
    return doc;
  }

  async toc(): Promise<TocEntry[]> {
    if (this.navPath) {
      const nav = await this.doc(this.navPath);
      const navEl = nav && Array.from(nav.getElementsByTagName("nav")).find((n) => epubTypes(n).includes("toc"));
      if (navEl) {
        const ol = Array.from(navEl.children).find((c) => c.localName === "ol" || c.localName === "ul");
        if (ol) {
          const entries: TocEntry[] = [];
          this.walkNavList(ol, 1, this.navPath, entries);
          if (entries.length) return entries;
        }
      }
    }
    if (this.ncxPath) {
      const raw = await this.zip.file(this.ncxPath)?.async("string");
      if (raw) {
        const ncx = xml.parse(raw).ncx;
        const entries: TocEntry[] = [];
        const walk = (points: Record<string, unknown>[] | undefined, depth: number, parentFile?: string) => {
          for (const p of points ?? []) {
            const label = text((p.navLabel as Record<string, unknown> | undefined)?.text);
            const src = (p.content as Record<string, string> | undefined)?.["@_src"];
            const children = p.navPoint as Record<string, unknown>[] | undefined;
            const target = src ? splitHref(src, this.ncxPath!) : undefined;
            if (target) entries.push({ title: label || "Untitled", ...target, depth, hasChildren: !!children?.length, parentFile });
            walk(children, depth + 1, target?.file);
          }
        };
        walk(ncx?.navMap?.navPoint, 1);
        if (entries.length) return entries;
      }
    }
    return [];
  }

  private walkNavList(list: Element, depth: number, base: string, out: TocEntry[], parentFile?: string) {
    for (const li of Array.from(list.children).filter((c) => c.localName === "li")) {
      const a = Array.from(li.children).find((c) => c.localName === "a" || c.localName === "span");
      const sub = Array.from(li.children).find((c) => c.localName === "ol" || c.localName === "ul");
      const href = a?.getAttribute("href");
      const title = (a?.textContent ?? "").replace(/\s+/g, " ").trim();
      const target = href ? splitHref(href, base) : undefined;
      if (target) out.push({ title: title || "Untitled", ...target, depth, hasChildren: !!sub, parentFile });
      if (sub) this.walkNavList(sub, depth + 1, base, out, target?.file);
    }
  }
}

function classifyMatter(doc: Document | undefined, fragment: string | undefined, title: string): ChapterMatter {
  const types = new Set<string>();
  if (doc) {
    const body = doc.getElementsByTagName("body")[0];
    epubTypes(body).forEach((t) => types.add(t));
    const target = fragment ? doc.getElementById(fragment) : body?.firstElementChild;
    epubTypes(target).forEach((t) => types.add(t));
    const firstSection = body?.querySelector("section");
    epubTypes(firstSection).forEach((t) => types.add(t));
  }
  if (types.has("backmatter") || types.has("endnotes") || types.has("doc-endnotes") || types.has("colophon") || types.has("copyright-page")) return "back";
  if (types.has("frontmatter") || types.has("titlepage") || types.has("imprint") || types.has("cover") || types.has("halftitlepage")) return "front";
  if (/^(cover|title ?page|half ?title|imprint|copyright|colophon|uncopyright|about the (publisher|ebook)|table of contents|contents)$/i.test(title)) {
    return /colophon|uncopyright|about/i.test(title) ? "back" : "front";
  }
  return "body";
}

/** `parts` are containers (one per spine file touched) holding the chapter's nodes. */
export type EpubChapterDraft = ChapterSlice & { parts: Element[] };

/** Split the spine into chapters following the TOC. */
export async function sliceChapters(book: EpubBook, opts: EpubParseOptions = {}): Promise<EpubChapterDraft[]> {
  const spineIndex = new Map(book.spine.map((p, i) => [p, i]));
  const allEntries = await book.toc();
  const maxDepth = opts.tocDepth ?? Infinity;
  const slices: ChapterSlice[] = [];

  if (allEntries.length === 0) {
    book.warnings.push({ code: "no-toc", message: "No usable table of contents; one chapter per spine item" });
  }

  const seen = new Set<string>();
  for (const e of allEntries) {
    if (e.depth > maxDepth) continue;
    // Sub-sections anchored inside their parent's file (story parts I, II, III) stay in the parent chapter.
    if (e.fragment && e.parentFile === e.file) continue;
    const spine = spineIndex.get(e.file);
    if (spine === undefined) {
      book.warnings.push({ code: "unresolved-toc-entry", message: `TOC entry "${e.title}" points to ${e.file}, which is not in the spine` });
      continue;
    }
    const doc = await book.doc(e.file);
    let fragment = e.fragment;
    if (fragment && !doc?.getElementById(fragment)) {
      book.warnings.push({ code: "unresolved-toc-entry", message: `TOC entry "${e.title}" anchor #${fragment} not found; using file start` });
      fragment = undefined;
    }
    // An anchor that is (or wraps) the whole body behaves like the file start.
    if (fragment && doc && isAtFileStart(doc, fragment)) fragment = undefined;
    const key = `${spine}#${fragment ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slices.push({ title: e.title, depth: e.depth, matter: classifyMatter(doc, fragment, e.title), start: { spine, fragment } });
  }

  if (slices.length === 0) {
    for (const [i, file] of book.spine.entries()) {
      const doc = await book.doc(file);
      const title = doc?.querySelector("h1,h2,h3")?.textContent?.trim() || doc?.querySelector("title")?.textContent?.trim() || `Section ${i + 1}`;
      slices.push({ title, depth: 1, matter: classifyMatter(doc, undefined, title), start: { spine: i } });
    }
  }

  // Keep spine order even when the TOC is out of order.
  const ordered = [...slices].sort((a, b) => a.start.spine - b.start.spine);
  if (ordered.some((s, i) => s !== slices[i])) {
    book.warnings.push({ code: "other", message: "TOC order differs from spine order; chapters follow the spine" });
  }

  const drafts: EpubChapterDraft[] = [];
  if (ordered[0] && (ordered[0].start.spine > 0 || ordered[0].start.fragment)) {
    const parts = await collect(book, { spine: 0 }, ordered[0].start);
    if (hasContent(parts)) drafts.push({ title: "Front matter", depth: 1, matter: "front", start: { spine: 0 }, parts });
  }
  for (const [i, slice] of ordered.entries()) {
    const end = ordered[i + 1]?.start ?? { spine: book.spine.length };
    drafts.push({ ...slice, parts: await collect(book, slice.start, end) });
  }
  return foldTitleOnlyParents(drafts, allEntries);
}

/** A part page that only holds its title ("Book One") is merged into the chapter after it. */
function foldTitleOnlyParents(drafts: EpubChapterDraft[], entries: TocEntry[]): EpubChapterDraft[] {
  const parents = new Set(entries.filter((e) => e.hasChildren).map((e) => e.title));
  const out: EpubChapterDraft[] = [];
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i]!;
    const next = drafts[i + 1];
    const words = partsText(d.parts).split(/\s+/).filter(Boolean).length;
    if (next && parents.has(d.title) && words <= 30 && !hasMedia(d.parts) && d.matter === "body") {
      next.parts = [...d.parts, ...next.parts];
      continue;
    }
    out.push(d);
  }
  return out;
}

function partsText(parts: Element[]): string {
  return parts.map((p) => p.textContent ?? "").join(" ");
}

function hasMedia(parts: Element[]): boolean {
  return parts.some((p) => p.querySelector("img, svg, image"));
}

function hasContent(parts: Element[]): boolean {
  return partsText(parts).trim().length > 0 || hasMedia(parts);
}

function isAtFileStart(doc: Document, fragment: string): boolean {
  const el = doc.getElementById(fragment);
  const body = doc.getElementsByTagName("body")[0];
  if (!el || !body) return false;
  const range = doc.createRange();
  range.selectNodeContents(body);
  range.setEndBefore(el);
  return range.toString().trim().length === 0 && !range.cloneContents().querySelector?.("img,svg");
}

/** Copy everything from `start` up to (not including) `end`, across spine files. */
async function collect(book: EpubBook, start: { spine: number; fragment?: string }, end: { spine: number; fragment?: string }): Promise<Element[]> {
  const parts: Element[] = [];
  const last = end.fragment ? end.spine : end.spine - 1;
  for (let s = start.spine; s <= last && s < book.spine.length; s++) {
    const file = book.spine[s]!;
    const doc = await book.doc(file);
    const body = doc?.getElementsByTagName("body")[0];
    if (!doc || !body) continue;
    const range = doc.createRange();
    range.selectNodeContents(body);
    if (s === start.spine && start.fragment) {
      const el = doc.getElementById(start.fragment);
      if (el) range.setStartBefore(el);
    }
    if (s === end.spine && end.fragment) {
      const el = doc.getElementById(end.fragment);
      if (el) range.setEndBefore(el);
    }
    const container = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    container.setAttribute("data-file", file);
    container.appendChild(range.cloneContents());
    parts.push(container);
  }
  return parts;
}

export type ConvertContext = {
  book: EpubBook;
  docId: string;
  assets: AssetStore;
  /** file path (+ optional #fragment) -> chapter id, used to rewrite internal links */
  linkTarget: (file: string, fragment?: string) => string | undefined;
};

const FN_TOKEN = (n: number) => `FNREFTOKEN${n}X`;

/** Clean one chapter's HTML, pull in images and footnotes, convert to Markdown. */
export async function convertChapter(draft: EpubChapterDraft, chapterId: string, ctx: ConvertContext): Promise<string> {
  const doc = newHtmlDocument();
  const root = doc.createElement("div");
  for (const part of draft.parts) {
    const chunk = doc.createElement("div");
    chunk.setAttribute("data-file", part.getAttribute("data-file")!);
    chunk.append(...Array.from(part.childNodes).map((n) => doc.importNode(n, true)));
    root.appendChild(chunk);
  }
  const notes: string[] = [];
  const consumedNoteIds = new Set<string>();

  // Each chunk remembers its source file so relative hrefs resolve correctly.
  for (const chunk of Array.from(root.querySelectorAll("div[data-file]"))) {
    const file = chunk.getAttribute("data-file")!;

    for (const a of Array.from(chunk.querySelectorAll("a[href]"))) {
      const href = a.getAttribute("href")!;
      if (/^[a-z]+:/i.test(href)) continue;
      const target = splitHref(href, file);
      const isNoteRef = epubTypes(a).some((t) => t === "noteref" || t === "doc-noteref");
      if (isNoteRef && target.fragment) {
        const noteHtml = await footnoteHtml(ctx.book, target.file, target.fragment);
        if (noteHtml !== undefined) {
          notes.push(noteHtml);
          if (target.file === file) consumedNoteIds.add(target.fragment);
          a.replaceWith(doc.createTextNode(FN_TOKEN(notes.length)));
          continue;
        }
      }
      const chapter = ctx.linkTarget(target.file, target.fragment);
      if (chapter) {
        a.setAttribute("href", `/read/${ctx.docId}/${chapter}`);
      } else {
        ctx.book.warnings.push({ code: "broken-link", chapterId, message: `Link to ${href} has no matching chapter` });
        a.replaceWith(...Array.from(a.childNodes));
      }
    }
    for (const id of consumedNoteIds) chunk.querySelector(`[id="${CSS_escape(id)}"]`)?.remove();

    for (const img of Array.from(chunk.querySelectorAll("img"))) {
      const src = img.getAttribute("src");
      img.removeAttribute("srcset");
      if (!src) continue;
      const rewritten = await importImage(ctx, file, src, chapterId);
      if (rewritten) img.setAttribute("src", `../${rewritten}`);
      else img.replaceWith(doc.createTextNode(img.getAttribute("alt") ? `[Image: ${img.getAttribute("alt")}]` : ""));
    }
    // SVG-wrapped images (common for covers): replace the <svg> with a plain <img>.
    for (const svg of Array.from(chunk.querySelectorAll("svg"))) {
      const image = svg.querySelector("image");
      const href = image?.getAttribute("xlink:href") ?? image?.getAttribute("href");
      if (!href) continue;
      const rewritten = await importImage(ctx, file, href, chapterId);
      if (!rewritten) continue;
      const img = doc.createElement("img");
      img.setAttribute("src", `../${rewritten}`);
      img.setAttribute("alt", svg.getAttribute("aria-label") ?? "");
      svg.replaceWith(img);
    }
  }

  // Endnote back-links ("↩") inside endnote sections are noise once converted.
  for (const a of Array.from(root.querySelectorAll("a"))) {
    if (epubTypes(a).some((t) => t === "backlink" || t === "doc-backlink")) a.remove();
  }
  cleanHtml(root);
  let markdown = await pandocHtmlToMarkdown(serialize(root));
  markdown = markdown.replace(/FNREFTOKEN(\d+)X/g, "[^$1]");
  markdown = tidyMarkdown(markdown);
  if (notes.length) {
    const converted = await Promise.all(notes.map(async (n) => tidyMarkdown(await pandocHtmlToMarkdown(n))));
    markdown = appendFootnotes(markdown, converted);
  }
  return markdown;
}

function CSS_escape(id: string): string {
  return id.replace(/["\\]/g, "\\$&");
}

async function footnoteHtml(book: EpubBook, file: string, id: string): Promise<string | undefined> {
  const doc = await book.doc(file);
  const el = doc?.getElementById(id);
  if (!el) return undefined;
  const clone = el.cloneNode(true) as Element;
  for (const a of Array.from(clone.querySelectorAll("a"))) {
    if (epubTypes(a).some((t) => t === "backlink" || t === "doc-backlink") || /^[↩↑]$/.test(a.textContent?.trim() ?? "")) a.remove();
  }
  const htmlDoc = newHtmlDocument();
  const temp = htmlDoc.createElement("div");
  const nodes = clone.localName === "li" || clone.localName === "aside" ? Array.from(clone.childNodes) : [clone];
  temp.append(...nodes.map((n) => htmlDoc.importNode(n, true)));
  cleanHtml(temp);
  return temp.innerHTML;
}

async function importImage(ctx: ConvertContext, baseFile: string, src: string, chapterId: string): Promise<string | undefined> {
  if (/^data:/.test(src)) {
    const m = src.match(/^data:image\/([a-z+]+);base64,(.*)$/i);
    return m ? ctx.assets.add(Buffer.from(m[2]!, "base64"), m[1]!.replace("svg+xml", "svg")) : undefined;
  }
  if (/^[a-z]+:/i.test(src)) return undefined;
  const p = splitHref(src, baseFile).file;
  const data = await ctx.book.file(p);
  if (!data) {
    ctx.book.warnings.push({ code: "missing-image", chapterId, message: `Image ${src} not found in EPUB` });
    return undefined;
  }
  return ctx.assets.add(data, path.extname(p).slice(1));
}

export async function convertEpub(
  book: EpubBook,
  drafts: EpubChapterDraft[],
  ids: string[],
  docId: string,
  assets: AssetStore,
): Promise<FinishedChapter[]> {
  // Map every spine file (and anchored starts) to the chapter that contains it.
  const fileToChapter = new Map<string, string>();
  const anchorToChapter = new Map<string, string>();
  drafts.forEach((d, i) => {
    if (d.start.fragment) anchorToChapter.set(`${book.spine[d.start.spine]}#${d.start.fragment}`, ids[i]!);
  });
  for (let s = 0; s < book.spine.length; s++) {
    let owner: string | undefined;
    for (const [i, d] of drafts.entries()) if (d.start.spine <= s) owner = ids[i];
    if (owner) fileToChapter.set(book.spine[s]!, owner);
  }
  const ctx: ConvertContext = {
    book,
    docId,
    assets,
    linkTarget: (file, fragment) => (fragment && anchorToChapter.get(`${file}#${fragment}`)) || fileToChapter.get(file),
  };
  const markdowns = await mapLimit(drafts, 6, (d, i) => convertChapter(d, ids[i]!, ctx));
  return drafts.map((d, i) => ({ id: ids[i]!, title: d.title, markdown: markdowns[i]!, matter: d.matter, depth: d.depth }));
}
