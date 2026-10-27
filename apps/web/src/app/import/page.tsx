import { ImportClient } from "@/components/ImportClient";

export const metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl">Import</h1>
      <p className="mt-2 text-muted">
        DRM-free EPUB, MOBI, AZW or AZW3 books, saved HTML pages, or a web article URL. Each becomes one Markdown file per chapter in your library folder.
      </p>
      <ImportClient />
    </main>
  );
}
