import 'katex/dist/katex.min.css';
import './globals.css';

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';

import { ThemeToggle } from '@/components/ThemeToggle';

export const metadata: Metadata = {
  description: 'Read, highlight and study your books and articles.',
  title: { default: 'Study Library', template: '%s · Study Library' },
};

const themeScript = `try{var t=localStorage.getItem("theme");if(!t||t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body className="min-h-screen font-sans antialiased">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
          <nav className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 text-sm sm:gap-5">
            <Link
              href="/"
              className="whitespace-nowrap font-serif text-lg font-semibold tracking-tight"
            >
              <span className="sm:hidden">Library</span>
              <span className="hidden sm:inline">Study Library</span>
            </Link>
            <Link href="/notebook" className="text-muted hover:text-ink">
              Notebook
            </Link>
            <Link href="/import" className="text-muted hover:text-ink">
              Import
            </Link>
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
            <ThemeToggle />
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
