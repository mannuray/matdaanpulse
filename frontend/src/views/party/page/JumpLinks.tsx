import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StateSection } from '../../../viewmodels/pages/usePartyPageVM';
import { cn } from '../../ui/cn';

/** Sticky in-page links to the state view's sections; the one in view is highlighted. Nothing is hidden behind them. */
export function JumpLinks({ sections }: { sections: StateSection[] }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<StateSection | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      const hit = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (hit) setActive(hit.target.id.replace('pty-', '') as StateSection);
    }, { rootMargin: '-96px 0px -60% 0px' });
    sections.forEach(s => { const el = document.getElementById(`pty-${s}`); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [sections]);
  return (
    <nav aria-label={t('pty_jump')} className="sticky top-12 z-10 -mx-4 flex gap-4 overflow-x-auto border-b border-line bg-page/95 px-4 py-2 backdrop-blur lg:mx-0 lg:rounded-xl lg:border">
      {sections.map(s => (
        <a key={s} href={`#pty-${s}`} className={cn('shrink-0 border-b-2 pb-0.5 text-sm', active === s ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink')}>{t(`pty_jump_${s}`)}</a>
      ))}
    </nav>
  );
}
