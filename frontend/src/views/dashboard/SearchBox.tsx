import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { SearchVM } from '../../viewmodels/tiles/useSearchVM';

export function SearchBox({ vm }: { vm: SearchVM }) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) vm.onOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [vm]);
  return (
    <div ref={box} className="relative min-w-0 max-w-sm flex-1">
      <input type="search" value={vm.query} onChange={e => vm.onQuery(e.target.value)} onFocus={() => vm.onOpen(true)} onKeyDown={e => { if (e.key === 'Escape') vm.onOpen(false); }}
        placeholder={t('search_placeholder')} aria-label={t('search')}
        className="h-8 w-full rounded-full border border-line bg-page/60 px-4 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none" />
      {vm.open && (
        <div className="studio-root absolute left-0 right-0 top-10 z-40 max-h-96 overflow-auto rounded-xl border border-line bg-tile p-1 shadow-2xl">
          {vm.seats.length > 0 && <div className="px-3 py-1 text-[11px] uppercase text-muted">{t('constituency')}</div>}
          {vm.seats.map(s => <button key={s.id} type="button" onClick={() => vm.onPick(s.id)} className="block w-full rounded-[0.5rem] px-3 py-1.5 text-left text-sm hover:bg-tile-raised"><span className="text-ink">{s.name}</span> <span className="text-xs text-muted">{s.meta}</span></button>)}
          {vm.candidates.length > 0 && <div className="px-3 py-1 text-[11px] uppercase text-muted">{t('candidates')}</div>}
          {vm.candidates.map(c => <button key={c.id} type="button" onClick={() => vm.onPick(c.seatId)} className="block w-full rounded-[0.5rem] px-3 py-1.5 text-left text-sm hover:bg-tile-raised"><span className="text-ink">{c.name}</span> <span className="text-xs text-muted">{c.meta}</span></button>)}
        </div>
      )}
    </div>
  );
}
