'use client';

import { memo } from 'react';

import type { ElementRef } from './reader-types';

type ArticleProps = {
  articleRef: ElementRef<HTMLElement>;
  html: string;
};

export const ArticleRenderedOnce = memo(function ArticleRenderedOnce({
  articleRef,
  html,
}: ArticleProps) {
  return (
    <article
      ref={articleRef}
      className="reader-prose prose prose-lg max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
