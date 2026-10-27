import path from 'node:path/posix';

import type { EpubBook } from './epub-book';
import { resolveHref } from './epub-xml';
import { hasUrlScheme, Patterns } from './patterns';
import type { AssetStore } from './writer';

const PARENT_DIRECTORY = '../';

/** Where a chapter's images come from and go to. */
export type ImageSource = { assets: AssetStore; book: EpubBook };

const storeDataUrlImage = (dataUrl: string, assets: AssetStore): string | undefined => {
  const match = Patterns.base64ImageDataUrl.exec(dataUrl);

  return match
    ? assets.add(Buffer.from(match[2], 'base64'), match[1].replace('svg+xml', 'svg'))
    : undefined;
};

/**
 * Copies an image referenced by a chapter into the asset store.
 *
 * @param source - The book to read from and the asset store to write to.
 * @param baseFile - Archive path of the file the reference appears in.
 * @param src - Image reference as written (relative path or base64 `data:` URL).
 * @param chapterId - Chapter the image belongs to; a missing image adds a `missing-image`
 * warning for it.
 * @returns The asset path (`assets/…`), or `undefined` for external or missing images.
 */
export const importImage = async (
  source: ImageSource,
  baseFile: string,
  src: string,
  chapterId: string
): Promise<string | undefined> => {
  if (src.startsWith('data:')) return storeDataUrlImage(src, source.assets);
  if (hasUrlScheme(src)) return undefined;
  const file = resolveHref(src, baseFile).file;
  const data = await source.book.file(file);

  if (!data) {
    source.book.warnings.push({
      chapterId,
      code: 'missing-image',
      message: `Image ${src} not found in EPUB`,
    });

    return undefined;
  }

  return source.assets.add(data, path.extname(file).slice(1));
};

const imagePlaceholder = (image: Element): string => {
  const alt = image.getAttribute('alt');

  return alt ? `[Image: ${alt}]` : '';
};

const localiseImageElements = async (
  chunk: Element,
  file: string,
  source: ImageSource,
  chapterId: string
): Promise<void> => {
  for (const image of Array.from(chunk.querySelectorAll('img'))) {
    const src = image.getAttribute('src');

    image.removeAttribute('srcset');
    if (!src) continue;
    const asset = await importImage(source, file, src, chapterId);

    if (asset) image.setAttribute('src', PARENT_DIRECTORY + asset);
    else image.replaceWith(chunk.ownerDocument.createTextNode(imagePlaceholder(image)));
  }
};

const svgImageHref = (svg: Element): string | null | undefined => {
  const image = svg.querySelector('image');

  return image?.getAttribute('xlink:href') ?? image?.getAttribute('href');
};

const replaceSvgWrappedImages = async (
  chunk: Element,
  file: string,
  source: ImageSource,
  chapterId: string
): Promise<void> => {
  for (const svg of Array.from(chunk.querySelectorAll('svg'))) {
    const href = svgImageHref(svg);

    if (!href) continue;
    const asset = await importImage(source, file, href, chapterId);

    if (!asset) continue;
    const image = chunk.ownerDocument.createElement('img');

    image.setAttribute('src', PARENT_DIRECTORY + asset);
    image.setAttribute('alt', svg.getAttribute('aria-label') ?? '');
    svg.replaceWith(image);
  }
};

/**
 * Copies a chunk's images into the asset store and points them at `../assets/…`.
 *
 * @remarks
 * Images that cannot be copied become `[Image: alt]` text; SVG-wrapped images (common for
 * covers) are replaced by a plain `<img>`.
 *
 * @param chunk - Part of a chapter that comes from one spine file.
 * @param file - Archive path of that spine file.
 * @param source - The book to read from and the asset store to write to.
 * @param chapterId - Chapter the chunk belongs to, for warnings.
 */
export const localiseChunkImages = async (
  chunk: Element,
  file: string,
  source: ImageSource,
  chapterId: string
): Promise<void> => {
  await localiseImageElements(chunk, file, source, chapterId);
  await replaceSvgWrappedImages(chunk, file, source, chapterId);
};
