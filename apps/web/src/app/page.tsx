import Link from "next/link";
import { listLibrary } from "@/lib/data";
import { Cover, ProgressBar, relativeTime } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const cards = await listLibrary();
  const reading = cards.filter((c) => c.lastRead && c.percent < 0.99).slice(0, 3);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {cards.length === 0 ? (
        <div className="mx-auto mt-20 max-w-md text-center">
          <h1 className="font-serif text-3xl">Your library is empty</h1>
          <p className="mt-3 text-muted">Import an EPUB, a MOBI file or a web article to start reading.</p>
          <Link href="/import" className="mt-6 inline-block rounded-md bg-accent px-4 py-2 text-white">Import something</Link>
        </div>
      ) : (
        <>
          {reading.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Continue reading</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {reading.map(({ doc, percent, lastChapterId, lastRead }) => {
                  const ch = doc.chapters.find((c) => c.id === lastChapterId);
                  return (
                    <Link key={doc.id} href={`/read/${doc.id}/${lastChapterId}`} className="rounded-lg border border-line bg-panel p-4 hover:border-accent">
                      <div className="truncate font-serif text-lg">{doc.title}</div>
                      <div className="truncate text-sm text-muted">{ch?.title}</div>
                      <ProgressBar value={percent} className="mt-3" />
                      <div className="mt-1 text-xs text-muted">{Math.round(percent * 100)}% · {relativeTime(lastRead)}</div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
          <div className="mb-4 flex items-baseline justify-between">
            <h1 className="font-serif text-3xl">Library</h1>
            <span className="text-sm text-muted">{cards.length} documents</span>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {cards.map(({ doc, percent, lastRead, annotationCount }) => (
              <Link key={doc.id} href={`/read/${doc.id}`} className="group">
                <Cover docId={doc.id} cover={doc.cover} title={doc.title} className="transition group-hover:shadow-lg" />
                <div className="mt-2 line-clamp-2 font-serif leading-snug">{doc.title}</div>
                <div className="truncate text-sm text-muted">{doc.authors.join(", ") || doc.kind}</div>
                <ProgressBar value={percent} className="mt-2" />
                <div className="mt-1 text-xs text-muted">
                  {percent > 0 ? `${Math.round(percent * 100)}%` : "Not started"}
                  {annotationCount > 0 && ` · ${annotationCount} notes`}
                  {lastRead && ` · ${relativeTime(lastRead)}`}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
