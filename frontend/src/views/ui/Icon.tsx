import { cn } from './cn';

/** Small inline icons for the detail pages (stroke icons, 24px grid, sized by the class). */
const PATHS = {
  ballot: 'M4 21h16M6 17V7a1 1 0 011-1h10a1 1 0 011 1v10M9 10l2 2 4-4',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z',
  percent: 'M19 5L5 19M7.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM16.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  swap: 'M7 7h13l-3-3M17 17H4l3 3',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  chevron: 'M9 5l7 7-7 7',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01',
  warning: 'M12 3l9.5 17h-19L12 3zM12 10v4M12 17h.01',
  external: 'M7 17L17 7M9 7h8v8',
  gavel: 'M14 4l6 6M11 7l6 6M12.5 5.5l-5 5M15.5 8.5l-5 5M9 12l-6 6M4 21h9',
  wallet: 'M3 7a2 2 0 012-2h13v4M3 7v10a2 2 0 002 2h15V9H5a2 2 0 01-2-2zM16 14h.01',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cn('h-4 w-4 shrink-0', className)}>
      <path d={PATHS[name]} />
    </svg>
  );
}
