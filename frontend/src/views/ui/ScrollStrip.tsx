import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { cn } from './cn';

/**
 * A horizontal, snap-scrolling row of cards (Netflix-style). The edges fade while more is hidden; on hover, full-height
 * ‹ › arrows over the edges page through it, and ←/→ do the same while the row has focus. Touch screens just swipe.
 * Children should be `shrink-0 snap-start` with a fixed width.
 */
export function ScrollStrip({ header, label, children, className }: { header?: ReactNode; label: string; children: ReactNode; className?: string }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ prev: false, next: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ prev: el.scrollLeft > 2, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, []);
  useEffect(() => {
    update();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, children]);
  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  const arrow = (side: 'left' | 'right') => cn(
    'absolute inset-y-0 z-10 hidden w-10 items-center text-ink opacity-0 transition-opacity duration-200 focus-visible:opacity-100 group-hover/strip:opacity-100 [@media(hover:hover)]:flex',
    side === 'left' ? 'left-0 justify-start bg-gradient-to-r from-tile via-tile/80 to-transparent' : 'right-0 justify-end bg-gradient-to-l from-tile via-tile/80 to-transparent',
  );
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); page(e.key === 'ArrowRight' ? 1 : -1); }
  };
  const fade = edge.next && edge.prev ? 'linear-gradient(to right, transparent, black 24px, black calc(100% - 40px), transparent)'
    : edge.next ? 'linear-gradient(to right, black calc(100% - 40px), transparent)'
    : edge.prev ? 'linear-gradient(to right, transparent, black 24px)' : undefined;
  return (
    <div className={className}>
      {header && <div className="mb-2.5">{header}</div>}
      <div className="group/strip relative">
        <div ref={ref} onScroll={update} onKeyDown={onKey} tabIndex={0} role="region" aria-label={label}
          className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto rounded-xl pb-1 outline-none [scrollbar-width:none] focus-visible:ring-1 focus-visible:ring-accent [&::-webkit-scrollbar]:hidden"
          style={fade ? { maskImage: fade, WebkitMaskImage: fade } : undefined}>
          {children}
        </div>
        {edge.prev && <button type="button" tabIndex={-1} className={arrow('left')} onClick={() => page(-1)} aria-label={t('scroll_prev')}><Icon name="chevron" className="h-7 w-7 rotate-180 drop-shadow" /></button>}
        {edge.next && <button type="button" tabIndex={-1} className={arrow('right')} onClick={() => page(1)} aria-label={t('scroll_next')}><Icon name="chevron" className="h-7 w-7 drop-shadow" /></button>}
      </div>
    </div>
  );
}
