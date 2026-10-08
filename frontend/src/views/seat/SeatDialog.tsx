import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { SeatDialogVM } from '../../viewmodels/tiles/useSeatDialogVM';
import { DetailDialog } from '../ui/DetailDialog';
import { PartyMark } from '../ui/PartyMark';
import { Avatar } from '../ui/Avatar';
import { formatIN } from '../ui/format';
import { STATUS_STYLE } from '../dashboard/statusStyle';
import { cn } from '../ui/cn';
import { MarginTrend } from './MarginTrend';

const MOMENTUM_COLOR: Record<string, string> = { switched: 'var(--color-map-mo-switched)', narrowing: 'var(--color-map-mo-narrowing)', widening: 'var(--color-map-mo-widening)' };

/** One upset badge's text: with the names when the baseline has them, plain otherwise (never empty brackets). */
function upsetText(t: TFunction, u: SeatDialogVM['upsets'][number]): string {
  if (u.kind === 'sitting_trailing') {
    if (!u.name) return t('seat_upset_sitting_trailing_plain');
    return t('seat_upset_sitting_trailing', { name: u.name, party: u.party ?? '' }) + (u.margin != null ? ` −${formatIN(u.margin)}` : '');
  }
  if (u.kind === 'stronghold_trailing') return u.party && u.since ? t('seat_upset_stronghold_trailing', { party: u.party, since: u.since }) : t('seat_upset_stronghold_trailing_plain');
  return u.name ? t('seat_upset_heavyweight_trailing', { name: u.name }) : t('seat_upset_heavyweight_trailing_plain');
}

