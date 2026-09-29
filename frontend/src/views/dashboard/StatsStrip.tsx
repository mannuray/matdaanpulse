import { useTranslation } from 'react-i18next';
import type { StatsVM, SeatRef } from '../../viewmodels/tiles/useStatsVM';

function Stat({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?(): void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="flex min-w-0 flex-1 flex-col justify-center rounded-xl border border-line bg-page/50 px-3 text-left enabled:hover:border-accent">
      <span className="truncate text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <span className="flex min-w-0 items-baseline gap-2"><span className="tabular font-display text-3xl font-bold leading-none text-ink">{value}</span>{sub && <span className="truncate text-xs text-muted">{sub}</span>}</span>
    </button>
  );
}

function SeatList({ title, seats, vm }: { title: string; seats: SeatRef[]; vm: StatsVM }) {
  return (
    <div><h3 className="mb-2 font-display text-lg font-bold uppercase text-ink">{title}</h3>
      <ol className="flex flex-col gap-1">{seats.map(s => (
        <li key={s.id}><button type="button" onClick={() => vm.onSelectSeat(s.id)} className="flex w-full items-center gap-2 rounded-[0.5rem] px-2 py-1 text-sm hover:bg-tile-raised">
          <span className="h-2 w-2 rounded-full" style={{ background: vm.partyColor.get(s.party) ?? '#8A93A6' }} />
          <span className="flex-1 truncate text-left">{s.name}</span><span className="text-muted">{s.party}</span><span className="tabular font-semibold">{s.margin.toLocaleString()}</span>
        </button></li>
      ))}</ol>
    </div>
  );
}

export function StatsStrip({ vm, variant }: { vm: StatsVM; variant: 'tile' | 'focus' }) {
  const { t } = useTranslation();
  const { stats } = vm;
  if (variant === 'focus') {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SeatList title={t('studio_closest_contests')} seats={vm.closest10} vm={vm} />
        <SeatList title={t('studio_biggest_wins')} seats={vm.biggest10} vm={vm} />
        {vm.flipped.length > 0 ? <SeatList title={t('studio_seats_flipped')} seats={vm.flipped} vm={vm} /> : (
          <div><h3 className="mb-2 font-display text-lg font-bold uppercase text-ink">{t('studio_live_feed')}</h3>
            <ul className="flex flex-col gap-1 text-sm">{vm.ticker.map(e => <li key={e.id}>{t(e.kind === 'won' ? 'studio_ticker_won' : 'studio_ticker_lead', { party: e.partyId, seat: e.constName })}</li>)}</ul></div>
        )}
      </div>
    );
  }
  const latest = vm.ticker[0];
  const tickerText = latest
    ? t(latest.kind === 'won' ? 'studio_ticker_won' : 'studio_ticker_lead', { party: latest.partyId, seat: latest.constName })
    : vm.isLive ? t('studio_ticker_waiting') : t('studio_ticker_all_declared', { count: stats.total });
  return (
    <section className="flex min-w-0 items-stretch gap-2 overflow-hidden rounded-tile border border-line bg-tile p-2">
      <Stat label={t('studio_declared')} value={`${stats.declared}/${stats.total}`} />
      <Stat label={t('studio_closest_contest')} value={stats.closest ? stats.closest.margin.toLocaleString() : '—'} sub={stats.closest ? `${stats.closest.name} · ${stats.closest.party}` : undefined} onClick={stats.closest ? () => vm.onSelectSeat(stats.closest!.id) : undefined} />
      <Stat label={t('studio_biggest_win')} value={stats.biggest ? stats.biggest.margin.toLocaleString() : '—'} sub={stats.biggest ? `${stats.biggest.name} · ${stats.biggest.party}` : undefined} onClick={stats.biggest ? () => vm.onSelectSeat(stats.biggest!.id) : undefined} />
      <Stat label={t('studio_seats_flipped')} value={stats.flipped != null ? String(stats.flipped) : '—'} />
      <div className="flex min-w-0 flex-[1.6] items-center gap-2 rounded-xl border border-line bg-page/50 px-3" aria-live="polite">
        <span className={vm.isLive ? 'h-2 w-2 shrink-0 animate-pulse rounded-full bg-live' : 'h-2 w-2 shrink-0 rounded-full bg-ok'} />
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted">{vm.isLive ? t('studio_live') : t('studio_latest')}</span>
        <span className="truncate text-sm text-ink">{tickerText}</span>
      </div>
      <button type="button" onClick={vm.onFocus} aria-label={t('studio_expand', { name: t('studio_stats') })} className="grid w-8 shrink-0 place-items-center rounded-full text-muted hover:text-accent">⤢</button>
    </section>
  );
}
