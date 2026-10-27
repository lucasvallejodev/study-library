/**
 * Every regular expression used by `@study/core`, named after what it matches.
 *
 * @remarks
 * `(?=(…))\1` is the JavaScript idiom for an atomic group: the lookahead captures the
 * greedy run once and `\1` consumes it, so the engine never backtracks into it. The match
 * is the same as the plain `…` form.
 */
export const Patterns = {
  annotationId: /^a-[a-z0-9]+$/,
  apostrophes: /['’]/g,
  chapterFilePath: /^chapters\/[^/]+\.md$/,
  codeFence: /```[\s\S]*?```/g,
  codeFenceMarker: /```\w*/g,
  combiningDiacritics: /[̀-ͯ]/g,
  contentHash: /^sha256:[0-9a-f]{64}$/,
  edgeDash: /^-|-$/g,
  footnoteMarker: /\[\^[^\]]+\]:?/g,
  frontmatterBlock: /^---\n[\s\S]*?\n---\n/,
  frontmatterWithBody: /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/,
  htmlTag: /<(?=([^>]+))\1>/g,
  inlineMarkdownSymbols: /[*_`~#>|\\]/g,
  markdownImage: /!\[[^\]]*\]\([^)]*\)/g,
  markdownLinkWithText: /\[(?=([^\]]*))\1\]\([^)]*\)/g,
  nonSlugRun: /[^a-z0-9]+/g,
  slugId: /^[a-z0-9][a-z0-9-]*$/,
  trailingDash: /-$/,
  whitespaceRun: /\s+/g,
  word: /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu,
};

/**
 * Tells whether a string is a valid document, chapter or frontmatter id.
 *
 * @param text - Candidate id.
 * @returns True for a lowercase slug that starts with a letter or digit.
 */
export const isSlugId = (text: string): boolean => Patterns.slugId.test(text);
