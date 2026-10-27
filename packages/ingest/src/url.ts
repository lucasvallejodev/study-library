import { Defuddle } from "defuddle/node";
import { countWords } from "@study/core";
import { mapLimit } from "./tools";
import { AssetStore, tidyMarkdown, type FinishedChapter, type Warning } from "./writer";

export type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; contentType: string; body: Buffer }>;

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 StudyLibrary/0.1";

export const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "*/*" }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
  return { ok: res.ok, status: res.status, contentType: res.headers.get("content-type") ?? "", body: Buffer.from(await res.arrayBuffer()) };
};

export type ExtractedPage = {
  title: string;
  author?: string;
  published?: string;
  description?: string;
  image?: string;
  markdown: string;
  wordCount: number;
};

export async function extractArticle(html: string, url: string): Promise<ExtractedPage> {
  const result = await Defuddle(html, url, { markdown: true });
  const markdown = tidyMarkdown(result.content ?? "");
  let title = (result.title || "").trim();
  // "Headline - Site Name": prefer the page's own <h1> when the title just adds a suffix.
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (h1 && title.startsWith(h1) && /^\s*[-|–—:·]/.test(title.slice(h1.length))) title = h1;
  return {
    title: title || new URL(url).hostname,
    author: result.author?.trim() || undefined,
    published: result.published?.trim() || undefined,
    description: result.description?.trim() || undefined,
    image: result.image || undefined,
    markdown,
    wordCount: countWords(markdown),
  };
}

type BrowserModule = {
  chromium: {
    launch: () => Promise<{
      newPage: (o: object) => Promise<{ goto: (u: string, o: object) => Promise<unknown>; content: () => Promise<string> }>;
      close: () => Promise<void>;
    }>;
  };
};

/** Render a JavaScript-heavy page with Playwright, if it is installed (optional dependency). */
export async function renderWithBrowser(url: string): Promise<string | undefined> {
  let pw: BrowserModule;
  try {
    const moduleName = "playwright";
    pw = (await import(/* webpackIgnore: true */ moduleName)) as BrowserModule;
  } catch {
    return undefined;
  }
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: USER_AGENT });
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

/** Download every image referenced by the Markdown and point the links at local assets. */
export async function localiseImages(
  markdown: string,
  baseUrl: string,
  assets: AssetStore,
  fetcher: Fetcher,
  warnings: Warning[],
): Promise<string> {
  const urls = new Set<string>();
  const mdImage = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
  const htmlImage = /<img[^>]+src=["']([^"']+)["']/g;
  for (const m of markdown.matchAll(mdImage)) urls.add(m[1]!);
  for (const m of markdown.matchAll(htmlImage)) urls.add(m[1]!);

  const mapping = new Map<string, string>();
  await mapLimit([...urls], 4, async (src) => {
    let absolute: string;
    try {
      absolute = new URL(src, baseUrl).toString();
    } catch {
      return;
    }
    if (absolute.startsWith("data:")) {
      const m = absolute.match(/^data:(image\/[a-z+]+);base64,(.*)$/i);
      if (m) mapping.set(src, "../" + assets.add(Buffer.from(m[2]!, "base64"), EXT_BY_TYPE[m[1]!] ?? "bin"));
      return;
    }
    try {
      const res = await fetcher(absolute);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.contentType.split(";")[0]!.trim();
      const ext = EXT_BY_TYPE[type] ?? (absolute.match(/\.(png|jpe?g|gif|webp|svg|avif)(?:$|\?)/i)?.[1] ?? "bin");
      mapping.set(src, "../" + assets.add(res.body, ext));
    } catch (e) {
      warnings.push({ code: "missing-image", message: `Could not download ${absolute}: ${(e as Error).message}` });
    }
  });
  let out = markdown;
  for (const [from, to] of mapping) out = out.split(from).join(to);
  return out;
}

/** Long articles are split at level-2 headings; short ones stay a single chapter. */
export function splitArticle(title: string, markdown: string, maxWords = 8000): { title: string; markdown: string }[] {
  if (countWords(markdown) <= maxWords) return [{ title, markdown }];
  const sections: { title: string; markdown: string }[] = [];
  let current = { title: "Introduction", lines: [] as string[] };
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^```/.test(line)) inFence = !inFence;
    const h2 = !inFence && line.match(/^##\s+(.+?)\s*#*$/);
    if (h2) {
      if (current.lines.join("").trim()) sections.push({ title: current.title, markdown: current.lines.join("\n") });
      current = { title: h2[1]!.replace(/[*_`]/g, ""), lines: [line] };
    } else current.lines.push(line);
  }
  if (current.lines.join("").trim()) sections.push({ title: current.title, markdown: current.lines.join("\n") });
  return sections.length > 1 ? sections : [{ title, markdown }];
}

export type ArticleResult = {
  page: ExtractedPage;
  chapters: Omit<FinishedChapter, "id">[];
  html: string;
};

export async function processArticle(
  html: string,
  url: string,
  assets: AssetStore,
  warnings: Warning[],
  fetcher: Fetcher = defaultFetcher,
): Promise<ArticleResult> {
  const page = await extractArticle(html, url);
  if (page.wordCount === 0) warnings.push({ code: "empty-content", message: "No readable content was extracted from the page" });
  const markdown = await localiseImages(page.markdown, url, assets, fetcher, warnings);
  const parts = splitArticle(page.title, markdown);
  return {
    page,
    html,
    chapters: parts.map((p) => ({ title: p.title, markdown: p.markdown, matter: "body" as const, depth: 1, sourceUrl: url })),
  };
}
