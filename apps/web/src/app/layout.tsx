import 'katex/dist/katex.min.css';
import './globals.css';

import type { Metadata } from 'next';
import Script from 'next/script';

import { DialogProvider } from '@/components/dialogs/dialog-provider';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  description: 'Read, highlight and study your books and articles.',
  title: { default: 'Study Library', template: '%s · Study Library' },
};

const APPLY_SAVED_THEME_BEFORE_PAINT = `try{var t=localStorage.getItem("theme");if(!t||t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme" strategy="beforeInteractive">
          {APPLY_SAVED_THEME_BEFORE_PAINT}
        </Script>
      </head>
      <body className="min-h-screen font-sans antialiased">
        <SiteHeader />
        <DialogProvider>{children}</DialogProvider>
      </body>
    </html>
  );
}
