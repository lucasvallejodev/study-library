import approxSearch from 'approx-string-match';

/** W3C TextQuoteSelector: the passage plus a little context on each side. */
export type QuoteSelector = {
  exact: string;
  prefix: string;
  suffix: string;
  type: 'TextQuoteSelector';
};

/** W3C TextPositionSelector: `[start, end)` character offsets in the chapter text. */
export type PositionSelector = {
  end: number;
  start: number;
  type: 'TextPositionSelector';
};

/** Any selector the anchoring functions understand. */
export type AnySelector = QuoteSelector | PositionSelector;

/**
 * Where a passage was found in the current text.
 *
 * @remarks
 * `quality` is `exact` when position and quote agree, `moved` when the quote was found
 * elsewhere, and `fuzzy` for an approximate match.
 */
export type Anchor = {
  end: number;
  quality: 'exact' | 'moved' | 'fuzzy';
  start: number;
};

type TextSpan = {
  end: number;
  start: number;
};

type Candidate = {
  end: number;
  errors: number;
  start: number;
};

/** Number of characters of context stored before and after a quote. */
export const CONTEXT_LENGTH = 32;

const MIN_FUZZY_QUOTE_LENGTH = 4;
const MAX_FUZZY_ERRORS = 256;
const FUZZY_ERROR_RATIO = 0.25;
const CONTEXT_ERROR_RATIO = 0.5;

const ScoreWeights = {
  distance: 2,
  prefix: 20,
  quote: 50,
  suffix: 20,
};

/**
 * Builds the W3C selectors for `text[start, end)`.
 *
 * @param text - The chapter text, as returned by `textOf`.
 * @param start - Offset of the first character.
 * @param end - Offset just past the last character.
 * @returns A quote selector with up to {@link CONTEXT_LENGTH} characters of context, and a
 * position selector.
 * @throws Error when the range is empty or outside the text.
 */
export const describeRange = (
  text: string,
  start: number,
  end: number
): [QuoteSelector, PositionSelector] => {
  if (start < 0 || end > text.length || start >= end) {
    throw new Error(`Invalid range ${start}-${end}`);
  }

  return [
    {
      exact: text.slice(start, end),
      prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
      suffix: text.slice(end, end + CONTEXT_LENGTH),
      type: 'TextQuoteSelector',
    },
    {
      end,
      start,
      type: 'TextPositionSelector',
    },
  ];
};

/**
 * Picks the quote selector out of a list of selectors.
 *
 * @param selectors - Selectors of one annotation.
 * @returns The first quote selector, if any.
 */
export const getQuote = (selectors: readonly AnySelector[]): QuoteSelector | undefined =>
  selectors.find((selector): selector is QuoteSelector => selector.type === 'TextQuoteSelector');

/**
 * Picks the position selector out of a list of selectors.
 *
 * @param selectors - Selectors of one annotation.
 * @returns The first position selector, if any.
 */
export const getPosition = (selectors: readonly AnySelector[]): PositionSelector | undefined =>
  selectors.find(
    (selector): selector is PositionSelector => selector.type === 'TextPositionSelector'
  );

const exactAnchorAt = (position: PositionSelector): Anchor => ({
  end: position.end,
  quality: 'exact',
  start: position.start,
});

const isPositionInside = (text: string, position: PositionSelector): boolean =>
  position.end <= text.length && position.start < position.end;

const resolvePositionOnly = (text: string, position?: PositionSelector): Anchor | null =>
  position && isPositionInside(text, position) ? exactAnchorAt(position) : null;

const allIndexesOf = (text: string, needle: string): number[] => {
  const indexes: number[] = [];

  if (!needle) return indexes;
  let index = text.indexOf(needle);

  while (index !== -1) {
    indexes.push(index);
    index = text.indexOf(needle, index + 1);
  }

  return indexes;
};

const similarity = (actual: string, expected: string): number => {
  if (!expected) return 0;
  if (actual === expected) return 1;
  const maxErrors = Math.floor(expected.length * CONTEXT_ERROR_RATIO);
  const matches = approxSearch(actual, expected, maxErrors);

  if (matches.length === 0) return 0;
  const errors = Math.min(...matches.map(match => match.errors));

  return 1 - errors / expected.length;
};

