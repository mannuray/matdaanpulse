import { useTranslation } from 'react-i18next';
import type { ScoreboardVM } from '../../viewmodels/tiles/useScoreboardVM';
import { Tile } from './Tile';
import { cn } from '../ui/cn';

export function ScoreboardTile({ vm, variant }: { vm: ScoreboardVM; variant: 'tile' | 'focus' | 'compact' }) {
  const { t } = useTranslation();
  const total = Math.max(vm.totalSeats, 1);
  const body = (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="flex items-end gap-4">
        {vm.blocs.map((b, i) => (
          <button key={b.id} type="button" onClick={() => vm.onLockBloc(b.id)} onMouseEnter={() => vm.onHoverBloc(b.id)} onMouseLeave={() => vm.onHoverBloc(null)}
            aria-label={`${b.name} ${b.seats}`} aria-pressed={vm.lockedId === b.id}
            className={cn('flex min-w-0 items-end gap-3 rounded-xl px-1 text-left', i > 0 && 'border-l border-line pl-4', vm.lockedId === b.id && 'ring-2 ring-accent')}>
            <div className="min-w-0 pb-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: b.color }}>
                <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />{b.name}
              </div>
              {b.votePct != null && <div className="text-xs text-muted">{t('studio_votes_pct', { pct: b.votePct })}</div>}
            </div>
            <span className={cn('tabular font-display font-extrabold leading-none', variant === 'compact' ? 'text-5xl' : 'text-[88px]')} style={{ color: b.color }}>{b.seats}</span>
          </button>
        ))}
        <div className="ml-auto pb-2 text-right">
          <div className="text-xs text-muted">{t('others')}</div>
          <div className="tabular font-display text-3xl font-bold text-muted">{vm.others.seats}</div>
        </div>
      </div>
      <div className="relative">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-page">
          {vm.blocs.map(b => <div key={b.id} style={{ width: `${(b.seats / total) * 100}%`, background: b.color }} />)}
          <div style={{ width: `${(vm.others.seats / total) * 100}%` }} className="bg-muted/60" />
        </div>
        <div className="absolute -top-1.5 h-5 w-0.5 bg-ink" style={{ left: `${(vm.majority / total) * 100}%` }} aria-hidden />
        <div className="mt-1.5 flex justify-between text-xs text-muted">
          <span>0</span>
          <span className="font-semibold text-ink">{t('studio_to_win', { count: vm.majority })}</span>
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
              <div className="mb-2 font-display text-lg font-bold" style={{ color: b.color }}>{b.name}</div>
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
  return <Tile title={t('studio_results')} onExpand={vm.onFocus} pulse={vm.pulse}>{body}</Tile>;
}
