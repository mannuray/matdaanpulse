import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { cn } from './cn';

const FADE = 20;

/** Fade the edge(s) that have more tabs beyond them, so a clipped row reads as scrollable. */
function useScrollFade() {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const l = el.scrollLeft > 1;
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdge(prev => (prev.l === l && prev.r === r ? prev : { l, r }));
  }, []);
  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); ro?.disconnect(); };
  }, [measure]);
  const mask = edge.l || edge.r
    ? `linear-gradient(to right, ${edge.l ? 'transparent' : '#000'} 0, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${edge.r ? 'transparent' : '#000'} 100%)`
    : undefined;
  return { ref, style: (mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined) as CSSProperties | undefined };
}

export function PillToggle<T extends string>({ value, options, onChange, ariaLabel, size = 'md' }: {
  value: T; options: { value: T; label: string }[]; onChange(v: T): void; ariaLabel: string; size?: 'sm' | 'md' | 'lg';
}) {
  const fade = useScrollFade();
  return (
    <ToggleGroup.Root ref={fade.ref} style={fade.style} type="single" value={value} onValueChange={v => { if (v) onChange(v as T); }} aria-label={ariaLabel}
      className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full border border-line bg-page/60 p-0.5 [scrollbar-width:none]">
      {options.map(o => (
        <ToggleGroup.Item key={o.value} value={o.value}
          className={cn('shrink-0 rounded-full font-medium text-muted transition-colors hover:text-ink data-[state=on]:bg-accent data-[state=on]:text-on-accent',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : size === 'lg' ? 'min-h-11 px-4 text-sm' : 'px-3 py-1.5 text-sm')}>
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
