import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * A scroll container for a tile body: fills the space its flex parent gives it, scrolls vertically inside (never the page),
 * and fades its bottom edge into the tile colour while more content is below. `resetKey` changes scroll it back to the top.
 */
export function ScrollArea({ label, resetKey, className, children }: { label: string; resetKey?: string | number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setMore(prev => (prev === next ? prev : next));
  }, []);
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
    measure();
  }, [resetKey, measure]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    if (inner.current) ro?.observe(inner.current);
    return () => { el.removeEventListener('scroll', measure); ro?.disconnect(); };
  }, [measure]);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={ref} role="region" aria-label={label} tabIndex={0}
        className={cn('studio-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[0.5rem] focus-visible:outline-2 focus-visible:outline-accent', className)}>
        <div ref={inner}>{children}</div>
      </div>
      {more && <div data-scroll-fade aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10" style={{ background: 'linear-gradient(to bottom, transparent, var(--color-tile))' }} />}
    </div>
  );
}
