import Link from 'next/link';

import { ThemeToggle } from '@/components/theme-toggle';

const NAV_LINK_CLASS = 'text-muted hover:text-ink';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 text-sm sm:gap-5">
        <SiteTitle />
        <Link href="/notebook" className={NAV_LINK_CLASS}>
          Notebook
        </Link>
        <Link href="/import" className={NAV_LINK_CLASS}>
          Import
        </Link>
        <HeaderSearch />
        <ThemeToggle />
      </nav>
    </header>
  );
}

function SiteTitle() {
  return (
    <Link href="/" className="whitespace-nowrap font-serif text-lg font-semibold tracking-tight">
      <span className="sm:hidden">Library</span>
      <span className="hidden sm:inline">Study Library</span>
    </Link>
  );
}

function HeaderSearch() {
  return (
    <>
      <form action="/search" className="ml-auto hidden sm:block">
        <input
          name="q"
          placeholder="Search books and notes…"
          className="w-64 rounded-md border border-line bg-panel px-3 py-1.5 outline-none focus:border-accent"
        />
      </form>
      <Link
        href="/search"
        className="ml-auto text-muted hover:text-ink sm:hidden"
        aria-label="Search"
      >
        Search
      </Link>
    </>
  );
}
