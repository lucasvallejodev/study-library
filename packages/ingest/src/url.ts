import { Defuddle } from 'defuddle/node';

import { countWords } from '@study/core';

import { Patterns } from './patterns';
import { atxHeadingText, collapseWhitespace, imageReferences, stripHtmlTags } from './text';
import { mapLimit } from './tools';
import { AssetStore, type FinishedChapter, tidyMarkdown, type Warning } from './writer';

const FETCH_TIMEOUT_MS = 30_000;
const BROWSER_NAVIGATION_TIMEOUT_MS = 45_000;
const IMAGE_DOWNLOAD_CONCURRENCY = 4;
const MAX_ARTICLE_WORDS = 8000;
const SECTION_HEADING_LEVEL = 2;
const CODE_FENCE = '```';
const FALLBACK_IMAGE_EXTENSION = 'bin';
const PARENT_DIRECTORY = '../';
const INTRODUCTION_TITLE = 'Introduction';

/** Fetches a URL and returns its body, content type and HTTP status. */
export type Fetcher = (
  url: string
) => Promise<{ body: Buffer; contentType: string; ok: boolean; status: number }>;

/** User agent sent with every request, so sites serve their regular desktop page. */
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 StudyLibrary/0.1';

/**
 * Fetches a URL over the network, following redirects.
 *
 * @param url - Absolute URL to fetch.
 * @returns The response body, content type, `ok` flag and status.
 * @throws When the network request fails or takes longer than 30 seconds.
 */
export const defaultFetcher: Fetcher = async url => {
  const response = await fetch(url, {
    headers: { accept: '*/*', 'user-agent': USER_AGENT },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? '',
    ok: response.ok,
    status: response.status,
  };
};

/** The readable content and metadata Defuddle extracted from a page. */
export type ExtractedPage = {
  author?: string;
  description?: string;
  image?: string;
  markdown: string;
  published?: string;
  title: string;
  wordCount: number;
};

const trimmedOrUndefined = (value: string | undefined): string | undefined =>
  value?.trim() || undefined;

const pageHeading = (html: string): string | undefined => {
  const content = Patterns.pageHeadingContent.exec(html)?.[1];

  return content === undefined ? undefined : collapseWhitespace(stripHtmlTags(content));
};

const withoutSiteNameSuffix = (title: string, html: string): string => {
  const heading = pageHeading(html);

  if (!heading || !title.startsWith(heading)) return title;

  return Patterns.titleSuffixSeparator.test(title.slice(heading.length)) ? heading : title;
};

/**
 * Extracts the readable article from a page with Defuddle, as Markdown.
 *
 * @remarks
 * A "Headline - Site Name" title is shortened to the page's own `<h1>` when the title only adds
 * a suffix to it; a page without a title is named after its host.
 *
 * @param html - Full HTML of the page.
 * @param url - Address of the page, used to resolve relative links.
 * @returns The article Markdown, its metadata and word count.
 */
export const extractArticle = async (html: string, url: string): Promise<ExtractedPage> => {
  const result = await Defuddle(html, url, { markdown: true });
  const markdown = tidyMarkdown(result.content ?? '');
  const title = withoutSiteNameSuffix((result.title || '').trim(), html);

  return {
    author: trimmedOrUndefined(result.author),
    description: trimmedOrUndefined(result.description),
    image: result.image || undefined,
    markdown,
    published: trimmedOrUndefined(result.published),
    title: title || new URL(url).hostname,
    wordCount: countWords(markdown),
  };
};

type BrowserPage = {
  content: () => Promise<string>;
  goto: (url: string, options: object) => Promise<unknown>;
};

type BrowserModule = {
  chromium: {
    launch: () => Promise<{
      close: () => Promise<void>;
      newPage: (options: object) => Promise<BrowserPage>;
    }>;
  };
};

const loadPlaywright = async (): Promise<BrowserModule | undefined> => {
  const moduleName = 'playwright';

  try {
    /* eslint-disable local/no-comments -- bundler directives keep the optional dependency out of the web build */
    return (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ moduleName
    )) as BrowserModule;
    /* eslint-enable local/no-comments */
  } catch {
    return undefined;
  }
};

/**
 * Renders a JavaScript-heavy page with Playwright, if it is installed (optional dependency).
 *
 * @param url - Address of the page.
 * @returns The rendered HTML once the network is idle, or `undefined` without Playwright.
 */
export const renderWithBrowser = async (url: string): Promise<string | undefined> => {
  const playwright = await loadPlaywright();

  if (!playwright) return undefined;
  const browser = await playwright.chromium.launch();

  try {
    const page = await browser.newPage({ userAgent: USER_AGENT });

    await page.goto(url, { timeout: BROWSER_NAVIGATION_TIMEOUT_MS, waitUntil: 'networkidle' });

    return await page.content();
  } finally {
    await browser.close();
  }
};

const ExtensionByContentType: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

/** Where downloaded images go and how they are fetched; failures become warnings. */
export type ImageDownload = {
  assets: AssetStore;
  fetcher: Fetcher;
  warnings: Warning[];
};

const absoluteUrl = (reference: string, baseUrl: string): string | undefined => {
  try {
    return new URL(reference, baseUrl).toString();
  } catch {
    return undefined;
  }
};

