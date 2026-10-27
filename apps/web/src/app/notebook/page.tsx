import Link from 'next/link';

import { FreeNoteForm, NotebookItemActions } from '@/components/NotebookClient';
import { relativeTime } from '@/components/ui';
import { listAnnotations, toAnnotation } from '@/lib/data';
import { listDocumentIds, readDocument } from '@study/core';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notebook' };

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function NotebookPage({ searchParams }: Props) {
  const sp = await searchParams;
  const docs = await Promise.all((await listDocumentIds()).map(id => readDocument(id)));

  const rows = await listAnnotations({
    color: sp.color || undefined,
    documentId: sp.doc || undefined,
    free: sp.doc === '_free',
    limit: 500,
    q: sp.q || undefined,
    tag: sp.tag || undefined,
    type: sp.type || undefined,
  });

  const items = rows.map(toAnnotation).filter(a => sp.doc !== '_free' || !a.documentId);
  const tags = [...new Set(items.flatMap(a => a.tags))].sort();

  const chapterTitle = (docId: string | null, chId: string | null) =>
    docs.find(d => d.id === docId)?.chapters.find(c => c.id === chId)?.title;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-3xl">Notebook</h1>
        <span className="text-sm text-muted">{items.length} items</span>
      </div>
      <form className="mt-6 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        <select
          name="doc"
          defaultValue={sp.doc ?? ''}
          className="rounded border border-line bg-panel px-2 py-1.5 sm:col-span-2"
        >
          <option value="">All documents</option>
          <option value="_free">Free-floating notes</option>
          {docs.map(d => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={sp.type ?? ''}
          className="rounded border border-line bg-panel px-2 py-1.5"
        >
          <option value="">All types</option>
          <option value="highlight">Highlights</option>
          <option value="note">Notes</option>
          <option value="bookmark">Bookmarks</option>
          <option value="ai_question">Claude questions</option>
        </select>
        <select
          name="color"
          defaultValue={sp.color ?? ''}
          className="rounded border border-line bg-panel px-2 py-1.5"
        >
          <option value="">Any color</option>
          {['yellow', 'green', 'blue', 'pink'].map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          name="tag"
          defaultValue={sp.tag ?? ''}
          placeholder="tag"
          list="tags"
          className="rounded border border-line bg-panel px-2 py-1.5"
        />
        <datalist id="tags">
          {tags.map(t => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Search highlights and notes"
          className="col-span-2 rounded border border-line bg-panel px-2 py-1.5 sm:col-span-4"
        />
        <button className="rounded bg-accent px-3 py-1.5 text-white">Filter</button>
      </form>

      <FreeNoteForm />

      <ul className="mt-8 space-y-4">
        {items.map(a => {
          const doc = docs.find(d => d.id === a.documentId);

          const href =
            a.documentId && a.chapterId
              ? `/read/${a.documentId}/${a.chapterId}#${a.id}`
              : a.documentId
                ? `/read/${a.documentId}`
                : undefined;

          const quote = a.selectors.find(s => s.type === 'TextQuoteSelector');
          const swatch = a.type === 'ai_question' ? 'question' : (a.color ?? 'yellow');

          return (
            <li key={a.id} className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <span className="font-semibold uppercase tracking-wider">
                  {a.type === 'ai_question' ? 'Claude asked' : a.type}
                </span>
                {doc && <span>· {doc.title}</span>}
                {a.chapterId && <span>· {chapterTitle(a.documentId, a.chapterId)}</span>}
                <span>· {relativeTime(a.createdAt)}</span>
                {a.orphaned && <span className="text-red-600">· orphaned</span>}
              </div>
              {quote?.type === 'TextQuoteSelector' && (
                <blockquote className="mt-2 flex gap-2 font-serif">
                  <span className={`swatch-${swatch} w-1 shrink-0 rounded-full`} />
                  {href ? (
                    <Link href={href} className="hover:text-accent">
                      {quote.exact}
                    </Link>
                  ) : (
                    quote.exact
                  )}
                </blockquote>
              )}
              {a.body && <p className="mt-2 whitespace-pre-wrap text-sm">{a.body}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {a.tags.map(t => (
                  <Link
                    key={t}
                    href={`/notebook?tag=${encodeURIComponent(t)}`}
                    className="rounded-full bg-panel px-2 text-muted"
                  >
                    #{t}
                  </Link>
                ))}
                <NotebookItemActions id={a.id} href={href} />
              </div>
            </li>
          );
        })}
        {items.length === 0 && (
          <li className="text-center text-muted">
            Nothing here yet. Select text while reading to highlight it.
          </li>
        )}
      </ul>
    </main>
  );
}
