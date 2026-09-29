import { useState, type ReactNode } from 'react';
import type { FocusTile } from '../../viewmodels/store/dashboardStore';
import { cn } from '../ui/cn';

export function MobileCardRail({ cards }: { cards: { id: FocusTile; title: string; node: ReactNode; onOpen(): void }[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 [scrollbar-width:none]"
        onScroll={e => { const el = e.currentTarget; setActive(Math.round(el.scrollLeft / (el.clientWidth * 0.86))); }}>
        {cards.map(c => (
          <button key={c.id} type="button" data-rail-card onClick={c.onOpen}
            className="h-[150px] w-[86%] shrink-0 snap-start overflow-hidden rounded-tile border border-line bg-tile p-3 text-left">
            <div className="mb-1 font-display text-sm font-bold uppercase tracking-wider text-ink">{c.title}</div>
            <div className="pointer-events-none">{c.node}</div>
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 pb-2">
        {cards.map((c, i) => <span key={c.id} data-rail-dot className={cn('h-1.5 w-1.5 rounded-full', i === active ? 'bg-accent' : 'bg-line')} />)}
      </div>
    </div>
  );
}
