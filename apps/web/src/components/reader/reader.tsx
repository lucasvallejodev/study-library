'use client';

import { useRef } from 'react';

import { annotationPath } from '../annotations';
import { ArticleRenderedOnce } from './article';
import { ChapterNavigation } from './chapter-navigation';
import { ChapterNotes } from './chapter-notes';
import { MarginNotes } from './margin-notes';
import { NotesSheet } from './notes-sheet';
import { OrphanedNotesSection } from './orphaned-notes';
import { ReaderToolbar, ReadingProgressBar } from './reader-toolbar';
import type { ElementRef, ReaderProps } from './reader-types';
import { SelectionPopover } from './selection-popover';
import { Toast } from './toast';
import { TocDrawer } from './toc-drawer';
import { useBookmark } from './use-bookmark';
import { type ReaderAnnotations, useReaderAnnotations } from './use-reader-annotations';
import { useReaderInteractions } from './use-reader-interactions';
import { type ReaderPanels, useReaderPanels } from './use-reader-panels';
import { useReadingProgress } from './use-reading-progress';
import { useSelectionPopover } from './use-selection-popover';
import { type Notify, useToast } from './use-toast';

export function Reader(props: ReaderProps) {
  const { chapter, doc } = props;
  const articleRef = useRef<HTMLElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { flash, toast } = useToast();
  const target = { chapterId: chapter.id, docId: doc.id };

  const annotations = useReaderAnnotations({
    ...target,
    articleRef,
    initialAnnotations: props.initialAnnotations,
    notify: flash,
  });

  const panels = useReaderPanels();
  const { closePopover, popover } = useSelectionPopover(articleRef, wrapperRef);

  const { onArticleClick, startNote } = useReaderInteractions({
    annotations,
    articleRef,
    closePopover,
    docId: doc.id,
    initialPosition: props.initialPosition,
    next: props.next,
    panels,
    prev: props.prev,
  });

  return (
    <div className="relative" ref={wrapperRef}>
      <ReaderHeader
        {...props}
        annotations={annotations}
        articleRef={articleRef}
        notify={flash}
        panels={panels}
      />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 xl:grid-cols-[minmax(0,1fr)_680px_minmax(300px,1fr)]">
        <div className="hidden xl:block" />
        <ReaderMainColumn
          {...props}
          annotations={annotations}
          articleRef={articleRef}
          notify={flash}
          onArticleClick={onArticleClick}
        />
        <MarginNotes
          articleRef={articleRef}
          controls={annotations.controls}
          onHover={annotations.setHoverId}
          ordered={annotations.ordered}
          ranges={annotations.ranges}
        />
      </div>
      <NotesSheet
        controls={annotations.controls}
        onClose={panels.closeSheet}
        open={panels.sheetOpen}
        ordered={annotations.ordered}
        orphans={annotations.orphans}
      />
      {popover && (
        <SelectionPopover
          {...target}
          articleRef={articleRef}
          closePopover={closePopover}
          notify={flash}
          onCreated={annotations.list.add}
          onNoteStarted={startNote}
          popover={popover}
        />
      )}
      <TocDrawer
        open={panels.tocOpen}
        onClose={panels.closeToc}
        docId={doc.id}
        docTitle={doc.title}
        currentId={chapter.id}
        items={props.toc}
      />
      {toast && <Toast message={toast} />}
    </div>
  );
}

type ReaderSectionProps = ReaderProps & {
  annotations: ReaderAnnotations;
  articleRef: ElementRef<HTMLElement>;
  notify: Notify;
};

function ReaderHeader(props: ReaderSectionProps & { panels: ReaderPanels }) {
  const { annotations, articleRef, chapter, doc, notify, panels } = props;
  const target = { chapterId: chapter.id, docId: doc.id };

  const progress = useReadingProgress({
    ...target,
    articleRef,
    initialPosition: props.initialPosition,
  });

  const { bookmark, toggleBookmark } = useBookmark({
    ...target,
    list: annotations.list,
    notify,
  });

  return (
    <>
      <ReadingProgressBar progress={progress} />
      <ReaderToolbar
        bookmarked={Boolean(bookmark)}
        chapterTitle={chapter.title}
        doc={doc}
        noteCount={annotations.ordered.length + annotations.orphans.length}
        onOpenToc={panels.openToc}
        onToggleBookmark={toggleBookmark}
        onToggleSheet={panels.toggleSheet}
        progress={progress}
      />
    </>
  );
}

function ReaderMainColumn(
  props: ReaderSectionProps & { onArticleClick: (event: React.MouseEvent) => void }
) {
  const { annotations, articleRef, chapter, doc } = props;

  return (
    <main className="min-w-0 py-10">
      <SourceLink url={chapter.sourceUrl} />
      <div onClick={props.onArticleClick} className="mx-auto max-w-[680px]">
        <ArticleRenderedOnce html={props.html} articleRef={articleRef} />
      </div>
      <OrphanedNotesSection controls={annotations.controls} orphans={annotations.orphans} />
      <ReaderChapterNotes annotations={annotations} notify={props.notify} />
      <ChapterNavigation docId={doc.id} next={props.next} prev={props.prev} />
    </main>
  );
}

function SourceLink({ url }: { url?: string }) {
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mb-6 block truncate text-sm text-muted hover:text-accent"
    >
      Source: {url}
    </a>
  );
}

type ReaderChapterNotesProps = {
  annotations: ReaderAnnotations;
  notify: Notify;
};

function ReaderChapterNotes({ annotations, notify }: ReaderChapterNotesProps) {
  const { chapterId, docId } = annotations.controls;
  const { list } = annotations;

  return (
    <ChapterNotes
      documentId={docId}
      chapterId={chapterId}
      notes={annotations.chapterNotes}
      onCreate={list.add}
      onChange={list.replace}
      onDelete={list.remove}
      link={annotationId => annotationPath(docId, chapterId, annotationId)}
      notify={notify}
    />
  );
}
