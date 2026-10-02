import { useTranslation } from 'react-i18next';
import type { PartyDialogVM } from '../../viewmodels/tiles/usePartyDialogVM';
import { DetailDialog } from '../ui/DetailDialog';
import { PartyMark } from '../ui/PartyMark';
import { STATUS_STYLE } from '../dashboard/statusStyle';
import { cn } from '../ui/cn';

function Big({ label, value, tone }: { label: string; value: string; tone?: boolean }) {
  return <div className="rounded-tile border border-line bg-page/40 px-3 py-2 text-center"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div><div className={cn('tabular font-display text-3xl font-bold', tone ? 'text-ok-text' : 'text-ink')}>{value}</div></div>;
}

export function PartyDialog({ vm }: { vm: PartyDialogVM | null }) {
  const { t } = useTranslation();
  if (!vm) return null;
  const { stats } = vm;
  const pct = (n: number) => `${(n / Math.max(vm.totalSeats, 1)) * 100}%`;
  const fields = vm.profile ? ([
    ['party_leader', vm.profile.leader], ['party_founded', vm.profile.founded?.toString() ?? null], ['party_hq', vm.profile.hq], ['party_alliance', stats.alliance?.name ?? null],
  ] as const).filter(([, v]) => v) : (stats.alliance ? [['party_alliance', stats.alliance.name] as const] : []);
  const links = vm.profile ? ([['party_website', vm.profile.website], ['party_wikipedia', vm.profile.wikipedia]] as const).filter(([, v]) => v) : [];
  const header = (
    <div className="mt-1 flex items-center gap-2 text-sm text-muted">
      <PartyMark mark={vm.mark} color={vm.color} label={vm.abbreviation ?? vm.id} size={40} />
      {vm.abbreviation && <span className="font-semibold text-ink">{vm.abbreviation}</span>}
      {vm.recognition && <span className="rounded-md border border-line px-2 py-0.5 text-xs">{t(`party_recognition_${vm.recognition}`)}</span>}
    </div>
  );
  return (
    <DetailDialog open title={vm.name} onClose={vm.onClose} header={header}>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{t('party_this_election', { name: vm.electionName })}</h3>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Big label={t('party_won')} value={String(stats.won)} tone /><Big label={t('party_leading')} value={String(stats.leading)} tone />
        <Big label={t('party_contested')} value={String(stats.contested)} />
        {stats.votePct != null && <Big label={t('party_vote_share')} value={`${stats.votePct}%`} />}
      </div>
      <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-page" role="img" aria-label={`${stats.won + stats.leading} / ${vm.totalSeats}`}>
        <span className="absolute inset-y-0 left-0" style={{ width: pct(stats.won), background: vm.color ?? 'var(--color-fallback)' }} />
        <span className="absolute inset-y-0 opacity-60 [background-image:repeating-linear-gradient(45deg,transparent_0_4px,rgba(0,0,0,.35)_4px_8px)]" style={{ left: pct(stats.won), width: pct(stats.leading), backgroundColor: vm.color ?? 'var(--color-fallback)' }} />
        <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: pct(vm.majority) }} />
      </div>
      <p className="mt-1 text-right text-xs text-muted">{t('party_majority', { n: vm.majority })}</p>
      {(fields.length > 0 || links.length > 0 || vm.profile?.description) && (
        <div className="mt-4 rounded-tile border border-line p-3">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {fields.map(([k, v]) => <div key={k}><dt className="text-[11px] uppercase tracking-wider text-muted">{t(k)}</dt><dd className="font-semibold text-ink">{v}</dd></div>)}
            {links.map(([k, v]) => <div key={k}><dt className="text-[11px] uppercase tracking-wider text-muted">{t(k)}</dt><dd><a href={v!} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{t(k)} ↗</a></dd></div>)}
          </dl>
          {vm.profile?.description && <p className="mt-3 text-sm text-muted">{vm.profile.description}</p>}
        </div>
      )}
      {vm.keyCandidates.length > 0 && (
        <>
          <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">{t('party_key_candidates')}</h3>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {vm.keyCandidates.map(c => (
              <button key={c.key} type="button" onClick={() => vm.onSelectSeat(c.constId)} className="rounded-tile border border-line p-2 text-left hover:bg-tile-raised">
                <div className="truncate font-semibold text-ink">{c.name}</div><div className="truncate text-xs text-muted">{c.constName}</div>
                <span className={cn('mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11px] font-bold', STATUS_STYLE[c.status])}>{t(`studio_status_${c.status.toLowerCase()}`)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </DetailDialog>
  );
}
