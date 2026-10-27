import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { documentDir } from '@study/core';

import { importSource } from '../src/index';
import { splitArticle } from '../src/url';
import { fixtureFetcher, repo, useTempLibrary } from './helpers';

const fixture = (name: string) => path.join(repo, 'fixtures/html', name);

async function chapterText(docId: string, file: string) {
  return readFile(path.join(documentDir(docId), file), 'utf8');
}

describe('web page import (offline fixtures)', () => {
  beforeAll(useTempLibrary);

  it('extracts a blog post without navigation and stores images locally', async () => {
    const { document, report } = await importSource(fixture('blog-post.html'), {
      fetcher: fixtureFetcher,
    });

    expect(document.kind).toBe('article');
    expect(document.title).toBe('Why Logs Matter');
    expect(document.source).toMatchObject({
      type: 'url',
      url: 'https://blog.example.com/posts/why-logs-matter',
    });
    const md = await chapterText(document.id, document.chapters[0].file);

    expect(md).toContain('## The append-only idea');
    expect(md).not.toContain('Popular posts');
    expect(md).not.toContain('All rights reserved');
    const img = /\.\.\/(assets\/[a-f0-9]+\.png)/.exec(md)?.[1];

    expect(img && existsSync(path.join(documentDir(document.id), img))).toBe(true);
    expect(report.warnings.filter(w => w.code === 'missing-image')).toHaveLength(0);
  });

  it('keeps code blocks and tables from a docs page', async () => {
    const { document } = await importSource(fixture('docs-page.html'), { fetcher: fixtureFetcher });
    const md = await chapterText(document.id, document.chapters[0].file);

    expect(md).toContain('max_connections = 100');
    expect(md).toMatch(/\|\s*Option\s*\|/);
    expect(md).toMatch(/\.\.\/assets\/[a-f0-9]+\.png/);
  });

  it('drops banners and ads from a news article', async () => {
    const { document } = await importSource(fixture('news-article.html'), {
      fetcher: fixtureFetcher,
    });

    expect(document.title).toBe('Local Library Opens New Wing');
    const md = await chapterText(document.id, document.chapters[0].file);

    expect(md).not.toContain('We use cookies');
    expect(document.cover).toMatch(/^assets\//);
  });

  it('downloads every image of an image-heavy page and reports the missing one', async () => {
    const { document, report } = await importSource(fixture('image-heavy.html'), {
      fetcher: fixtureFetcher,
    });

    const md = await chapterText(document.id, document.chapters[0].file);

    expect(md.match(/\.\.\/assets\/[a-f0-9]+\.png/g)?.length).toBeGreaterThanOrEqual(6);
    expect(
      report.warnings.some(w => w.code === 'missing-image' && w.message.includes('missing.png'))
    ).toBe(true);
  });

  it('flags a JavaScript-only page when Playwright is unavailable', async () => {
    const html = await readFile(fixture('js-heavy.html'));

    const fetcher = async (url: string) =>
      url === 'https://spa.example.com/post/1'
        ? {
            body: html,
            contentType: 'text/html',
            ok: true,
            status: 200,
          }
        : fixtureFetcher(url);

    const { report } = await importSource('https://spa.example.com/post/1', { fetcher });

    expect(report.warnings.some(w => w.code === 'fetch-fallback')).toBe(true);
  });

  it('splits very long articles at level-2 headings', () => {
    const section = (n: number) => `## Part ${n}\n\n${'word '.repeat(3000)}`;

    const parts = splitArticle(
      'Long',
      `Intro text.\n\n${section(1)}\n\n${section(2)}\n\n${section(3)}`
    );

    expect(parts.map(p => p.title)).toEqual(['Introduction', 'Part 1', 'Part 2', 'Part 3']);
  });
});
