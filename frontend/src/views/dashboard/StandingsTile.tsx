import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StandingsVM, StandingRow } from '../../viewmodels/tiles/useStandingsVM';
import type { LeadersVM, LeaderCard } from '../../viewmodels/tiles/useLeadersVM';
import type { SummaryVM } from '../../viewmodels/tiles/useSummaryVM';
import { SummaryTab } from './SummaryTab';
import { Tile } from './Tile';
import { STATUS_STYLE } from './statusStyle';
import { useFitRows } from '../hooks/useFitRows';
import { PillToggle } from '../ui/PillToggle';
import { PickerSelect } from '../ui/PickerSelect';
import { cn } from '../ui/cn';

export type StandingsTab = 'parties' | 'watchlist';
type TileTab = StandingsTab | 'summary';

const ROW_H = 36;
/** Height reserved under the watchlist rows for the "Add seat…" control (h-8 + gap). */
const ADD_H = 36;

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

function WatchRow({ c, vm }: { c: LeaderCard; vm: LeadersVM }) {
  const { t } = useTranslation();
  const color = vm.partyColor.get(c.partyId) ?? '#8A93A6';
  return (
    <div className="flex h-9 w-full items-center gap-1 rounded-[0.5rem] hover:bg-tile-raised" onMouseEnter={() => vm.onHoverSeat(c.constId)} onMouseLeave={() => vm.onHoverSeat(null)}>
      <button type="button" onClick={() => vm.onSelectSeat(c.constId)} className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-[0.5rem] px-2 text-left">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="max-w-[40%] shrink-0 truncate font-semibold text-ink">{c.constName}</span>
        <span className="shrink-0 text-xs text-muted">{c.partyId}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted">{c.name}</span>
        <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold', STATUS_STYLE[c.status])}>{t(`studio_status_${c.status.toLowerCase()}`)}</span>
        {c.margin != null && c.status !== 'PENDING' && <span className="tabular shrink-0 text-xs font-semibold text-ink">{c.status === 'WON' || c.status === 'LEADING' ? '+' : '−'}{c.margin.toLocaleString()}</span>}
      </button>
      <button type="button" onClick={() => vm.onRemoveCustom(c.constId)} aria-label={t('studio_remove_seat', { name: c.constName })}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:text-live">✕</button>
    </div>
  );
}

function AddSeat({ vm }: { vm: LeadersVM }) {
  const { t } = useTranslation();
  const [pick, setPick] = useState('');
  return (
    <div className="flex shrink-0 items-center gap-2 px-2">
      <PickerSelect value={pick} onChange={setPick} ariaLabel={t('studio_add_seat')} placeholder={t('studio_add_seat')} options={vm.seatOptions.map(s => ({ value: s.id, label: s.name }))} />
      <button type="button" disabled={!pick} onClick={() => { vm.onAddCustom(pick); setPick(''); }} className="h-8 rounded-full bg-accent px-4 text-sm font-semibold text-page disabled:opacity-40">{t('studio_add')}</button>
    </div>
  );
}

function WatchlistBody({ vm, onMore }: { vm: LeadersVM; onMore(): void }) {
  const { t } = useTranslation();
  const fit = useFitRows(vm.watchlist, ROW_H, 4, 22, ADD_H);
  return (
    <div ref={fit.ref} className="flex h-full flex-col gap-1">
      {vm.watchlist.length === 0 && <p className="py-4 text-center text-sm text-muted">{t('studio_watch_empty')}</p>}
      {fit.visible.map(c => <WatchRow key={c.key} c={c} vm={vm} />)}
      {fit.moreCount > 0 && (
        <button type="button" onClick={onMore} className="px-2 text-left text-xs text-muted hover:text-accent">
          {t('studio_more_leaders', { count: fit.moreCount })}
        </button>
      )}
      <div className="mt-auto"><AddSeat vm={vm} /></div>
    </div>
  );
}

