import Link from 'next/link';

import { annotationAnchorHref, quoteOf } from '@/components/annotations';
import { escapeHtmlKeepingMarks } from '@/components/patterns';
import { search, toAnnotation } from '@/lib/data';
import type { Annotation } from '@study/core';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search' };

type Props = { searchParams: Promise<{ q?: string }> };

type SearchResults = Awaited<ReturnType<typeof search>>;

type ChapterHit = SearchResults['chapters'][number];

type DocumentHit = SearchResults['documents'][number];

const SEARCH_PLACEHOLDER =
  'Search chapters and notes — try "white rabbit" or monster -frankenstein';

const SECTION_HEADING_CLASS = 'text-xs font-semibold uppercase tracking-wider text-muted';

export default async function SearchPage({ searchParams }: Props) {
  const { q: query = '' } = await searchParams;
  const results = await searchFor(query);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <form>
        <input
          name="q"
          defaultValue={query}
          autoFocus
          placeholder={SEARCH_PLACEHOLDER}
          className="w-full rounded-lg border border-line bg-panel px-4 py-3 text-lg outline-none focus:border-accent"
        />
      </form>
      {results && (
        <>
          {results.documents.length > 0 && <DocumentResults documents={results.documents} />}
          <NoteResults notes={results.notes.map(toAnnotation)} />
          <ChapterResults chapters={results.chapters} />
        </>
      )}
    </main>
  );
}

async function searchFor(query: string): Promise<SearchResults | null> {
  const trimmed = query.trim();

  return trimmed ? search(trimmed) : null;
}

function DocumentResults({ documents }: { documents: DocumentHit[] }) {
  return (
    <section className="mt-8">
      <h2 className={SECTION_HEADING_CLASS}>Documents</h2>
      <ul className="mt-2 space-y-1">
        {documents.map(doc => (
          <li key={doc.id}>
            <Link href={`/read/${doc.id}`} className="font-serif text-lg hover:text-accent">
              {doc.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NoteResults({ notes }: { notes: Annotation[] }) {
  return (
    <section className="mt-8">
      <h2 className={SECTION_HEADING_CLASS}>Your highlights and notes ({notes.length})</h2>
      <ul className="mt-2 space-y-3">
        {notes.map(note => (
          <NoteResult key={note.id} note={note} />
        ))}
      </ul>
    </section>
  );
}

function NoteResult({ note }: { note: Annotation }) {
  const quote = quoteOf(note);

  return (
    <li className="rounded-lg border border-line p-3 text-sm">
      <Link href={annotationAnchorHref(note) ?? '/notebook'} className="hover:text-accent">
        {quote !== undefined && <span className="font-serif">“{quote}”</span>}
        {note.body && <span className="mt-1 block text-muted">{note.body}</span>}
      </Link>
    </li>
  );
}

function ChapterResults({ chapters }: { chapters: ChapterHit[] }) {
  return (
    <section className="mt-8">
      <h2 className={SECTION_HEADING_CLASS}>Chapters ({chapters.length})</h2>
      <ul className="mt-2 space-y-4">
        {chapters.map(chapter => (
          <ChapterResult key={`${chapter.documentId}/${chapter.chapterId}`} chapter={chapter} />
        ))}
      </ul>
    </section>
  );
}

function ChapterResult({ chapter }: { chapter: ChapterHit }) {
  return (
    <li>
      <Link
        href={`/read/${chapter.documentId}/${chapter.chapterId}`}
        className="font-serif text-lg hover:text-accent"
      >
        {chapter.title}
      </Link>
      <div className="text-xs text-muted">{chapter.documentTitle}</div>
      <p
        className="mt-1 font-serif text-sm text-muted [&_mark]:bg-yellow-300/40 [&_mark]:text-inherit"
        dangerouslySetInnerHTML={{ __html: escapeHtmlKeepingMarks(chapter.snippet) }}
      />
    </li>
  );
}
