import 'server-only';

import rehypeShiki from '@shikijs/rehype';
import type { Element, Root, Text } from 'hast';
import type { Schema } from 'hast-util-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import { isAssetPath, isHttpUrl, Patterns } from './patterns';

/**
 * A chapter rendered for the reader: `html` to display and `text`, the concatenated text nodes,
 * which is identical to the article's `textContent` in the browser (annotation offsets use it).
 */
export type RenderedChapter = {
  html: string;
  text: string;
};

const ReaderSanitizeSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'className', 'id'],
    code: [['className', Patterns.languageClassName, 'math-inline', 'math-display']],
    img: ['src', 'alt', 'title', 'width', 'height'],
  },
  clobber: [],
  clobberPrefix: '',
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'figure',
    'figcaption',
    'mark',
    'abbr',
    'cite',
    'small',
    'u',
  ],
};

const ShikiOptions = {
  defaultColor: false,
  fallbackLanguage: 'text',
  themes: { dark: 'github-dark', light: 'github-light' },
} as const;

const AssetLinkProperties = ['src', 'href'] as const;
const RENDER_CACHE_LIMIT = 200;

const pointAssetLinksAtAssetRoute = (node: Element, docId: string): void => {
  for (const property of AssetLinkProperties) {
    const value = node.properties?.[property];

    if (typeof value === 'string' && isAssetPath(value)) {
      (node.properties as Record<string, unknown>)[property] =
        `/api/assets/${docId}/${value.replace(Patterns.parentDirectoryPrefix, '')}`;
    }
  }
};

const loadImageLazily = (node: Element): void => {
  if (node.tagName !== 'img') return;

  node.properties.loading = 'lazy';
  node.properties.decoding = 'async';
};

const openExternalLinkInNewTab = (node: Element): void => {
  const href = node.properties?.href;

  if (node.tagName !== 'a' || typeof href !== 'string' || !isHttpUrl(href)) return;

  node.properties.target = '_blank';
  node.properties.rel = ['noreferrer'];
};

const prepareReaderElements = (docId: string) => () => (tree: Root) => {
  visit(tree, 'element', (node: Element) => {
    pointAssetLinksAtAssetRoute(node, docId);
    loadImageLazily(node);
    openExternalLinkInNewTab(node);
  });
};

const collectText = (tree: Root): string => {
  let text = '';

  visit(tree, 'text', (node: Text) => {
    text += node.value;
  });

  return text;
};

const renderUncached = async (docId: string, markdown: string): Promise<RenderedChapter> => {
  let text = '';

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, ReaderSanitizeSchema)
    .use(prepareReaderElements(docId))
    .use(rehypeSlug)
    .use(rehypeKatex)
    .use(rehypeShiki, ShikiOptions)
    .use(() => (tree: Root) => {
      text = collectText(tree);
    })
    .use(rehypeStringify)
    .process(markdown);

  return { html: String(file), text };
};

const renderCache = new Map<string, RenderedChapter>();

const rememberRender = (key: string, rendered: RenderedChapter): void => {
  if (renderCache.size >= RENDER_CACHE_LIMIT) {
    const oldestKey = renderCache.keys().next().value;

    if (oldestKey !== undefined) renderCache.delete(oldestKey);
  }

  renderCache.set(key, rendered);
};

/**
 * Renders chapter Markdown into sanitized reader HTML plus its plain text.
 *
 * @remarks
 * Results are cached per document and content hash (up to 200 chapters, oldest evicted first),
 * so edited chapters invalidate automatically. Relative asset paths are pointed at the asset
 * route, images load lazily and external links open in a new tab.
 *
 * @param docId - Document the chapter belongs to; used for asset URLs and the cache key.
 * @param markdown - Chapter body in Markdown.
 * @param cacheKey - Content hash of the chapter; without it the result is not cached.
 * @returns The rendered HTML and text.
 */
export const renderChapter = async (
  docId: string,
  markdown: string,
  cacheKey?: string
): Promise<RenderedChapter> => {
  const key = cacheKey ? `${docId}:${cacheKey}` : undefined;
  const cached = key ? renderCache.get(key) : undefined;

  if (cached) return cached;

  const rendered = await renderUncached(docId, markdown);

  if (key) rememberRender(key, rendered);

  return rendered;
};
