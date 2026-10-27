'use client';

import type { Annotation } from '@study/core';

import { AnnotationApi } from './api';
import type { AnnotationList } from './use-annotation-list';
import type { Notify } from './use-toast';

type BookmarkOptions = {
  chapterId: string;
  docId: string;
  list: AnnotationList;
  notify: Notify;
};

export function useBookmark(options: BookmarkOptions): {
  bookmark?: Annotation;
  toggleBookmark: () => Promise<void>;
} {
  const { chapterId, docId, list, notify } = options;
  const bookmark = list.annotations.find(annotation => annotation.type === 'bookmark');

  async function toggleBookmark() {
    if (bookmark) {
      await AnnotationApi.remove(bookmark.id);
      list.remove(bookmark.id);
      notify('Bookmark removed');

      return;
    }

    const created = await AnnotationApi.create({
      body: null,
      chapterId,
      documentId: docId,
      type: 'bookmark',
    });

    list.add(created);
    notify('Chapter bookmarked');
  }

  return { bookmark, toggleBookmark };
}
