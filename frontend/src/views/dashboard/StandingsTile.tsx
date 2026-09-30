import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StandingsVM, StandingRow } from '../../viewmodels/tiles/useStandingsVM';
import type { LeadersVM, LeaderCard } from '../../viewmodels/tiles/useLeadersVM';
import type { SummaryVM } from '../../viewmodels/tiles/useSummaryVM';
import { SummaryTab } from './SummaryTab';
import { Tile } from './Tile';
import { STATUS_STYLE } from './statusStyle';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { PillToggle } from '../ui/PillToggle';
import { PickerSelect } from '../ui/PickerSelect';
import { ScrollArea } from '../ui/ScrollArea';
import { cn } from '../ui/cn';

export type StandingsTab = 'parties' | 'watchlist';
type TileTab = StandingsTab | 'summary';

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
  const color = vm.partyColor.get(c.partyId) ?? 'var(--color-fallback)';
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
      <button type="button" disabled={!pick} onClick={() => { vm.onAddCustom(pick); setPick(''); }} className="h-8 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-40">{t('studio_add')}</button>
    </div>
  );
}

/** Watched seats scroll inside the card; the "Add seat…" picker stays pinned below them. */
function WatchlistBody({ vm, label }: { vm: LeadersVM; label: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <ScrollArea label={label}>
        <div className="flex flex-col gap-1">
          {vm.watchlist.length === 0 && <p className="py-4 text-center text-sm text-muted">{t('studio_watch_empty')}</p>}
          {vm.watchlist.map(c => <WatchRow key={c.key} c={c} vm={vm} />)}
        </div>
      </ScrollArea>
      <AddSeat vm={vm} />
    </div>
  );
}

/** Plain (non-interactive) row for the mobile rail preview: no buttons, no remove control. */
function WatchPreviewRow({ c, vm }: { c: LeaderCard; vm: LeadersVM }) {
  const { t } = useTranslation();
  const color = vm.partyColor.get(c.partyId) ?? 'var(--color-fallback)';
  return (
    <div className="flex h-9 w-full items-center gap-2 px-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="max-w-[40%] shrink-0 truncate font-semibold text-ink">{c.constName}</span>
      <span className="shrink-0 text-xs text-muted">{c.partyId}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted">{c.name}</span>
      <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold', STATUS_STYLE[c.status])}>{t(`studio_status_${c.status.toLowerCase()}`)}</span>
    </div>
  );
}

const PREVIEW_ROWS = 4;

/** Non-interactive mobile rail glance: the top parties as dot, short id, thin bar and seats, plus "+N more". */
export function StandingsPreview({ vm }: { vm: StandingsVM }) {
  const { t } = useTranslation();
  if (vm.rows.length === 0) return <p className="py-2 text-sm text-muted">{t('studio_no_results_yet')}</p>;
  const top = vm.rows.slice(0, PREVIEW_ROWS);
  const rest = vm.rows.slice(PREVIEW_ROWS);
  const max = Math.max(1, ...top.map(r => r.seats));
  return (
    <div className="flex flex-col gap-0.5">
      {top.map(r => (
        <div key={r.id} data-preview-row className="grid h-[18px] grid-cols-[4.5rem_minmax(0,1fr)_2.25rem] items-center gap-2">
          <span data-preview-label className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-ink">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} /><span className="truncate">{r.id}</span>
          </span>
          <span data-preview-bar className="h-1.5 overflow-hidden rounded-full bg-page"><span className="block h-full rounded-full" style={{ width: `${(r.seats / max) * 100}%`, background: r.color }} /></span>
          <span className="tabular text-right font-display text-base font-bold leading-none text-ink">{r.seats}</span>
        </div>
      ))}
      {rest.length > 0 && <p className="text-[11px] leading-[14px] text-muted">{t('studio_more_parties', { count: rest.length, seats: rest.reduce((n, r) => n + r.seats, 0) })}</p>}
    </div>
  );
}

/** Non-interactive glance at the first watched seats (mobile rail). */
export function WatchlistPreview({ vm }: { vm: LeadersVM }) {
  const { t } = useTranslation();
  if (vm.watchlist.length === 0) return <p className="py-2 text-sm text-muted">{t('studio_watch_empty')}</p>;
  return <div className="flex flex-col gap-1">{vm.watchlist.slice(0, 2).map(c => <WatchPreviewRow key={c.key} c={c} vm={vm} />)}</div>;
}

export function StandingsTile({ vm, variant, watchlist, summary, initialTab, onTabChange }: {
  vm: StandingsVM; variant: 'tile' | 'focus'; watchlist?: LeadersVM; summary?: SummaryVM; initialTab?: StandingsTab;
  /** Reports the active Parties / Watchlist tab when it is picked and again right before the tile opens its focus view. */
  onTabChange?(tab: StandingsTab): void;
}) {
  const { t } = useTranslation();
  const wide = useMediaQuery('(min-width: 1280px)');
  // The summary tab exists only in the grid tile (the focus view keeps Parties / Watchlist) and is the default there.
  const withSummary = variant === 'tile' && summary != null;
  const [picked, setTab] = useState<TileTab | null>(null);
  const tab: TileTab = picked ?? initialTab ?? (withSummary ? 'summary' : 'parties');
  const shown: TileTab = tab === 'summary' && !withSummary ? 'parties' : tab === 'watchlist' && !watchlist ? 'parties' : tab;
  const pick = (v: TileTab) => { setTab(v); if (v !== 'summary') onTabChange?.(v); };
  // Opening the focus view from the Parties / Watchlist tab lands on that same tab.
  const expandStandings = () => { if (shown !== 'summary') onTabChange?.(shown); vm.onFocus(); };
  const options: { value: TileTab; label: string }[] = [];
  if (withSummary) options.push({ value: 'summary', label: wide ? t('studio_tab_summary', { layer: t(`map_tab_${summary.layer}`) }) : t('studio_tab_summary_short') });
  options.push({ value: 'parties', label: t('studio_tab_parties') });
  if (watchlist) options.push({ value: 'watchlist', label: t('studio_tab_watchlist', { count: watchlist.watchlist.length }) });
  const toggle = options.length > 1 && (
    <PillToggle<TileTab> size="sm" value={shown} onChange={pick} ariaLabel={t('party_standings')} options={options} />
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
  const label = options.find(o => o.value === shown)?.label ?? t('party_standings');
  return (
    <Tile title={t(shown === 'summary' ? 'studio_title_summary' : shown === 'watchlist' ? 'studio_title_watchlist' : 'party_standings')}
      onExpand={shown === 'summary' && summary ? summary.onFocus : expandStandings} pulse={vm.pulse} actions={toggle} stackActions={!wide && options.length > 1} bodyClassName="flex flex-col">
      {shown === 'summary' && summary ? (
        <ScrollArea label={label} resetKey={`summary:${summary.layer}`}><SummaryTab vm={summary} /></ScrollArea>
      ) : shown === 'watchlist' && watchlist ? <WatchlistBody vm={watchlist} label={label} /> : (
        <ScrollArea label={label} resetKey="parties">
          <div className="flex flex-col gap-1">
            {vm.rows.length === 0 && <p className="py-6 text-center text-sm text-muted">{t('studio_no_results_yet')}</p>}
            {vm.rows.map(r => <Row key={r.id} r={r} max={max} vm={vm} />)}
          </div>
        </ScrollArea>
      )}
    </Tile>
  );
}
