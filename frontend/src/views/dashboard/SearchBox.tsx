import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/cn';
import type { SearchVM } from '../../viewmodels/tiles/useSearchVM';

/** `inline` (mobile search sheet): taller input, results flow under it instead of floating. */
export function SearchBox({ vm, className, inline = false }: { vm: SearchVM; className?: string; inline?: boolean }) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) vm.onOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [vm]);
  const row = cn('block w-full rounded-[0.5rem] px-3 text-left text-sm hover:bg-tile-raised', inline ? 'min-h-11 py-2.5' : 'py-1.5');
  return (
    <div ref={box} className={cn('relative min-w-0 flex-1', !inline && 'max-w-sm', className)}>
      <input type="search" value={vm.query} onChange={e => vm.onQuery(e.target.value)} onFocus={() => vm.onOpen(true)} onKeyDown={e => { if (e.key === 'Escape') vm.onOpen(false); }}
        placeholder={t('search_placeholder')} aria-label={t('search')}
        className={cn('w-full rounded-full border border-line bg-page/60 px-4 text-ink placeholder:text-muted focus:border-accent focus:outline-none', inline ? 'h-11 text-base' : 'h-8 text-sm')} />
      {vm.open && (
        <div className={cn('studio-root overflow-auto rounded-xl border border-line bg-tile p-1', inline ? 'mt-2 max-h-[50dvh]' : 'absolute left-0 right-0 top-10 z-40 max-h-96 shadow-2xl')}>
          {vm.seats.length > 0 && <div className="px-3 py-1 text-[11px] uppercase text-muted">{t('constituency')}</div>}
          {vm.seats.map(s => <button key={s.id} type="button" onClick={() => vm.onPick(s.id)} className={row}><span className="text-ink">{s.name}</span> <span className="text-xs text-muted">{s.meta}</span></button>)}
          {vm.candidates.length > 0 && <div className="px-3 py-1 text-[11px] uppercase text-muted">{t('candidates')}</div>}
          {vm.candidates.map(c => <button key={c.id} type="button" onClick={() => vm.onPick(c.seatId)} className={row}><span className="text-ink">{c.name}</span> <span className="text-xs text-muted">{c.meta}</span></button>)}
        </div>
      )}
    </div>
  );
}
