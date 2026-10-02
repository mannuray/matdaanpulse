import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { ECI_RESULTS_URL } from '../../model/about/about';

/** Detail-page frame: the page scrolls itself (the app shell never scrolls), the header sticks to its top, a footer closes it. */
export function PageShell({ back, children }: { back: { href: string; label: string }; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="studio-root studio-scroll flex h-full flex-col overflow-y-auto bg-page text-ink">
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-page/95 px-4 backdrop-blur">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold"><img src="/logo-mark.png" alt="" className="h-6 w-6" />MatdaanPulse</Link>
        <Link to={back.href} className="ml-auto text-sm text-muted hover:text-ink">← {back.label}</Link>
      </header>
      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-3 px-4 py-4 lg:px-6">{children}</main>
      <footer className="mt-8 shrink-0 border-t border-line">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted sm:flex-row lg:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-display text-sm font-bold text-ink">MatdaanPulse</span>
            <span className="text-line" aria-hidden>|</span>
            <span>{t('footer_independent')}</span>
            <span className="text-line" aria-hidden>|</span>
            <span>{t('footer_not_official')} · <a href={ECI_RESULTS_URL} target="_blank" rel="noopener noreferrer" className="text-accent-text hover:underline">{t('about_disclaimer_link')} ↗</a></span>
          </div>
          <Link to="/about" className="hover:text-ink hover:underline">{t('footer_about')}</Link>
        </div>
      </footer>
    </div>
  );
}
