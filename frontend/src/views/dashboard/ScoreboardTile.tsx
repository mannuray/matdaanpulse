import { useTranslation } from 'react-i18next';
import type { ScoreboardVM } from '../../viewmodels/tiles/useScoreboardVM';
import { Tile } from './Tile';
import { cn } from '../ui/cn';
import { onKbdFocus } from '../ui/kbdFocus';

export function ScoreboardTile({ vm, variant }: { vm: ScoreboardVM; variant: 'tile' | 'focus' | 'compact' }) {
  const { t } = useTranslation();
  const total = Math.max(vm.totalSeats, 1);
  const tileSize = variant === 'tile';
  if (variant === 'compact') {
    return (
      <Tile title={t('studio_results')} onExpand={vm.onFocus} pulse={vm.pulse} bodyClassName="pb-2"
        actions={<span className="whitespace-nowrap text-xs text-muted">{t('others')} <span className="tabular font-display text-base font-bold">{vm.others.seats}</span></span>}>
        <div className="flex flex-col gap-2 pt-0.5">
          <div data-bloc-row className="flex min-w-0 items-center gap-3 overflow-hidden">
            {vm.blocs.map((b, i) => (
              <button key={b.id} type="button" onClick={() => vm.onLockBloc(b.id)} onMouseEnter={() => vm.onHoverBloc(b.id)} onMouseLeave={() => vm.onHoverBloc(null)} onFocus={onKbdFocus(() => vm.onHoverBloc(b.id))} onBlur={() => vm.onHoverBloc(null)}
                aria-label={`${b.name} ${b.seats}`} title={b.name} aria-pressed={vm.lockedId === b.id}
                className={cn('flex min-w-0 items-center gap-2 rounded-xl px-1 text-left', i > 0 && 'border-l border-line pl-3', vm.lockedId === b.id && 'ring-2 ring-accent')}>
                <span className="tabular font-display text-[40px] font-extrabold leading-none" style={{ color: b.color }}>{b.seats}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: b.textColor }}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color }} /><span data-bloc-label className="whitespace-nowrap">{b.label}</span>
                  </span>
                  {b.votePct != null && <span className="truncate text-xs text-muted">{t('studio_votes_pct', { pct: b.votePct })}</span>}
                </span>
              </button>
            ))}
          </div>
          <div className="relative">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-page">
              {vm.blocs.map(b => <div key={b.id} style={{ width: `${(b.seats / total) * 100}%`, background: b.color }} />)}
              <div style={{ width: `${(vm.others.seats / total) * 100}%` }} className="bg-muted/60" />
            </div>
            {vm.majority != null && <div className="absolute -top-1.5 h-5 w-0.5 bg-ink" style={{ left: `${(vm.majority / total) * 100}%` }} aria-hidden />}
            <div className="mt-1 flex items-center justify-between text-xs leading-none text-muted">
              {vm.status === 'upcoming' ? <span>0</span> : (
                <span data-status-pill className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-ink">
                  <span aria-hidden className={vm.status === 'live' ? 'h-2 w-2 animate-pulse rounded-full bg-live' : 'h-2 w-2 rounded-full bg-ok'} />
                  {vm.status === 'live' ? t('studio_status_short_live', { declared: vm.declared, total: vm.totalSeats }) : t('studio_status_short_final')}
                </span>
              )}
              {vm.majority != null && <span className="font-semibold text-ink">{t('studio_to_win', { count: vm.majority })}</span>}
              <span>{vm.totalSeats}</span>
            </div>
          </div>
        </div>
      </Tile>
    );
  }
  const body = (
    <div className={cn('flex h-full flex-col justify-center', tileSize ? 'gap-1.5' : 'gap-3')}>
      <div className="flex min-w-0 items-end gap-4 overflow-hidden">
        {vm.blocs.map((b, i) => (
          <button key={b.id} type="button" onClick={() => vm.onLockBloc(b.id)} onMouseEnter={() => vm.onHoverBloc(b.id)} onMouseLeave={() => vm.onHoverBloc(null)} onFocus={onKbdFocus(() => vm.onHoverBloc(b.id))} onBlur={() => vm.onHoverBloc(null)}
            aria-label={`${b.name} ${b.seats}`} title={b.name} aria-pressed={vm.lockedId === b.id}
            className={cn('flex min-w-0 items-end gap-3 rounded-xl px-1 text-left', i > 0 && 'border-l border-line pl-4', vm.lockedId === b.id && 'ring-2 ring-accent')}>
            <div className={cn('min-w-0', tileSize ? 'pb-1' : 'pb-2')}>
              <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: b.textColor }}>
                <span className="h-2 w-2 rounded-full" style={{ background: b.color }} /><span data-bloc-label className="truncate">{variant === 'focus' ? b.name : b.label}</span>
              </div>
              {b.votePct != null && <div className="text-xs text-muted">{t('studio_votes_pct', { pct: b.votePct })}</div>}
            </div>
            <span className={cn('tabular font-display font-extrabold leading-none', tileSize ? 'text-[60px]' : 'text-[88px]')} style={{ color: b.color }}>{b.seats}</span>
          </button>
        ))}
        <div className={cn('ml-auto text-right', tileSize ? 'flex items-baseline gap-2 pb-1' : 'pb-2')}>
          <div className="text-xs text-muted">{t('others')}</div>
          <div className={cn('tabular font-display font-bold text-muted', tileSize ? 'text-2xl' : 'text-3xl')}>{vm.others.seats}</div>
        </div>
      </div>
      <div className="relative">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-page">
          {vm.blocs.map(b => <div key={b.id} style={{ width: `${(b.seats / total) * 100}%`, background: b.color }} />)}
          <div style={{ width: `${(vm.others.seats / total) * 100}%` }} className="bg-muted/60" />
        </div>
        {vm.majority != null && <div className="absolute -top-1.5 h-5 w-0.5 bg-ink" style={{ left: `${(vm.majority / total) * 100}%` }} aria-hidden />}
        <div className={cn('flex justify-between text-xs text-muted', tileSize ? 'mt-1 leading-none' : 'mt-1.5')}>
          <span>0</span>
          {vm.majority != null && <span className="font-semibold text-ink">{t('studio_to_win', { count: vm.majority })}</span>}
          <span>{vm.totalSeats}</span>
        </div>
      </div>
      {variant === 'focus' && vm.winnerId && vm.marginOverMajority != null && (
        <p className="text-sm text-muted">{t('studio_wins_by', { name: vm.blocs[0].name, count: vm.marginOverMajority })}</p>
      )}
    </div>
  );
  if (variant === 'focus') {
    return (
      <div className="flex flex-col gap-6">
        {body}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {vm.breakdown.map(b => (
            <div key={b.id} className="rounded-xl border border-line p-3">
              <div className="mb-2 font-display text-lg font-bold" style={{ color: b.textColor }}>{b.name}</div>
              <table className="w-full text-sm"><tbody>
                {b.rows.map(r => (
                  <tr key={r.id} className="border-b border-line"><td className="py-1"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />{r.id} <span className="text-muted">{r.name}</span></td>
                    <td className="tabular text-right text-muted">{r.votePct != null ? `${r.votePct}%` : '—'}</td><td className="tabular w-12 text-right font-semibold">{r.seats}</td></tr>
                ))}
              </tbody></table>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <Tile title={t('studio_results')} onExpand={vm.onFocus} pulse={vm.pulse} bodyClassName={variant === 'tile' ? 'pb-2' : undefined}>{body}</Tile>;
}