const prefixScore = (text: string, candidate: Candidate, prefix: string): number => {
  if (!prefix) return 0;
  const before = text.slice(Math.max(0, candidate.start - prefix.length), candidate.start);

  return similarity(before, prefix);
};

const suffixScore = (text: string, candidate: Candidate, suffix: string): number => {
  if (!suffix) return 0;

  return similarity(text.slice(candidate.end, candidate.end + suffix.length), suffix);
};

const distanceScore = (text: string, candidate: Candidate, hint?: number): number => {
  if (hint === undefined) return 0;

  return 1 - Math.min(1, Math.abs(candidate.start - hint) / Math.max(1, text.length));
};

const scoreCandidate = (
  text: string,
  candidate: Candidate,
  quote: QuoteSelector,
  hint?: number
): number => {
  const quoteScore = 1 - candidate.errors / Math.max(1, quote.exact.length);

  return (
    quoteScore * ScoreWeights.quote +
    prefixScore(text, candidate, quote.prefix) * ScoreWeights.prefix +
    suffixScore(text, candidate, quote.suffix) * ScoreWeights.suffix +
    distanceScore(text, candidate, hint) * ScoreWeights.distance
  );
};

const pickBest = (
  text: string,
  candidates: Candidate[],
  quote: QuoteSelector,
  hint?: number
): Candidate => {
  let best = candidates[0];
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const score = scoreCandidate(text, candidate, quote, hint);

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
};

const anchorFrom = (candidate: Candidate, quality: Anchor['quality']): Anchor => ({
  end: candidate.end,
  quality,
  start: candidate.start,
});

const resolveExactQuote = (text: string, quote: QuoteSelector, hint?: number): Anchor | null => {
  const candidates = allIndexesOf(text, quote.exact).map(start => ({
    end: start + quote.exact.length,
    errors: 0,
    start,
  }));

  if (candidates.length === 0) return null;

  return anchorFrom(pickBest(text, candidates, quote, hint), 'moved');
};

const resolveFuzzyQuote = (text: string, quote: QuoteSelector, hint?: number): Anchor | null => {
  const pattern = quote.exact;

  if (pattern.length < MIN_FUZZY_QUOTE_LENGTH) return null;
  const maxErrors = Math.min(MAX_FUZZY_ERRORS, Math.floor(pattern.length * FUZZY_ERROR_RATIO));
  const matches = approxSearch(text, pattern, maxErrors);

  if (matches.length === 0) return null;

  return anchorFrom(pickBest(text, matches, quote, hint), 'fuzzy');
};

/**
 * Re-anchors an annotation's selectors against (possibly changed) text.
 *
 * @remarks
 * Order: trust the position if the quote still matches there, then exact quote search
 * ranked by context and distance from the old position, then fuzzy matching. Without a
 * quote, the position is trusted as long as it fits in the text.
 *
 * @param text - The current chapter text, as returned by `textOf`.
 * @param selectors - Selectors saved with the annotation.
 * @returns The anchor, or null when the passage is gone (the annotation is orphaned).
 */
export const resolveSelectors = (
  text: string,
  selectors: readonly AnySelector[]
): Anchor | null => {
  const quote = getQuote(selectors);
  const position = getPosition(selectors);

  if (!quote) return resolvePositionOnly(text, position);

  if (position && text.slice(position.start, position.end) === quote.exact) {
    return exactAnchorAt(position);
  }

  const hint = position?.start;

  return resolveExactQuote(text, quote, hint) ?? resolveFuzzyQuote(text, quote, hint);
};

/**
 * Locates a bare quote, as given by CLI and AI callers.
 *
 * @remarks
 * Falls back to fuzzy matching, which tolerates typos and whitespace differences.
 *
 * @param text - The chapter text.
 * @param quote - The passage to find.
 * @returns The `[start, end)` offsets of the best match, or null when nothing is close enough.
 */
export const findQuote = (text: string, quote: string): TextSpan | null => {
  const exact = text.indexOf(quote);

  if (exact >= 0) return { end: exact + quote.length, start: exact };

  const anchor = resolveFuzzyQuote(text, {
    exact: quote,
    prefix: '',
    suffix: '',
    type: 'TextQuoteSelector',
  });

  return anchor ? { end: anchor.end, start: anchor.start } : null;
};
