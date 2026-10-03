import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ECI_RESULTS_URL } from '../../model/about/about';
import { cn } from './cn';
import { Wordmark } from './Wordmark';

/** The detail pages' footer; `compact` is the one-line version pinned to the bottom of a dialog. */
export function SiteFooter({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const sep = <span className="text-line" aria-hidden>|</span>;
  return (
    <footer className={cn('shrink-0 border-t border-line', compact ? 'bg-page/40' : 'mt-8')}>
      <div className={cn('flex items-center justify-between gap-3 text-muted',
        compact ? 'px-5 py-2.5 text-[11px]' : 'mx-auto max-w-[1280px] flex-col px-4 py-5 text-xs sm:flex-row lg:px-6')}>
        <div className={cn('flex items-center gap-x-3 gap-y-1', compact ? 'min-w-0 truncate' : 'flex-wrap')}>
          <Wordmark className={compact ? 'text-xs' : 'text-sm'} />
          {sep}
          {!compact && <><span>{t('footer_independent')}</span>{sep}</>}
          <span className="truncate">{t('footer_not_official')} · <a href={ECI_RESULTS_URL} target="_blank" rel="noopener noreferrer" className="text-accent-text hover:underline">{t('about_disclaimer_link')} ↗</a></span>
        </div>
        <Link to="/about" className="shrink-0 hover:text-ink hover:underline">{t('footer_about')}</Link>
      </div>
    </footer>
  );
}
