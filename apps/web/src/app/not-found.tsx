import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto mt-24 max-w-md px-4 text-center">
      <h1 className="font-serif text-3xl">Not found</h1>
      <p className="mt-2 text-muted">That document or chapter is not in your library.</p>
      <Link href="/" className="mt-6 inline-block text-accent">
        Back to the library
      </Link>
    </main>
  );
}
