import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { SiteFooter } from '../ui/SiteFooter';
import { Wordmark } from '../ui/Wordmark';

/** Detail-page frame: the page scrolls itself (the app shell never scrolls), the header sticks to its top, a footer closes it. */
export function PageShell({ back, children }: { back: { href: string; label: string }; children: ReactNode }) {
  return (
    <div className="studio-root studio-scroll flex h-full flex-col overflow-y-auto bg-page text-ink">
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-page/95 px-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold"><img src="/logo-mark.png" alt="" className="h-6 w-6" /><Wordmark /></Link>
        <Link to={back.href} className="ml-auto text-sm text-muted hover:text-ink">← {back.label}</Link>
      </header>
      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-3 px-4 py-4 lg:px-6">{children}</main>
      <SiteFooter />
    </div>
  );
}