/** Non-interactive glance at the first watched seats (mobile rail). */
export function WatchlistPreview({ vm }: { vm: LeadersVM }) {
  const { t } = useTranslation();
  if (vm.watchlist.length === 0) return <p className="py-2 text-sm text-muted">{t('studio_watch_empty')}</p>;
  return <div className="flex flex-col gap-1">{vm.watchlist.slice(0, 2).map(c => <WatchRow key={c.key} c={c} vm={vm} />)}</div>;
}

export function StandingsTile({ vm, variant, watchlist, summary, initialTab }: {
  vm: StandingsVM; variant: 'tile' | 'focus'; watchlist?: LeadersVM; summary?: SummaryVM; initialTab?: StandingsTab;
}) {
  const { t } = useTranslation();
  // The summary tab exists only in the grid tile (the focus view keeps Parties / Watchlist) and is the default there.
  const withSummary = variant === 'tile' && summary != null;
  const [picked, setTab] = useState<TileTab | null>(null);
  const tab: TileTab = picked ?? initialTab ?? (withSummary ? 'summary' : 'parties');
  const shown: TileTab = tab === 'summary' && !withSummary ? 'parties' : tab === 'watchlist' && !watchlist ? 'parties' : tab;
  const fit = useFitRows(vm.rows, ROW_H);
  const options: { value: TileTab; label: string }[] = [];
  if (withSummary) options.push({ value: 'summary', label: t('studio_tab_summary', { layer: t(`map_tab_${summary.layer}`) }) });
  options.push({ value: 'parties', label: t('studio_tab_parties') });
  if (watchlist) options.push({ value: 'watchlist', label: t('studio_tab_watchlist', { count: watchlist.watchlist.length }) });
  const toggle = options.length > 1 && (
    <PillToggle<TileTab> size="sm" value={shown} onChange={setTab} ariaLabel={t('party_standings')} options={options} />
  );
  if (variant === 'focus') {
    const max = Math.max(1, ...vm.allRows.map(r => r.seats));
    return (
      <div className="flex flex-col gap-3">
        {toggle && <div className="flex">{toggle}</div>}
        {shown === 'watchlist' && watchlist ? (
          <div className="flex flex-col gap-1">
            {watchlist.watchlist.length === 0 && <p className="py-4 text-sm text-muted">{t('studio_watch_empty')}</p>}
            {watchlist.watchlist.map(c => <WatchRow key={c.key} c={c} vm={watchlist} />)}
            <div className="mt-2"><AddSeat vm={watchlist} /></div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">{vm.allRows.map(r => <Row key={r.id} r={r} max={max} vm={vm} wide />)}</div>
        )}
      </div>
    );
  }
  const max = Math.max(1, ...vm.rows.map(r => r.seats));
  return (
    <Tile title={t(shown === 'summary' ? 'studio_title_summary' : shown === 'watchlist' ? 'studio_title_watchlist' : 'party_standings')}
      onExpand={shown === 'summary' && summary ? summary.onFocus : vm.onFocus} pulse={vm.pulse} actions={toggle}>
      {shown === 'summary' && summary ? <SummaryTab vm={summary} /> : shown === 'watchlist' && watchlist ? <WatchlistBody vm={watchlist} onMore={vm.onFocus} /> : (
        <div ref={fit.ref} className="flex h-full flex-col gap-1">
          {vm.rows.length === 0 && <p className="py-6 text-center text-sm text-muted">{t('studio_no_results_yet')}</p>}
          {fit.visible.map(r => <Row key={r.id} r={r} max={max} vm={vm} />)}
          {fit.moreCount > 0 && (
            <button type="button" onClick={vm.onFocus} className="mt-auto px-2 text-left text-xs text-muted hover:text-accent">
              {t('studio_more_parties', { count: fit.moreCount, seats: fit.moreSeats })}
            </button>
          )}
        </div>
      )}
    </Tile>
  );
}
