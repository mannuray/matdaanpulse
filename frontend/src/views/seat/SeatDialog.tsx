import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SeatDialogVM } from '../../viewmodels/tiles/useSeatDialogVM';
import { DetailDialog } from '../ui/DetailDialog';
import { PartyMark } from '../ui/PartyMark';
import { Avatar } from '../ui/Avatar';
import { formatIN } from '../ui/format';
import { STATUS_STYLE } from '../dashboard/statusStyle';
import { cn } from '../ui/cn';

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
  const parts = [t('seat_counting')];
  if (live.round) parts.push(t('seat_round', live.round));
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ok-text/40 bg-ok-tint px-2.5 py-0.5 text-xs font-semibold text-ok-text">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok-text" aria-hidden />{parts.join(' · ')}
    </span>
  );
}

export function SeatDialog({ vm }: { vm: SeatDialogVM | null }) {
  const { t } = useTranslation();
  if (!vm) return null;
  const stats = [
    vm.electors != null && <Stat key="e" label={t('seat_electors')} value={formatIN(vm.electors)} />,
    vm.turnout != null && <Stat key="t" label={t('seat_turnout')} value={`${vm.turnout}%`} />,
    vm.view.margin != null && <Stat key="m" label={t('seat_margin')} value={`+${formatIN(vm.view.margin)}`} tone="ok" />,
    vm.phase != null && <Stat key="p" label={t('seat_phase')} value={t('seat_phase_n', { n: vm.phase })} />,
  ].filter(Boolean);
  const header = (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
      {(vm.constNo != null || vm.type) && <span className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-ink">{[vm.constNo != null && `No. ${vm.constNo}`, vm.type && vm.type !== 'GEN' && vm.type].filter(Boolean).join(' · ')}</span>}
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
      {stats.length > 0 && <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{stats}</div>}
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
                {c.personId ? <Link to={vm.personHref(c.personId)} className="font-semibold text-ink hover:underline">{c.name}</Link> : <span className="font-semibold text-ink">{c.nota ? t('seat_nota') : c.name}</span>}
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
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {vm.history.length > 0 && <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t('seat_past_winners')}</span>}
        {vm.history.map(h => {
          const m = h.party ? vm.partyMeta.get(h.party) : undefined;
          return (
            <span key={h.year} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-xs text-ink">
              {h.year}<PartyMark mark={m?.mark ?? null} color={m?.color ?? null} label={m?.abbreviation ?? h.party ?? ''} />{m?.abbreviation ?? h.party}{h.vote_share != null && ` · ${h.vote_share}%`}
            </span>
          );
        })}
        <Link to={vm.fullPageHref} className="ml-auto text-sm font-semibold text-accent hover:underline">{t('seat_full_page')} →</Link>
      </div>
      {vm.notes.map(n => (
        <p key={n.kind} className="mt-3 rounded-tile border border-warn/50 bg-warn/10 px-3 py-2 text-xs text-warn-text">
          ⚠ {n.kind === 'threeWay' ? t('seat_three_way') : t('seat_spoiler', { party: n.party, votes: formatIN(n.votes), margin: formatIN(n.margin) })}
        </p>
      ))}
    </DetailDialog>
  );
}
