import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/cn';

export function Tile({ title, onExpand, actions, stackActions, className, bodyClassName, pulse, children }: {
  title: string; onExpand?(): void; actions?: ReactNode; /** Put the actions on their own row under the title (narrow tiles). */ stackActions?: boolean; className?: string; bodyClassName?: string; pulse?: boolean; children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden rounded-tile border border-line bg-tile', pulse && 'studio-pulse', className)}>
      <header className={cn('flex shrink-0 items-center gap-x-3 px-4', 'min-h-11', stackActions && 'flex-wrap gap-y-1 pb-1 pt-1.5')}>
        <h2 className={cn('truncate font-display text-base font-bold uppercase tracking-wider text-ink', stackActions && 'mr-auto')}>{title}</h2>
        <div className={cn('flex min-w-0 items-center gap-2', stackActions ? 'order-last basis-full' : 'ml-auto')}>{actions}</div>
        {onExpand && (
          <button type="button" onClick={onExpand} aria-label={t('studio_expand', { name: title })}
            className="group -mr-2 grid h-11 w-11 shrink-0 place-items-center text-muted hover:text-accent">
            <span className="grid h-8 w-8 place-items-center rounded-full group-hover:bg-tile-raised">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 3h5v5M8 17H3v-5M17 3l-6 6M3 17l6-6" /></svg>
            </span>
          </button>
        )}
      </header>
      <div className={cn('min-h-0 flex-1 overflow-hidden px-4 pb-3', bodyClassName)}>{children}</div>
    </section>
  );
}
