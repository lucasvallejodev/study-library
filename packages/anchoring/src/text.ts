import approxSearch from 'approx-string-match';

export type QuoteSelector = {
  exact: string;
  prefix: string;
  suffix: string;
  type: 'TextQuoteSelector';
};
export type PositionSelector = {
  end: number;
  start: number;
  type: 'TextPositionSelector';
};
export type AnySelector = QuoteSelector | PositionSelector;

export type Anchor = {
  end: number;
  /** exact = position and quote agree; moved = quote found elsewhere; fuzzy = approximate match. */
  quality: 'exact' | 'moved' | 'fuzzy';
  start: number;
};

export const CONTEXT_LENGTH = 32;

/**
 * Build the W3C selectors for text[start, end).
 *
 * @param text
 * @param start
 * @param end
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
 *
 * @param selectors
 */
export const getQuote = (selectors: readonly AnySelector[]): QuoteSelector | undefined =>
  selectors.find((s): s is QuoteSelector => s.type === 'TextQuoteSelector');

/**
 *
 * @param selectors
 */
export const getPosition = (selectors: readonly AnySelector[]): PositionSelector | undefined =>
  selectors.find((s): s is PositionSelector => s.type === 'TextPositionSelector');

/**
 * Re-anchor selectors against (possibly changed) text.
 * Order: trust the position if the quote still matches there, then exact quote search
 * ranked by context and distance, then fuzzy matching. Returns null when the passage is gone.
 *
 * @param text
 * @param selectors
 */
export const resolveSelectors = (
  text: string,
  selectors: readonly AnySelector[]
): Anchor | null => {
  const quote = getQuote(selectors);
  const position = getPosition(selectors);

  if (!quote) {
    if (position && position.end <= text.length && position.start < position.end) {
      return {
        end: position.end,
        quality: 'exact',
        start: position.start,
      };
    }

    return null;
  }

  if (position && text.slice(position.start, position.end) === quote.exact) {
    return {
      end: position.end,
      quality: 'exact',
      start: position.start,
    };
  }

  const hint = position?.start;
  const exactHits = allIndexesOf(text, quote.exact);

  if (exactHits.length > 0) {
    const best = pickBest(
      text,
      exactHits.map(s => ({
        end: s + quote.exact.length,
        errors: 0,
        start: s,
      })),
      quote,
      hint
    );

    return {
      end: best.end,
      quality: 'moved',
      start: best.start,
    };
  }

  return fuzzyResolve(text, quote, hint);
};

/**
 * Locate a bare quote (CLI / AI callers). Whitespace-insensitive fallback included.
 *
 * @param text
 * @param quote
 */
export const findQuote = (text: string, quote: string): { end: number; start: number } | null => {
  const exact = text.indexOf(quote);

  if (exact >= 0) return { end: exact + quote.length, start: exact };

  const anchor = fuzzyResolve(text, {
    exact: quote,
    prefix: '',
    suffix: '',
    type: 'TextQuoteSelector',
  });

  return anchor ? { end: anchor.end, start: anchor.start } : null;
};

const fuzzyResolve = (text: string, quote: QuoteSelector, hint?: number): Anchor | null => {
  const pattern = quote.exact;

  if (pattern.length < 4) return null;
  const maxErrors = Math.min(256, Math.floor(pattern.length * 0.25));
  const matches = approxSearch(text, pattern, maxErrors);

  if (matches.length === 0) return null;
  const best = pickBest(text, matches, quote, hint);

  return {
    end: best.end,
    quality: 'fuzzy',
    start: best.start,
  };
};

type Candidate = {
  end: number;
  errors: number;
  start: number;
};

const pickBest = (
  text: string,
  candidates: Candidate[],
  quote: QuoteSelector,
  hint?: number
): Candidate => {
  let best = candidates[0];
  let bestScore = -Infinity;

  for (const c of candidates) {
    const quoteScore = 1 - c.errors / Math.max(1, quote.exact.length);

    const prefixScore = quote.prefix
      ? similarity(text.slice(Math.max(0, c.start - quote.prefix.length), c.start), quote.prefix)
      : 0;

    const suffixScore = quote.suffix
      ? similarity(text.slice(c.end, c.end + quote.suffix.length), quote.suffix)
      : 0;

    const distanceScore =
      hint === undefined ? 0 : 1 - Math.min(1, Math.abs(c.start - hint) / Math.max(1, text.length));

    const score = quoteScore * 50 + prefixScore * 20 + suffixScore * 20 + distanceScore * 2;

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return best;
};

/**
 * Cheap similarity: shared characters from the end nearest the quote.
 *
 * @param actual
 * @param expected
 */
const similarity = (actual: string, expected: string): number => {
  if (!expected) return 0;
  if (actual === expected) return 1;
  const matches = approxSearch(actual, expected, Math.floor(expected.length / 2));

  if (matches.length === 0) return 0;
  const errors = Math.min(...matches.map(m => m.errors));

  return 1 - errors / expected.length;
};

const allIndexesOf = (text: string, needle: string): number[] => {
  const out: number[] = [];

  if (!needle) return out;
  let i = text.indexOf(needle);

  while (i !== -1) {
    out.push(i);
    i = text.indexOf(needle, i + 1);
  }

  return out;
};
