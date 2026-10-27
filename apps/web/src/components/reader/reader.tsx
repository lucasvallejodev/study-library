'use client';

import { useRef, useState } from 'react';

import { aiPromptPath, annotationPath, copyText, copyTextFrom } from '../annotations';
import { ArticleRenderedOnce } from './article';
import { ChapterNavigation } from './chapter-navigation';
import { ChapterNotes } from './chapter-notes';
import { ImageLightbox, zoomableImageOf, type ZoomedImage } from './image-lightbox';
import { NoteBubble } from './note-bubble';
import { NoteMarkers } from './note-markers';
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

  const zoom = useImageZoom();

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
      <ReaderMainColumn
        {...props}
        annotations={annotations}
        articleRef={articleRef}
        notify={flash}
        onArticleClick={event => zoom.zoomOrElse(event, onArticleClick)}
      />
      <PassageNotes annotations={annotations} articleRef={articleRef} wrapperRef={wrapperRef} />
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
      <ImageLightbox image={zoom.image} onClose={zoom.close} />
      {toast && <Toast message={toast} />}
    </div>
  );
}

type ImageZoom = {
  close: () => void;
  image?: ZoomedImage;
  zoomOrElse: (event: React.MouseEvent, onOtherClick: (event: React.MouseEvent) => void) => void;
};

function useImageZoom(): ImageZoom {
  const [image, setImage] = useState<ZoomedImage>();

  function zoomOrElse(event: React.MouseEvent, onOtherClick: (event: React.MouseEvent) => void) {
    const clicked = zoomableImageOf(event.target);

    if (clicked) setImage(clicked);
    else onOtherClick(event);
  }

  return {
    close: () => setImage(undefined),
    image,
    zoomOrElse,
  };
}

type PassageNotesProps = {
  annotations: ReaderAnnotations;
  articleRef: ElementRef<HTMLElement>;
  wrapperRef: ElementRef<HTMLDivElement>;
};

function PassageNotes({ annotations, articleRef, wrapperRef }: PassageNotesProps) {
  const { ordered, ranges } = annotations;

  return (
    <>
      <NoteMarkers
        articleRef={articleRef}
        onOpen={annotations.openBubble}
        ordered={ordered}
        ranges={ranges}
        wrapperRef={wrapperRef}
      />
      <NoteBubble
        annotationId={annotations.bubbleId}
        articleRef={articleRef}
        controls={annotations.controls}
        onClose={annotations.closeBubble}
        ordered={ordered}
        ranges={ranges}
        wrapperRef={wrapperRef}
      />
    </>
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

  async function copyAiNotesPrompt() {
    await copyText(`/highlight-notes ${doc.id} ${chapter.id}`);
    notify('Prompt copied — paste it into your AI agent');
  }

  async function copyChapterAiPrompt() {
    await copyTextFrom(aiPromptPath(doc.id, chapter.id));
    notify('Chapter copied — paste it into any AI assistant');
  }

  return (
    <>
      <ReadingProgressBar progress={progress} />
      <ReaderToolbar
        bookmarked={Boolean(bookmark)}
        chapterTitle={chapter.title}
        doc={doc}
        noteCount={annotations.ordered.length + annotations.orphans.length}
        onOpenToc={panels.openToc}
        onCopyAiPrompt={copyChapterAiPrompt}
        onCopyAiNotesPrompt={copyAiNotesPrompt}
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
    <main className="mx-auto min-w-0 max-w-[900px] px-4 py-10">
      <SourceLink url={chapter.sourceUrl} />
      <div onClick={props.onArticleClick}>
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
