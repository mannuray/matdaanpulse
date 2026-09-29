import { useState, type ReactNode } from 'react';
import type { FocusTile } from '../../viewmodels/store/dashboardStore';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/cn';

export function MobileCardRail({ cards }: { cards: { id: FocusTile; title: string; node: ReactNode; onOpen(): void }[] }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 [scrollbar-width:none]"
        onScroll={e => { const el = e.currentTarget; setActive(Math.round(el.scrollLeft / (el.clientWidth * 0.86))); }}>
        {cards.map(c => (
          <div key={c.id} role="group" aria-label={c.title} data-rail-card
            className="relative h-[150px] w-[86%] shrink-0 snap-start overflow-hidden rounded-tile border border-line bg-tile p-3">
            <div aria-hidden="true" {...{ inert: '' }}>
              <div className="mb-1 font-display text-sm font-bold uppercase tracking-wider text-ink">{c.title}</div>
              <div className="pointer-events-none">{c.node}</div>
            </div>
            <button type="button" onClick={c.onOpen} aria-label={t('studio_open', { name: c.title })}
              className="absolute inset-0 rounded-tile focus-visible:ring-2 focus-visible:ring-accent" />
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 pb-2">
        {cards.map((c, i) => <span key={c.id} data-rail-dot className={cn('h-1.5 w-1.5 rounded-full', i === active ? 'bg-accent' : 'bg-line')} />)}
      </div>
    </div>
  );
}
