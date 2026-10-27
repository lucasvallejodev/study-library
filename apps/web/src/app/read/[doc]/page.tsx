import type { Metadata } from 'next';
import Link from 'next/link';

import { DocumentActions } from '@/components/document-actions';
import { Cover, ProgressBar, roundedPercent } from '@/components/ui';
import { documentPercent, documentProgress, getDocument } from '@/lib/data';
import { type ChapterAnnotationCount, chapterAnnotationCounts } from '@/lib/documents';
import type { ChapterEntry, ChapterMatter, LibraryDocument } from '@study/core';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ doc: string }> };

type ChapterProgress = Awaited<ReturnType<typeof documentProgress>>[number];

type DocumentOverview = {
  annotationCounts: ChapterAnnotationCount[];
  doc: LibraryDocument;
  progress: ChapterProgress[];
};

type ChapterGroupSpec = {
  label: string;
  matter: ChapterMatter;
  openByDefault: boolean;
};

const WORDS_PER_MINUTE = 250;
const MINUTES_PER_HOUR = 60;

const ChapterGroups: ChapterGroupSpec[] = [
  // keep order
  {
    label: 'Front matter',
    matter: 'front',
    openByDefault: false,
  },
  {
    label: 'Contents',
    matter: 'body',
    openByDefault: true,
  },
  {
    label: 'Back matter',
    matter: 'back',
    openByDefault: false,
  },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc } = await params;
  const loaded = await getDocument(doc).catch(() => null);

  return { title: loaded?.title ?? 'Not found' };
}

export default async function DocumentPage({ params }: Props) {
  const { doc: docId } = await params;
  const overview = await loadDocumentOverview(docId);

  return (
    <main className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-[220px_1fr]">
      <DocumentSidebar overview={overview} />
      <section>
        <DocumentHeader doc={overview.doc} />
        {ChapterGroups.map(group => (
          <ChapterGroup key={group.matter} group={group} overview={overview} />
        ))}
      </section>
    </main>
  );
}

async function loadDocumentOverview(docId: string): Promise<DocumentOverview> {
  const doc = await getDocument(docId);
  const progress = await documentProgress(docId);
  const annotationCounts = await chapterAnnotationCounts(docId);

  return {
    annotationCounts,
    doc,
    progress,
  };
}

function latestProgress(progress: ChapterProgress[]): ChapterProgress | undefined {
  return [...progress].sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()
  )[0];
}

function firstBodyChapter(doc: LibraryDocument): ChapterEntry {
  return doc.chapters.find(chapter => chapter.matter === 'body') ?? doc.chapters[0];
}

function bodyWordCount(doc: LibraryDocument): number {
  return doc.chapters
    .filter(chapter => chapter.matter === 'body')
    .reduce((total, chapter) => total + chapter.wordCount, 0);
}

function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function readingHours(words: number): number {
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE / MINUTES_PER_HOUR));
}

function DocumentSidebar({ overview }: { overview: DocumentOverview }) {
  const { doc, progress } = overview;
  const last = latestProgress(progress);
  const continueId = last?.chapterId ?? firstBodyChapter(doc).id;
  const percent = documentPercent(doc, progress);
  const totalWords = bodyWordCount(doc);

  return (
    <aside>
      <Cover docId={doc.id} cover={doc.cover} title={doc.title} />
      <Link
        href={`/read/${doc.id}/${continueId}`}
        className="mt-4 block rounded-md bg-accent px-4 py-2 text-center text-white"
      >
        {last ? 'Continue reading' : 'Start reading'}
      </Link>
      <ProgressBar value={percent} className="mt-4" />
      <p className="mt-1 text-xs text-muted">
        {roundedPercent(percent)}% read · {totalWords.toLocaleString()} words · ~
        {readingHours(totalWords)} h
      </p>
      <DocumentActions docId={doc.id} />
    </aside>
  );
}

function sourceUrlOf(doc: LibraryDocument): string | undefined {
  return 'url' in doc.source ? doc.source.url : undefined;
}

function DocumentHeader({ doc }: { doc: LibraryDocument }) {
  const sourceUrl = sourceUrlOf(doc);

  return (
    <>
      <p className="text-xs uppercase tracking-wider text-muted">{doc.kind}</p>
      <h1 className="mt-1 font-serif text-4xl leading-tight">{doc.title}</h1>
      {doc.authors.length > 0 && (
        <p className="mt-2 text-lg text-muted">{doc.authors.join(', ')}</p>
      )}
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block truncate text-sm text-accent"
        >
          {sourceUrl}
        </a>
      )}
      {doc.description && <p className="mt-4 font-serif text-muted">{doc.description}</p>}
    </>
  );
}

function hasNoBodyChapters(doc: LibraryDocument): boolean {
  return doc.chapters.every(chapter => chapter.matter !== 'body');
}

function ChapterGroup({
  group,
  overview,
}: {
  group: ChapterGroupSpec;
  overview: DocumentOverview;
}) {
  const { doc } = overview;
  const chapters = doc.chapters.filter(chapter => chapter.matter === group.matter);

  if (!chapters.length) return null;

  return (
    <details open={group.openByDefault || hasNoBodyChapters(doc)} className="mt-8">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted">
        {group.label} ({chapters.length})
      </summary>
      <ol className="mt-3 divide-y divide-line border-y border-line">
        {chapters.map(chapter => (
          <ChapterRow key={chapter.id} chapter={chapter} overview={overview} />
        ))}
      </ol>
    </details>
  );
}

function chapterPercent(overview: DocumentOverview, chapterId: string): number {
  return overview.progress.find(row => row.chapterId === chapterId)?.percent ?? 0;
}

function chapterAnnotationCount(overview: DocumentOverview, chapterId: string): number {
  return overview.annotationCounts.find(row => row.chapterId === chapterId)?.count ?? 0;
}

function chapterIndent(depth: number): string {
  return `${depth - 1}rem`;
}

function ChapterRow({ chapter, overview }: { chapter: ChapterEntry; overview: DocumentOverview }) {
  const percent = chapterPercent(overview, chapter.id);
  const annotationCount = chapterAnnotationCount(overview, chapter.id);

  return (
    <li>
      <Link
        href={`/read/${overview.doc.id}/${chapter.id}`}
        className="flex items-center gap-3 py-2.5 hover:bg-panel"
        style={{ paddingLeft: chapterIndent(chapter.depth) }}
      >
        <span className="flex-1 font-serif">{chapter.title}</span>
        {annotationCount > 0 && (
          <span className="rounded-full bg-panel px-2 text-xs text-muted">
            {annotationCount} notes
          </span>
        )}
        <span className="w-16 text-right text-xs text-muted">
          {readingMinutes(chapter.wordCount)} min
        </span>
        <span className="w-10">{percent > 0 && <ProgressBar value={percent} />}</span>
      </Link>
    </li>
  );
}
