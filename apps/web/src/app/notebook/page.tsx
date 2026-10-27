import Link from 'next/link';

import { annotationAnchorHref, HighlightColors, quoteOf, tagHref } from '@/components/annotations';
import { FreeNoteForm, NotebookItemActions } from '@/components/notebook-client';
import { MarkdownView } from '@/components/notes/markdown-view';
import { relativeTime } from '@/components/ui';
import { type AnnotationFilter, listAnnotations, toAnnotation } from '@/lib/data';
import { type Annotation, type LibraryDocument, listDocumentIds, readDocument } from '@study/core';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notebook' };

type NotebookParams = Record<string, string | undefined>;

type Props = { searchParams: Promise<NotebookParams> };

type Notebook = {
  docs: LibraryDocument[];
  items: Annotation[];
  tags: string[];
};

const FREE_NOTES_FILTER = '_free';
const NOTEBOOK_LIMIT = 500;
const FILTER_CLASS = 'rounded border border-line bg-panel px-2 py-1.5';

export default async function NotebookPage({ searchParams }: Props) {
  const params = await searchParams;
  const notebook = await loadNotebook(params);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-3xl">Notebook</h1>
        <span className="text-sm text-muted">{notebook.items.length} items</span>
      </div>
      <NotebookFilters params={params} notebook={notebook} />
      <FreeNoteForm />
      <ul className="mt-8 space-y-4">
        {notebook.items.map(annotation => (
          <NotebookItem key={annotation.id} annotation={annotation} docs={notebook.docs} />
        ))}
        {notebook.items.length === 0 && (
          <li className="text-center text-muted">
            Nothing here yet. Select text while reading to highlight it.
          </li>
        )}
      </ul>
    </main>
  );
}

async function loadNotebook(params: NotebookParams): Promise<Notebook> {
  const docs = await loadAllDocuments();
  const rows = await listAnnotations(annotationFilterOf(params));
  const freeOnly = params.doc === FREE_NOTES_FILTER;
  const items = rows.map(toAnnotation).filter(annotation => !freeOnly || !annotation.documentId);

  return {
    docs,
    items,
    tags: distinctTags(items),
  };
}

async function loadAllDocuments(): Promise<LibraryDocument[]> {
  const ids = await listDocumentIds();

  return Promise.all(ids.map(id => readDocument(id)));
}

function annotationFilterOf(params: NotebookParams): AnnotationFilter {
  return {
    color: params.color || undefined,
    documentId: params.doc || undefined,
    free: params.doc === FREE_NOTES_FILTER,
    limit: NOTEBOOK_LIMIT,
    q: params.q || undefined,
    tag: params.tag || undefined,
    type: params.type || undefined,
  };
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;

  return 0;
}

function distinctTags(items: Annotation[]): string[] {
  return [...new Set(items.flatMap(annotation => annotation.tags))].sort(compareCodeUnits);
}

function NotebookFilters({ notebook, params }: { notebook: Notebook; params: NotebookParams }) {
  return (
    <form className="mt-6 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
      <select
        name="doc"
        defaultValue={params.doc ?? ''}
        className={`${FILTER_CLASS} sm:col-span-2`}
      >
        <option value="">All documents</option>
        <option value={FREE_NOTES_FILTER}>Free-floating notes</option>
        {notebook.docs.map(doc => (
          <option key={doc.id} value={doc.id}>
            {doc.title}
          </option>
        ))}
      </select>
      <select name="type" defaultValue={params.type ?? ''} className={FILTER_CLASS}>
        <option value="">All types</option>
        <option value="highlight">Highlights</option>
        <option value="note">Notes</option>
        <option value="bookmark">Bookmarks</option>
        <option value="ai_question">AI questions</option>
      </select>
      <select name="color" defaultValue={params.color ?? ''} className={FILTER_CLASS}>
        <option value="">Any color</option>
        {HighlightColors.map(color => (
          <option key={color} value={color}>
            {color}
          </option>
        ))}
      </select>
      <input
        name="tag"
        defaultValue={params.tag ?? ''}
        placeholder="tag"
        list="tags"
        className={FILTER_CLASS}
      />
      <datalist id="tags">
        {notebook.tags.map(tag => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <input
        name="q"
        defaultValue={params.q ?? ''}
        placeholder="Search highlights and notes"
        className={`col-span-2 ${FILTER_CLASS} sm:col-span-4`}
      />
      <button className="rounded bg-accent px-3 py-1.5 text-white">Filter</button>
    </form>
  );
}

function notebookItemHref(annotation: Annotation): string | undefined {
  const anchorHref = annotationAnchorHref(annotation);

  if (anchorHref) return anchorHref;
  if (annotation.documentId) return `/read/${annotation.documentId}`;

  return undefined;
}

function swatchOf(annotation: Annotation): string {
  if (annotation.type === 'ai_question') return 'question';

  return annotation.color ?? 'yellow';
}

function typeLabelOf(annotation: Annotation): string {
  return annotation.type === 'ai_question' ? 'AI asked' : annotation.type;
}

function chapterTitleOf(doc: LibraryDocument | undefined, chapterId: string): string | undefined {
  return doc?.chapters.find(chapter => chapter.id === chapterId)?.title;
}

function NotebookItem({ annotation, docs }: { annotation: Annotation; docs: LibraryDocument[] }) {
  const doc = docs.find(candidate => candidate.id === annotation.documentId);
  const href = notebookItemHref(annotation);

  return (
    <li className="rounded-lg border border-line p-4">
      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span className="font-semibold uppercase tracking-wider">{typeLabelOf(annotation)}</span>
        {doc && <span>· {doc.title}</span>}
        {annotation.chapterId && <span>· {chapterTitleOf(doc, annotation.chapterId)}</span>}
        <span>· {relativeTime(annotation.createdAt)}</span>
        {annotation.orphaned && <span className="text-red-600">· orphaned</span>}
      </div>
      <NotebookQuote annotation={annotation} href={href} />
      {annotation.body && <MarkdownView source={annotation.body} className="mt-2" />}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {annotation.tags.map(tag => (
          <Link key={tag} href={tagHref(tag)} className="rounded-full bg-panel px-2 text-muted">
            #{tag}
          </Link>
        ))}
        <NotebookItemActions id={annotation.id} href={href} />
      </div>
    </li>
  );
}

function NotebookQuote({ annotation, href }: { annotation: Annotation; href?: string }) {
  const quote = quoteOf(annotation);

  if (quote === undefined) return null;

  return (
    <blockquote className="mt-2 flex gap-2 font-serif">
      <span className={`swatch-${swatchOf(annotation)} w-1 shrink-0 rounded-full`} />
      {href ? (
        <Link href={href} className="hover:text-accent">
          {quote}
        </Link>
      ) : (
        quote
      )}
    </blockquote>
  );
}
