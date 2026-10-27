import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  importLogger,
  type ImportOptions,
  type ImportResult,
  importTimestamp,
  resolveDocumentId,
} from './import-options';
import { Patterns } from './patterns';
import { defaultFetcher, type Fetcher, processArticle, renderWithBrowser } from './url';
import { AssetStore, assignChapterIds, type Warning, writeLibraryDocument } from './writer';

const MIN_STATIC_PAGE_WORDS = 80;
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const NO_STATUS = 0;
const SAVED_PAGE_PATH = 'source/page.html';

type FetchResponse = Awaited<ReturnType<Fetcher>>;

const emptyResponse = (status: number): FetchResponse => ({
  body: Buffer.alloc(0),
  contentType: '',
  ok: false,
  status,
});

const offlineFetcher: Fetcher = () => Promise.resolve(emptyResponse(NO_STATUS));

const diskFetcher: Fetcher = async url => {
  try {
    const body = await readFile(new URL(url));

    return {
      body,
      contentType: '',
      ok: true,
      status: HTTP_OK,
    };
  } catch {
    return emptyResponse(HTTP_NOT_FOUND);
  }
};

const imageExtension = (contentType: string): string => contentType.split('/')[1].split(';')[0];

const fetchCoverIgnoringFailures = async (
  image: string | undefined,
  pageUrl: string,
  assets: AssetStore,
  fetcher: Fetcher
): Promise<string | undefined> => {
  if (!image) return undefined;

  try {
    const response = await fetcher(new URL(image, pageUrl).toString());

    if (!response.ok || !response.contentType.startsWith('image/')) return undefined;

    return assets.add(response.body, imageExtension(response.contentType));
  } catch {
    return undefined;
  }
};

const finishArticle = async (
  html: string,
  url: string,
  opts: ImportOptions,
  warnings: Warning[]
): Promise<ImportResult> => {
  const assets = new AssetStore();
  const fetcher = opts.fetcher ?? defaultFetcher;

  const article = await processArticle(html, url, {
    assets,
    fetcher,
    warnings,
  });

  const { page } = article;
  const id = resolveDocumentId(page.title, opts);

  const ids = assignChapterIds(
    article.chapters.map(chapter => chapter.title),
    opts.previous
  );

  const cover = await fetchCoverIgnoringFailures(page.image, url, assets, fetcher);

  const { doc, report } = await writeLibraryDocument({
    assets,
    authors: page.author ? [page.author] : [],
    chapters: article.chapters.map((chapter, index) => ({ ...chapter, id: ids[index] })),
    cover,
    description: page.description,
    id,
    importer: 'url (defuddle)',
    kind: 'article',
    source: {
      importedAt: importTimestamp(),
      type: 'url',
      url,
      ...(page.published ? { publishedAt: page.published } : {}),
      file: SAVED_PAGE_PATH,
    },
    sourceFiles: [{ content: html, relative: SAVED_PAGE_PATH }],
    title: page.title,
    warnings,
  });

  return { document: doc, report };
};

const staticPageWordCount = async (html: string, url: string): Promise<number> => {
  const probe = await processArticle(html, url, {
    assets: new AssetStore(),
    fetcher: offlineFetcher,
    warnings: [],
  });

  return probe.page.wordCount;
};

const renderIfMostlyEmpty = async (
  html: string,
  url: string,
  opts: ImportOptions,
  warnings: Warning[]
): Promise<string> => {
  if ((await staticPageWordCount(html, url)) >= MIN_STATIC_PAGE_WORDS) return html;
  importLogger(opts)('Page looks empty; trying to render it with Playwright…');
  const rendered = await renderWithBrowser(url);

  if (!rendered) {
    warnings.push({
      code: 'fetch-fallback',
      message: 'Static HTML had little content and Playwright is not installed',
    });

    return html;
  }

  warnings.push({
    code: 'fetch-fallback',
    message: 'Rendered with Playwright because the static HTML had little content',
  });

  return rendered;
};

/**
 * Imports a web page as an article.
 *
 * @remarks
 * When the static HTML has fewer than 80 words the page is rendered with Playwright (if
 * installed) and a `fetch-fallback` warning records it.
 *
 * @param url - Address of the page.
 * @param opts - Import options.
 * @returns The imported document and its report.
 * @throws An `Error` for links to ebook files or failed requests, and `DocumentExistsError`
 * when the id is taken.
 */
export const importUrl = async (url: string, opts: ImportOptions): Promise<ImportResult> => {
  if (Patterns.ebookDownloadUrl.test(url)) {
    throw new Error('Download the ebook first, then import the file.');
  }

  importLogger(opts)(`Fetching ${url}…`);
  const response = await (opts.fetcher ?? defaultFetcher)(url);

  if (!response.ok) throw new Error(`Fetching ${url} failed with HTTP ${response.status}`);
  const warnings: Warning[] = [];
  const html = await renderIfMostlyEmpty(response.body.toString('utf8'), url, opts, warnings);

  return finishArticle(html, url, opts, warnings);
};

/**
 * Imports a saved `.html` page as an article.
 *
 * @remarks
 * Relative images resolve against `opts.sourceUrl`, else the page's `<link rel=canonical>`;
 * a page with no known origin reads its images from disk next to the file.
 *
 * @param file - Path of the saved page.
 * @param opts - Import options.
 * @returns The imported document and its report.
 * @throws `DocumentExistsError` when the id is taken.
 */
export const importHtmlFile = async (file: string, opts: ImportOptions): Promise<ImportResult> => {
  const html = await readFile(file, 'utf8');
  const canonical = Patterns.canonicalLinkHref.exec(html)?.[1];
  const url = opts.sourceUrl ?? canonical ?? `file://${path.resolve(file)}`;
  const hasWebOrigin = Patterns.httpOrHttpsPrefix.test(url);
  const fetcher = hasWebOrigin ? opts.fetcher : (opts.fetcher ?? diskFetcher);

  return finishArticle(html, url, { ...opts, fetcher }, []);
};
