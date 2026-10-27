import { eq, sql } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DocumentActions } from '@/components/DocumentActions';
import { Cover, ProgressBar } from '@/components/ui';
import { documentPercent, documentProgress, getDocument } from '@/lib/data';
import { getDb, t } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ doc: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc } = await params;

  return { title: (await getDocument(doc).catch(() => null))?.title ?? 'Not found' };
}

export default async function DocumentPage({ params }: Props) {
  const { doc: id } = await params;
  const doc = await getDocument(id);
  const progress = await documentProgress(id);

  const counts = await getDb()
    .select({ chapterId: t.annotations.chapterId, n: sql<number>`count(*)::int` })
    .from(t.annotations)
    .where(eq(t.annotations.documentId, id))
    .groupBy(t.annotations.chapterId);

  const last = [...progress].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const firstBody = doc.chapters.find(c => c.matter === 'body') ?? doc.chapters[0];
  const continueId = last?.chapterId ?? firstBody.id;
  const percent = documentPercent(doc, progress);

  const groups: { label: string; matter: string; open: boolean }[] = [
    {
      label: 'Front matter',
      matter: 'front',
      open: false,
    },
    {
      label: 'Contents',
      matter: 'body',
      open: true,
    },
    {
      label: 'Back matter',
      matter: 'back',
      open: false,
    },
  ];

  const totalWords = doc.chapters
    .filter(c => c.matter === 'body')
    .reduce((n, c) => n + c.wordCount, 0);

  return (
    <main className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-[220px_1fr]">
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
          {Math.round(percent * 100)}% read · {totalWords.toLocaleString()} words · ~
          {Math.max(1, Math.round(totalWords / 250 / 60))} h
        </p>
        <DocumentActions docId={doc.id} />
      </aside>
      <section>
        <p className="text-xs uppercase tracking-wider text-muted">{doc.kind}</p>
        <h1 className="mt-1 font-serif text-4xl leading-tight">{doc.title}</h1>
        {doc.authors.length > 0 && (
          <p className="mt-2 text-lg text-muted">{doc.authors.join(', ')}</p>
        )}
        {'url' in doc.source && doc.source.url && (
          <a
            href={doc.source.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block truncate text-sm text-accent"
          >
            {doc.source.url}
          </a>
        )}
        {doc.description && <p className="mt-4 font-serif text-muted">{doc.description}</p>}
        {groups.map(g => {
          const items = doc.chapters.filter(c => c.matter === g.matter);

          if (!items.length) return null;

          return (
            <details
              key={g.matter}
              open={g.open || doc.chapters.every(c => c.matter !== 'body')}
              className="mt-8"
            >
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted">
                {g.label} ({items.length})
              </summary>
              <ol className="mt-3 divide-y divide-line border-y border-line">
                {items.map(c => {
                  const p = progress.find(x => x.chapterId === c.id)?.percent ?? 0;
                  const n = counts.find(x => x.chapterId === c.id)?.n ?? 0;

                  return (
                    <li key={c.id}>
                      <Link
                        href={`/read/${doc.id}/${c.id}`}
                        className="flex items-center gap-3 py-2.5 hover:bg-panel"
                        style={{ paddingLeft: `${(c.depth - 1) * 1}rem` }}
                      >
                        <span className="flex-1 font-serif">{c.title}</span>
                        {n > 0 && (
                          <span className="rounded-full bg-panel px-2 text-xs text-muted">
                            {n} notes
                          </span>
                        )}
                        <span className="w-16 text-right text-xs text-muted">
                          {Math.max(1, Math.round(c.wordCount / 250))} min
                        </span>
                        <span className="w-10">{p > 0 && <ProgressBar value={p} />}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </details>
          );
        })}
      </section>
    </main>
  );
}
