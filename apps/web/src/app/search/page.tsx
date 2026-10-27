import Link from "next/link";
import { search, toAnnotation } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

type Props = { searchParams: Promise<{ q?: string }> };

/** ts_headline output only contains <mark> tags we asked for; escape everything else. */
function snippetHtml(snippet: string): string {
  return snippet
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/&lt;mark>/g, "<mark>")
    .replace(/&lt;\/mark>/g, "</mark>");
}

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const results = q.trim() ? await search(q.trim()) : null;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <form>
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder='Search chapters and notes — try "white rabbit" or monster -frankenstein'
          className="w-full rounded-lg border border-line bg-panel px-4 py-3 text-lg outline-none focus:border-accent"
        />
      </form>
      {results && (
        <>
          {results.documents.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Documents</h2>
              <ul className="mt-2 space-y-1">
                {results.documents.map((d) => <li key={d.id}><Link href={`/read/${d.id}`} className="font-serif text-lg hover:text-accent">{d.title}</Link></li>)}
              </ul>
            </section>
          )}
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Your highlights and notes ({results.notes.length})</h2>
            <ul className="mt-2 space-y-3">
              {results.notes.map(toAnnotation).map((a) => (
                <li key={a.id} className="rounded-lg border border-line p-3 text-sm">
                  <Link href={a.documentId && a.chapterId ? `/read/${a.documentId}/${a.chapterId}#${a.id}` : "/notebook"} className="hover:text-accent">
                    {a.selectors.find((s) => s.type === "TextQuoteSelector")?.type === "TextQuoteSelector" && (
                      <span className="font-serif">“{(a.selectors.find((s) => s.type === "TextQuoteSelector") as { exact: string }).exact}”</span>
                    )}
                    {a.body && <span className="mt-1 block text-muted">{a.body}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Chapters ({results.chapters.length})</h2>
            <ul className="mt-2 space-y-4">
              {results.chapters.map((c) => (
                <li key={`${c.documentId}/${c.chapterId}`}>
                  <Link href={`/read/${c.documentId}/${c.chapterId}`} className="font-serif text-lg hover:text-accent">{c.title}</Link>
                  <div className="text-xs text-muted">{c.documentTitle}</div>
                  <p className="mt-1 font-serif text-sm text-muted [&_mark]:bg-yellow-300/40 [&_mark]:text-inherit" dangerouslySetInnerHTML={{ __html: snippetHtml(c.snippet) }} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
