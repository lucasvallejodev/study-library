import { describe, expect, it } from 'vitest';

import { chapterImages } from '../src/chapter-images';

const CHAPTER = [
  '## Architecture',
  '',
  '![The write path](../assets/1a2b.png "Figure 1")',
  '',
  'Some text.',
  '',
  '<img src="../assets/3c4d.svg" alt="Read path" width="400">',
  '',
  '![Again](../assets/1a2b.png)',
  '![External](https://example.com/remote.png)',
].join('\n');

describe('chapterImages', () => {
  it('lists local images once each, in reading order, with alt text and line', () => {
    expect(chapterImages(CHAPTER)).toEqual([
      {
        alt: 'The write path',
        asset: 'assets/1a2b.png',
        line: 3,
      },
      {
        alt: 'Read path',
        asset: 'assets/3c4d.svg',
        line: 7,
      },
    ]);
  });

  it('returns nothing for a chapter without images', () => {
    expect(chapterImages('Just text.')).toEqual([]);
  });
});
