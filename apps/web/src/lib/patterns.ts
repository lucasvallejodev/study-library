/** Regular expressions used by the web app's server code, named after what they match. */
export const Patterns = {
  assetPath: /^(\.\.\/)?assets\//,
  httpUrlPrefix: /^https?:/,
  importableFileExtension: /\.(epub|mobi|azw|azw3|prc|html?|md|markdown)$/i,
  languageClassName: /^language-./,
  lineBreak: /\n/g,
  lineBreakRun: /\n+/g,
  lineStart: /^/gm,
  parentDirectoryPrefix: /^\.\.\//,
  relativeAssetReference: /\.\.\/assets\//g,
  relativeDuration: /^(\d+)([dhm])$/,
  trailingSlash: /\/$/,
};

/**
 * Tells whether a link target is an absolute http or https URL.
 *
 * @param text - Link target as written in the HTML.
 * @returns True for `http:` and `https:` URLs.
 */
export const isHttpUrl = (text: string): boolean => Patterns.httpUrlPrefix.test(text);

/**
 * Tells whether a path points into a document's `assets/` folder.
 *
 * @param text - Relative path as written in the chapter (`assets/x.png` or `../assets/x.png`).
 * @returns True when the path starts with `assets/`, optionally preceded by `../`.
 */
export const isAssetPath = (text: string): boolean => Patterns.assetPath.test(text);

/**
 * Tells whether an uploaded file name has an extension the importers accept.
 *
 * @param fileName - Name of the uploaded file.
 * @returns True for EPUB, MOBI, AZW, AZW3, PRC, HTML and Markdown files (any case).
 */
export const isImportableFileName = (fileName: string): boolean =>
  Patterns.importableFileExtension.test(fileName);

/**
 * Joins a multi-line text into one line, replacing each run of line breaks with a space.
 *
 * @param text - Text that may contain line breaks.
 * @returns The text on a single line.
 */
export const flattenLineBreaks = (text: string): string => text.replace(Patterns.lineBreakRun, ' ');

/**
 * Indents every line after the first one, so a multi-line text stays inside a list item.
 *
 * @param text - Text that may contain line breaks.
 * @param indent - Prefix added after each line break.
 * @returns The text with continuation lines indented.
 */
export const indentContinuationLines = (text: string, indent: string): string =>
  text.replace(Patterns.lineBreak, `\n${indent}`);

/**
 * Indents every line of a text, including the first one.
 *
 * @param text - Text that may contain line breaks.
 * @param indent - Prefix added at the start of each line.
 * @returns The indented text.
 */
export const indentLines = (text: string, indent: string): string =>
  text.replace(Patterns.lineStart, indent);