const storeDataUrlImage = (dataUrl: string, assets: AssetStore): string | undefined => {
  const match = Patterns.base64DataUrlWithImageType.exec(dataUrl);

  if (!match) return undefined;
  const extension = ExtensionByContentType[match[1]] ?? FALLBACK_IMAGE_EXTENSION;

  return PARENT_DIRECTORY + assets.add(Buffer.from(match[2], 'base64'), extension);
};

const downloadImage = async (absolute: string, download: ImageDownload): Promise<string> => {
  const response = await download.fetcher(absolute);

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.contentType.split(';')[0].trim();

  const extension =
    ExtensionByContentType[contentType] ??
    Patterns.imageFileExtension.exec(absolute)?.[1] ??
    FALLBACK_IMAGE_EXTENSION;

  return PARENT_DIRECTORY + download.assets.add(response.body, extension);
};

const localiseImage = async (
  reference: string,
  baseUrl: string,
  download: ImageDownload,
  mapping: Map<string, string>
): Promise<void> => {
  const absolute = absoluteUrl(reference, baseUrl);

  if (absolute === undefined) return;

  if (absolute.startsWith('data:')) {
    const local = storeDataUrlImage(absolute, download.assets);

    if (local) mapping.set(reference, local);

    return;
  }

  try {
    mapping.set(reference, await downloadImage(absolute, download));
  } catch (error) {
    download.warnings.push({
      code: 'missing-image',
      message: `Could not download ${absolute}: ${(error as Error).message}`,
    });
  }
};

/**
 * Downloads every image referenced by the Markdown and points the links at local assets.
 *
 * @param markdown - Article Markdown with `![…](…)` and `<img src>` references.
 * @param baseUrl - Address of the page, used to resolve relative references.
 * @param download - Asset store, fetcher and warning list; failed downloads add a
 * `missing-image` warning and keep the original reference.
 * @returns The Markdown with each downloaded image pointing at `../assets/…`.
 */
export const localiseImages = async (
  markdown: string,
  baseUrl: string,
  download: ImageDownload
): Promise<string> => {
  const mapping = new Map<string, string>();

  await mapLimit([...imageReferences(markdown)], IMAGE_DOWNLOAD_CONCURRENCY, reference =>
    localiseImage(reference, baseUrl, download, mapping)
  );
  let localised = markdown;

  for (const [from, to] of mapping) localised = localised.split(from).join(to);

  return localised;
};

type ArticleSection = { markdown: string; title: string };

type SectionDraft = { lines: string[]; title: string };

const hasText = (section: SectionDraft): boolean => !!section.lines.join('').trim();

const finishSection = (section: SectionDraft): ArticleSection => ({
  markdown: section.lines.join('\n'),
  title: section.title,
});

const splitAtSectionHeadings = (markdown: string): ArticleSection[] => {
  const sections: ArticleSection[] = [];
  let current: SectionDraft = { lines: [], title: INTRODUCTION_TITLE };
  let inFence = false;

  for (const line of markdown.split('\n')) {
    if (line.startsWith(CODE_FENCE)) inFence = !inFence;
    const heading = inFence ? undefined : atxHeadingText(line, SECTION_HEADING_LEVEL);

    if (heading === undefined) {
      current.lines.push(line);
      continue;
    }

    if (hasText(current)) sections.push(finishSection(current));
    current = { lines: [line], title: heading.replace(Patterns.headingEmphasisMarks, '') };
  }

  if (hasText(current)) sections.push(finishSection(current));

  return sections;
};

/**
 * Splits a long article at its level-2 headings; short ones stay a single chapter.
 *
 * @remarks
 * Text before the first heading becomes an "Introduction" section; headings inside code fences
 * are ignored.
 *
 * @param title - Article title, used when the article stays whole.
 * @param markdown - Article Markdown.
 * @param maxWords - Word count above which the article is split.
 * @returns The sections, or the whole article when it is short or has no headings to split at.
 */
export const splitArticle = (
  title: string,
  markdown: string,
  maxWords = MAX_ARTICLE_WORDS
): ArticleSection[] => {
  if (countWords(markdown) <= maxWords) return [{ markdown, title }];
  const sections = splitAtSectionHeadings(markdown);

  return sections.length > 1 ? sections : [{ markdown, title }];
};

/** An extracted article, split into chapters, with its source HTML and page metadata. */
export type ArticleResult = {
  chapters: Omit<FinishedChapter, 'id'>[];
  html: string;
  page: ExtractedPage;
};

/**
 * Turns a web page into article chapters: extracts the content, downloads its images and
 * splits long articles.
 *
 * @param html - Full HTML of the page.
 * @param url - Address of the page.
 * @param download - Asset store, fetcher and warning list for the page's images; an empty
 * extraction adds an `empty-content` warning.
 * @returns The chapters, the HTML and the page metadata.
 */
export const processArticle = async (
  html: string,
  url: string,
  download: ImageDownload
): Promise<ArticleResult> => {
  const page = await extractArticle(html, url);

  if (page.wordCount === 0) {
    download.warnings.push({
      code: 'empty-content',
      message: 'No readable content was extracted from the page',
    });
  }

  const markdown = await localiseImages(page.markdown, url, download);
  const sections = splitArticle(page.title, markdown);

  return {
    chapters: sections.map(section => ({
      depth: 1,
      markdown: section.markdown,
      matter: 'body' as const,
      sourceUrl: url,
      title: section.title,
    })),
    html,
    page,
  };
};
