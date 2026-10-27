import approxSearch from "approx-string-match";

export type QuoteSelector = { type: "TextQuoteSelector"; exact: string; prefix: string; suffix: string };
export type PositionSelector = { type: "TextPositionSelector"; start: number; end: number };
export type AnySelector = QuoteSelector | PositionSelector;

export type Anchor = {
  start: number;
  end: number;
  /** exact = position and quote agree; moved = quote found elsewhere; fuzzy = approximate match. */
  quality: "exact" | "moved" | "fuzzy";
};

export const CONTEXT_LENGTH = 32;

/** Build the W3C selectors for text[start, end). */
export function describeRange(text: string, start: number, end: number): [QuoteSelector, PositionSelector] {
  if (start < 0 || end > text.length || start >= end) throw new Error(`Invalid range ${start}-${end}`);
  return [
    {
      type: "TextQuoteSelector",
      exact: text.slice(start, end),
      prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
      suffix: text.slice(end, end + CONTEXT_LENGTH),
    },
    { type: "TextPositionSelector", start, end },
  ];
}

export function getQuote(selectors: readonly AnySelector[]): QuoteSelector | undefined {
  return selectors.find((s): s is QuoteSelector => s.type === "TextQuoteSelector");
}

export function getPosition(selectors: readonly AnySelector[]): PositionSelector | undefined {
  return selectors.find((s): s is PositionSelector => s.type === "TextPositionSelector");
}

/**
 * Re-anchor selectors against (possibly changed) text.
 * Order: trust the position if the quote still matches there, then exact quote search
 * ranked by context and distance, then fuzzy matching. Returns null when the passage is gone.
 */
export function resolveSelectors(text: string, selectors: readonly AnySelector[]): Anchor | null {
  const quote = getQuote(selectors);
  const position = getPosition(selectors);

  if (!quote) {
    if (position && position.end <= text.length && position.start < position.end) {
      return { start: position.start, end: position.end, quality: "exact" };
    }
    return null;
  }

  if (position && text.slice(position.start, position.end) === quote.exact) {
    return { start: position.start, end: position.end, quality: "exact" };
  }

  const hint = position?.start;
  const exactHits = allIndexesOf(text, quote.exact);
  if (exactHits.length > 0) {
    const best = pickBest(text, exactHits.map((s) => ({ start: s, end: s + quote.exact.length, errors: 0 })), quote, hint);
    return { start: best.start, end: best.end, quality: "moved" };
  }

  return fuzzyResolve(text, quote, hint);
}

/** Locate a bare quote (CLI / AI callers). Whitespace-insensitive fallback included. */
export function findQuote(text: string, quote: string): { start: number; end: number } | null {
  const exact = text.indexOf(quote);
  if (exact >= 0) return { start: exact, end: exact + quote.length };
  const anchor = fuzzyResolve(text, { type: "TextQuoteSelector", exact: quote, prefix: "", suffix: "" });
  return anchor ? { start: anchor.start, end: anchor.end } : null;
}

function fuzzyResolve(text: string, quote: QuoteSelector, hint?: number): Anchor | null {
  const pattern = quote.exact;
  if (pattern.length < 4) return null;
  const maxErrors = Math.min(256, Math.floor(pattern.length * 0.25));
  const matches = approxSearch(text, pattern, maxErrors);
  if (matches.length === 0) return null;
  const best = pickBest(text, matches, quote, hint);
  return { start: best.start, end: best.end, quality: "fuzzy" };
}

type Candidate = { start: number; end: number; errors: number };

function pickBest(text: string, candidates: Candidate[], quote: QuoteSelector, hint?: number): Candidate {
  let best = candidates[0]!;
  let bestScore = -Infinity;
  for (const c of candidates) {
    const quoteScore = 1 - c.errors / Math.max(1, quote.exact.length);
    const prefixScore = quote.prefix ? similarity(text.slice(Math.max(0, c.start - quote.prefix.length), c.start), quote.prefix) : 0;
    const suffixScore = quote.suffix ? similarity(text.slice(c.end, c.end + quote.suffix.length), quote.suffix) : 0;
    const distanceScore = hint === undefined ? 0 : 1 - Math.min(1, Math.abs(c.start - hint) / Math.max(1, text.length));
    const score = quoteScore * 50 + prefixScore * 20 + suffixScore * 20 + distanceScore * 2;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** Cheap similarity: shared characters from the end nearest the quote. */
function similarity(actual: string, expected: string): number {
  if (!expected) return 0;
  if (actual === expected) return 1;
  const matches = approxSearch(actual, expected, Math.floor(expected.length / 2));
  if (matches.length === 0) return 0;
  const errors = Math.min(...matches.map((m) => m.errors));
  return 1 - errors / expected.length;
}

function allIndexesOf(text: string, needle: string): number[] {
  const out: number[] = [];
  if (!needle) return out;
  let i = text.indexOf(needle);
  while (i !== -1) {
    out.push(i);
    i = text.indexOf(needle, i + 1);
  }
  return out;
}