/** Live counting: round progress, the call and momentum badges, the margin trend and the upset badges (spec §4). */
function LiveBlock({ vm }: { vm: SeatDialogVM }) {
  const { t } = useTranslation();
  const s = vm.liveSeat;
  if (!s) return null;
  const round = vm.live?.kind === 'counting' ? vm.live.round : null;
  // A countermanded / adjourned seat: its state chip says it all; a call or momentum would read as a live count.
  const halted = vm.live?.kind === 'countermanded' || vm.live?.kind === 'adjourned';
  const colorOf = (party: string | null) => (party ? vm.partyMeta.get(party)?.color : null) ?? 'var(--color-fallback)';
  return (
    <div className="mb-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {round && (
          <span className="h-1.5 w-28 overflow-hidden rounded-full bg-page" role="progressbar" aria-valuenow={round.current} aria-valuemax={round.total} aria-label={t('seat_round', round)}>
            <span className="block h-full bg-ok-text" style={{ width: `${(round.current / round.total) * 100}%` }} />
          </span>
        )}
        {!halted && <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-bold uppercase text-ink', s.call === 'too_close' ? 'border border-dashed border-warn-text text-warn-text' : 'border border-line')}>{t(`seat_call_${s.call}`)}</span>}
        {!halted && s.momentum && s.momentum !== 'stable' && (
          <span className="rounded-md px-2 py-0.5 text-[11px] font-bold uppercase text-white" style={{ background: MOMENTUM_COLOR[s.momentum] }}>{t(`map_legend_${s.momentum}`)}</span>
        )}
      </div>
      <MarginTrend points={vm.trend} colorOf={colorOf} />
      {vm.upsets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {vm.upsets.map(u => (
            <span key={u.kind} className="rounded-tile border border-live/50 bg-live/10 px-3 py-1 text-xs font-semibold text-ink">
              {upsetText(t, u)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' }) {
  return (
    <div className="rounded-tile border border-line bg-page/40 px-3 py-2 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={cn('tabular font-display text-xl font-bold text-ink', tone === 'ok' && 'text-ok-text')}>{value}</div>
    </div>
  );
}

export function LiveChip({ live }: { live: SeatDialogVM['live'] }) {
  const { t } = useTranslation();
  if (!live) return null;
  if (live.kind === 'declared') return <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-muted">{t('seat_declared')}</span>;
  if (live.kind === 'countermanded' || live.kind === 'adjourned') {
    return <span className="rounded-full border border-warn-text/40 px-2.5 py-0.5 text-xs font-semibold text-warn-text">{t(live.kind === 'countermanded' ? 'live_countermanded' : 'live_adjourned')}</span>;
  }
  const parts = [t('seat_counting')];
  if (live.round) parts.push(t('seat_round', live.round));
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ok-text/40 bg-ok-tint px-2.5 py-0.5 text-xs font-semibold text-ok-text">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok-text" aria-hidden />{parts.join(' · ')}
    </span>
  );
}

/** Placeholder block while the constituency detail loads (spec "Loading"). */
function Skel({ className }: { className: string }) {
  return <span aria-hidden data-skeleton className={cn('block animate-pulse rounded bg-tile-raised', className)} />;
}

export function SeatDialog({ vm }: { vm: SeatDialogVM | null }) {
  const { t } = useTranslation();
  if (!vm) return null;
  const loading = vm.detailState === 'loading';
  const stats = [
    vm.electors != null && <Stat key="e" label={t('seat_electors')} value={formatIN(vm.electors)} />,
    vm.turnout != null && <Stat key="t" label={t('seat_turnout')} value={`${vm.turnout}%`} />,
    vm.view.margin != null && <Stat key="m" label={t('seat_margin')} value={`+${formatIN(vm.view.margin)}`} tone="ok" />,
    vm.phase != null && <Stat key="p" label={t('seat_phase')} value={t('seat_phase_n', { n: vm.phase })} />,
  ].filter(Boolean);
  const header = (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
      {loading && <><Skel className="h-5 w-16" /><Skel className="h-4 w-28" /></>}
      {(vm.constNo != null || vm.type) && <span className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-ink">{[vm.constNo != null && t('seat_no', { n: vm.constNo }), vm.type && vm.type !== 'GEN' && vm.type].filter(Boolean).join(' · ')}</span>}
      {vm.place && <span>{vm.place}</span>}
      <LiveChip live={vm.live} />
      <button type="button" onClick={vm.onToggleTrack} aria-pressed={vm.tracked}
        className="rounded-full border border-line px-3 py-0.5 text-xs font-semibold text-muted hover:border-accent hover:text-ink aria-pressed:border-accent aria-pressed:text-accent">
        {vm.tracked ? t('studio_tracked') : t('studio_track')}
      </button>
    </div>
  );
  return (
    <DetailDialog open title={vm.name} onClose={vm.onClose} header={header}>
      {loading
        ? <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Skel key={i} className="h-[58px] rounded-tile" />)}</div>
        : stats.length > 0 && <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{stats}</div>}
      <LiveBlock vm={vm} />
      {vm.detailState === 'error' && <p className="mb-2 text-xs text-muted">{t('seat_details_unavailable')}</p>}
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
          <th className="py-2 font-semibold">{t('seat_rank_candidate')}</th><th className="font-semibold">{t('seat_party')}</th>
          <th className="text-right font-semibold">{t('seat_votes')}</th><th className="pl-3 font-semibold">{t('seat_share')}</th><th className="text-right font-semibold">{t('seat_status')}</th>
        </tr></thead>
        <tbody>
          {vm.view.candidates.map((c, i) => (
            <tr key={c.key} className="border-b border-line/60">
              <td className="py-2"><div className="flex items-center gap-2">
                <span className="w-6 text-xs text-muted">#{i + 1}</span>
                <Avatar name={c.name} photo={c.photo} size={36} />
                {c.nota ? <span className="font-semibold text-ink">{t('seat_nota')}</span> : c.personId ? <Link to={vm.personHref(c.personId)} className="font-semibold text-ink hover:underline">{c.name}</Link> : <span className="font-semibold text-ink">{c.name}</span>}
                {c.incumbent && <span className="rounded-full border border-accent/50 px-1.5 text-[10px] text-accent">{t('seat_incumbent')}</span>}
              </div></td>
              <td>{c.partyId ? (
                <button type="button" onClick={() => vm.onOpenParty(c.partyId!)} className="flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-tile-raised">
                  <PartyMark mark={c.mark} color={c.color} label={c.partyLabel} size={24} /><span className="text-ink">{c.partyLabel}</span>
                </button>) : null}</td>
              <td className="tabular text-right font-semibold text-ink">{formatIN(c.votes)}</td>
              <td className="pl-3"><div className="flex items-center gap-2"><span className="tabular w-12 text-xs text-ink">{c.share}%</span>
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-page"><span className="block h-full" style={{ width: `${c.share}%`, background: c.color }} /></span></div></td>
              <td className="text-right">{c.pill && <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold', STATUS_STYLE[c.pill])}>{t(`studio_status_${c.pill.toLowerCase()}`)}</span>}</td>
            </tr>
          ))}
          {vm.view.others && (
            <tr><td className="py-2 pl-8 text-muted">{t('seat_others', { count: vm.view.others.count })}</td><td /><td className="tabular text-right text-muted">{formatIN(vm.view.others.votes)}</td><td className="pl-3 text-xs text-muted">{vm.view.others.share}%</td><td /></tr>
          )}
        </tbody>
      </table>
      {vm.narrowed && <p className="mt-3 rounded-tile border border-line px-3 py-2 text-xs text-ink-2">{t(`seat_${vm.narrowed.kind}`, { from: formatIN(vm.narrowed.from), to: formatIN(vm.narrowed.to), n: vm.narrowed.rounds })}</p>}
      {/* Footer: past winners, then the 3-way / spoiler notes, then the full-page link last. */}
      {(vm.history.length > 0 || loading) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {vm.history.length > 0 && <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t('seat_past_winners')}</span>}
          {loading && vm.history.length === 0 && [0, 1, 2].map(i => <Skel key={i} className="h-6 w-24 rounded-md" />)}
          {vm.history.map((h, i) => {
            const m = h.party ? vm.partyMeta.get(h.party) : undefined;
            return (
              <span key={`${h.year}-${i}`} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-xs text-ink">
                {h.year}<PartyMark mark={m?.mark ?? null} color={m?.color ?? null} label={m?.abbreviation ?? h.party ?? ''} />{m?.abbreviation ?? h.party}{h.vote_share != null && ` · ${h.vote_share}%`}
              </span>
            );
          })}
        </div>
      )}
      {vm.notes.map(n => (
        <p key={n.kind} className="mt-3 rounded-tile border border-warn/50 bg-warn/10 px-3 py-2 text-xs text-warn-text">
          ⚠ {n.kind === 'threeWay' ? t('seat_three_way') : t('seat_spoiler', { party: vm.partyMeta.get(n.party)?.abbreviation ?? n.party, votes: formatIN(n.votes), margin: formatIN(n.margin) })}
        </p>
      ))}
      <div className="mt-4 flex justify-end">
        <Link to={vm.fullPageHref} className="text-sm font-semibold text-accent hover:underline">{t('seat_full_page')} →</Link>
      </div>
    </DetailDialog>
  );
}
