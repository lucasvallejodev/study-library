import { describe, expect, it } from 'vitest';

import { describeRange, findQuote, resolveSelectors } from '../src/text';

const text =
  'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: ' +
  'once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it.';

describe('anchoring', () => {
  it('round-trips an unchanged text exactly', () => {
    const start = text.indexOf('peeped into the book');
    const selectors = describeRange(text, start, start + 'peeped into the book'.length);

    expect(resolveSelectors(text, selectors)).toEqual({
      end: start + 20,
      quality: 'exact',
      start,
    });
  });

  it('re-anchors when text is inserted before the passage', () => {
    const start = text.indexOf('peeped into the book');
    const selectors = describeRange(text, start, start + 20);
    const changed = 'CHAPTER ONE. ' + text;
    const anchor = resolveSelectors(changed, selectors)!;

    expect(anchor.quality).toBe('moved');
    expect(changed.slice(anchor.start, anchor.end)).toBe('peeped into the book');
  });

  it('uses context to pick between repeated quotes', () => {
    const start = text.lastIndexOf('her sister');
    const selectors = describeRange(text, start, start + 'her sister'.length);
    const changed = 'Preface. ' + text;
    const anchor = resolveSelectors(changed, selectors)!;

    expect(anchor.start).toBe(changed.lastIndexOf('her sister'));
  });

  it('fuzzy matches after small edits to the passage', () => {
    const quote = 'it had no pictures or conversations in it';
    const start = text.indexOf(quote);
    const selectors = describeRange(text, start, start + quote.length);
    const changed = text.replace('no pictures or conversations', 'no pictures nor conversations');
    const anchor = resolveSelectors(changed, selectors)!;

    expect(anchor.quality).toBe('fuzzy');
    expect(changed.slice(anchor.start, anchor.end)).toContain('pictures nor conversations');
  });

  it('returns null (orphan) when the passage is gone', () => {
    const quote = 'peeped into the book her sister was reading';
    const start = text.indexOf(quote);
    const selectors = describeRange(text, start, start + quote.length);

    expect(
      resolveSelectors(
        'A completely different chapter about the Mock Turtle and the Gryphon.',
        selectors
      )
    ).toBeNull();
  });

  it('finds a bare quote with typos', () => {
    expect(findQuote(text, 'tired of sitting by her sister')).not.toBeNull();
    expect(findQuote(text, 'tired of siting by her sistr')).not.toBeNull();
  });
});
