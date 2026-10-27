import { Defuddle } from 'defuddle/node';

import { countWords } from '@study/core';

import { mapLimit } from './tools';
import { AssetStore, type FinishedChapter, tidyMarkdown, type Warning } from './writer';

export type Fetcher = (
  url: string
) => Promise<{ body: Buffer; contentType: string; ok: boolean; status: number }>;

export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 StudyLibrary/0.1';

/**
 *
 * @param url
 */
export const defaultFetcher: Fetcher = async url => {
  const res = await fetch(url, {
    headers: { accept: '*/*', 'user-agent': USER_AGENT },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });

  return {
    body: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') ?? '',
    ok: res.ok,
    status: res.status,
  };
};

export type ExtractedPage = {
  author?: string;
  description?: string;
  image?: string;
  markdown: string;
  published?: string;
  title: string;
  wordCount: number;
};

/**
 *
 * @param html
 * @param url
 */
export const extractArticle = async (html: string, url: string): Promise<ExtractedPage> => {
  const result = await Defuddle(html, url, { markdown: true });
  const markdown = tidyMarkdown(result.content ?? '');
  let title = (result.title || '').trim();

  // "Headline - Site Name": prefer the page's own <h1> when the title just adds a suffix.
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i
    .exec(html)?.[1]
    ?.replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (h1 && title.startsWith(h1) && /^\s*[-|–—:·]/.test(title.slice(h1.length))) title = h1;

  return {
    author: result.author?.trim() || undefined,
    description: result.description?.trim() || undefined,
    image: result.image || undefined,
    markdown,
    published: result.published?.trim() || undefined,
    title: title || new URL(url).hostname,
    wordCount: countWords(markdown),
  };
};

type BrowserModule = {
  chromium: {
    launch: () => Promise<{
      close: () => Promise<void>;
      newPage: (o: object) => Promise<{
        content: () => Promise<string>;
        goto: (u: string, o: object) => Promise<unknown>;
      }>;
    }>;
  };
};

/**
 * Render a JavaScript-heavy page with Playwright, if it is installed (optional dependency).
 *
 * @param url
 */
export const renderWithBrowser = async (url: string): Promise<string | undefined> => {
  let pw: BrowserModule;

  try {
    const moduleName = 'playwright';

    pw = (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ moduleName
    )) as BrowserModule;
  } catch {
    return undefined;
  }

  const browser = await pw.chromium.launch();

  try {
    const page = await browser.newPage({ userAgent: USER_AGENT });

    await page.goto(url, { timeout: 45_000, waitUntil: 'networkidle' });

    return await page.content();
  } finally {
    await browser.close();
  }
};

const EXT_BY_TYPE: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

/**
 * Download every image referenced by the Markdown and point the links at local assets.
 *
 * @param markdown
 * @param baseUrl
 * @param assets
 * @param fetcher
 * @param warnings
 */
export const localiseImages = async (
  markdown: string,
  baseUrl: string,
  assets: AssetStore,
  fetcher: Fetcher,
  warnings: Warning[]
): Promise<string> => {
  const urls = new Set<string>();
  const mdImage = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
  const htmlImage = /<img[^>]+src=["']([^"']+)["']/g;

  for (const m of markdown.matchAll(mdImage)) urls.add(m[1]);
  for (const m of markdown.matchAll(htmlImage)) urls.add(m[1]);

  const mapping = new Map<string, string>();

  await mapLimit([...urls], 4, async src => {
    let absolute: string;

    try {
      absolute = new URL(src, baseUrl).toString();
    } catch {
      return;
    }

    if (absolute.startsWith('data:')) {
      const m = /^data:(image\/[a-z+]+);base64,(.*)$/i.exec(absolute);

      if (m) {
        mapping.set(
          src,
          '../' + assets.add(Buffer.from(m[2], 'base64'), EXT_BY_TYPE[m[1]] ?? 'bin')
        );
      }

      return;
    }

    try {
      const res = await fetcher(absolute);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.contentType.split(';')[0].trim();

      const ext =
        EXT_BY_TYPE[type] ??
        /\.(png|jpe?g|gif|webp|svg|avif)(?:$|\?)/i.exec(absolute)?.[1] ??
        'bin';

      mapping.set(src, '../' + assets.add(res.body, ext));
    } catch (e) {
      warnings.push({
        code: 'missing-image',
        message: `Could not download ${absolute}: ${(e as Error).message}`,
      });
    }
  });
  let out = markdown;

  for (const [from, to] of mapping) out = out.split(from).join(to);

  return out;
};

/**
 * Long articles are split at level-2 headings; short ones stay a single chapter.
 *
 * @param title
 * @param markdown
 * @param maxWords
 */
export const splitArticle = (
  title: string,
  markdown: string,
  maxWords = 8000
): { markdown: string; title: string }[] => {
  if (countWords(markdown) <= maxWords) return [{ markdown, title }];
  const sections: { markdown: string; title: string }[] = [];
  let current = { lines: [] as string[], title: 'Introduction' };
  let inFence = false;

  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) inFence = !inFence;
    const h2 = !inFence && /^##\s+(.+?)\s*#*$/.exec(line);

    if (h2) {
      if (current.lines.join('').trim()) {
        sections.push({ markdown: current.lines.join('\n'), title: current.title });
      }

      current = { lines: [line], title: h2[1].replace(/[*_`]/g, '') };
    } else current.lines.push(line);
  }

  if (current.lines.join('').trim()) {
    sections.push({ markdown: current.lines.join('\n'), title: current.title });
  }

  return sections.length > 1 ? sections : [{ markdown, title }];
};

export type ArticleResult = {
  chapters: Omit<FinishedChapter, 'id'>[];
  html: string;
  page: ExtractedPage;
};

/**
 *
 * @param html
 * @param url
 * @param assets
 * @param warnings
 * @param fetcher
 */
export const processArticle = async (
  html: string,
  url: string,
  assets: AssetStore,
  warnings: Warning[],
  fetcher: Fetcher = defaultFetcher
): Promise<ArticleResult> => {
  const page = await extractArticle(html, url);

  if (page.wordCount === 0) {
    warnings.push({
      code: 'empty-content',
      message: 'No readable content was extracted from the page',
    });
  }

  const markdown = await localiseImages(page.markdown, url, assets, fetcher, warnings);
  const parts = splitArticle(page.title, markdown);

  return {
    chapters: parts.map(p => ({
      depth: 1,
      markdown: p.markdown,
      matter: 'body' as const,
      sourceUrl: url,
      title: p.title,
    })),
    html,
    page,
  };
};
