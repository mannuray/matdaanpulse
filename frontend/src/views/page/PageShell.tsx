import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

/** Detail-page frame: the page scrolls itself (the app shell never scrolls) and the header sticks to its top. */
export function PageShell({ back, children }: { back: { href: string; label: string }; children: ReactNode }) {
  return (
    <div className="studio-root studio-scroll h-full overflow-y-auto bg-page text-ink">
      <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-line bg-page/95 px-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold"><img src="/logo-mark.png" alt="" className="h-6 w-6" />MatdaanPulse</Link>
        <Link to={back.href} className="ml-auto text-sm text-muted hover:text-ink">← {back.label}</Link>
      </header>
      <main className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-4 lg:px-6">{children}</main>
    </div>
  );
}
