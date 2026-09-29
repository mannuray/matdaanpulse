import { useTranslation } from 'react-i18next';
import type { StandingsVM, StandingRow } from '../../viewmodels/tiles/useStandingsVM';
import { Tile } from './Tile';
import { useFitRows } from '../hooks/useFitRows';
import { cn } from '../ui/cn';

const ROW_H = 36;

function Row({ r, max, vm, wide }: { r: StandingRow; max: number; vm: StandingsVM; wide?: boolean }) {
  return (
    <button type="button" onClick={() => vm.onLockParty(r.id)} onMouseEnter={() => vm.onHoverParty(r.id)} onMouseLeave={() => vm.onHoverParty(null)}
      aria-pressed={vm.lockedId === r.id} aria-label={`${r.id} ${r.name} ${r.seats}`}
      className={cn('grid h-9 w-full grid-cols-[minmax(0,1fr)_minmax(60px,40%)_48px] items-center gap-3 rounded-[0.5rem] px-2 text-left hover:bg-tile-raised', vm.lockedId === r.id && 'bg-tile-raised ring-1 ring-accent', wide && 'grid-cols-[minmax(0,1fr)_minmax(80px,40%)_64px_64px]')}>
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
        <span className="font-semibold text-ink">{r.id}</span>
        <span className="truncate text-xs text-muted">{r.name}</span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-page"><span className="block h-full rounded-full" style={{ width: `${(r.seats / max) * 100}%`, background: r.color }} /></span>
      {wide && <span className="tabular text-right text-sm text-muted">{r.votePct != null ? `${r.votePct}%` : '—'}</span>}
      <span className="tabular text-right font-display text-2xl font-bold text-ink">{r.seats}</span>
    </button>
  );
}

export function StandingsTile({ vm, variant }: { vm: StandingsVM; variant: 'tile' | 'focus' }) {
  const { t } = useTranslation();
  const fit = useFitRows(vm.rows, ROW_H);
  if (variant === 'focus') {
    const max = Math.max(1, ...vm.allRows.map(r => r.seats));
    return <div className="flex flex-col gap-1">{vm.allRows.map(r => <Row key={r.id} r={r} max={max} vm={vm} wide />)}</div>;
  }
  const max = Math.max(1, ...vm.rows.map(r => r.seats));
  return (
    <Tile title={t('party_standings')} onExpand={vm.onFocus} pulse={vm.pulse}>
      <div ref={fit.ref} className="flex h-full flex-col gap-1">
        {vm.rows.length === 0 && <p className="py-6 text-center text-sm text-muted">{t('studio_no_results_yet')}</p>}
        {fit.visible.map(r => <Row key={r.id} r={r} max={max} vm={vm} />)}
        {fit.moreCount > 0 && (
          <button type="button" onClick={vm.onFocus} className="mt-auto px-2 text-left text-xs text-muted hover:text-accent">
            {t('studio_more_parties', { count: fit.moreCount, seats: fit.moreSeats })}
          </button>
        )}
      </div>
    </Tile>
  );
}
