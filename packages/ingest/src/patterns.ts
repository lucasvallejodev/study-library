/** Regular expressions used by the importers, named after what they match. */
export const Patterns = {
  backMatterPageTitle: /colophon|uncopyright|about/i,
  base64DataUrlWithImageType: /^data:(image\/[a-z+]+);base64,(.*)$/i,
  base64ImageDataUrl: /^data:image\/([a-z+]+);base64,(.*)$/i,
  byteOrderMark: /\uFEFF/g,
  canonicalLinkHref: /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
  carriageReturnLineFeed: /\r\n/g,
  chapterFileExtension: /\.md$/,
  codeFenceStart: /^(```|~~~)/,
  ebookDownloadUrl: /^https?:\/\/[^/]*\/.*\.(?:epub|mobi|azw3?)(?:\?|$)/i,
  encryptionAlgorithm: /EncryptionMethod[^>]*Algorithm="([^"]+)"/g,
  excessBlankLines: /\n{3,}/g,
  footnotePlaceholder: /FNREFTOKEN(\d+)X/g,
  headingEmphasisMarks: /[*_`]/g,
  htmlImageSource: /<img[^>]+src=["']([^"']+)["']/g,
  httpOrHttpsPrefix: /^https?:/,
  httpUrl: /^https?:\/\//i,
  imageFileExtension: /\.(png|jpe?g|gif|webp|svg|avif)(?:$|\?)/i,
  jpegExtension: /^jpeg$/,
  lineTerminator: /[\n\r\u2028\u2029]/,
  markdownImageTarget: /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
  matterPageTitle:
    /^(cover|title ?page|half ?title|imprint|copyright|colophon|uncopyright|about the (publisher|ebook)|table of contents|contents)$/i,
  mobiPalmDatabaseType: /BOOKMOBI|TEXtREAd/,
  nonAlphanumericLowercase: /[^a-z0-9]/g,
  nonBreakingSpace: /\u00A0/g,
  nonDigits: /\D/g,
  nonLetterOrDigitRun: /[^\p{L}\p{N}]+/gu,
  noteBacklinkArrow: /^[↩↑]$/,
  pageHeadingContent: /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  quoteOrBackslash: /["\\]/g,
  spanTag: /<\/?span[^>]*>/g,
  subHeadingMarker: /^(#{2,5})\s/,
  titleSuffixSeparator: /^\s*[-|–—:·]/,
  trailingSpacesAndTabs: /(?<![ \t])[ \t]+$/gm,
  urlScheme: /^[a-z]+:/i,
  whitespaceRun: /\s+/g,
};

/**
 * Tells whether a link or image reference carries a URL scheme (`https:`, `mailto:`, `data:`…).
 *
 * @param href - Reference as written in the source document.
 * @returns True when the reference is not a relative path inside the book or folder.
 */
export const hasUrlScheme = (href: string): boolean => Patterns.urlScheme.test(href);
