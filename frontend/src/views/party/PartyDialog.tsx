import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { PartyDialogVM } from '../../viewmodels/tiles/usePartyDialogVM';
import { DetailDialog } from '../ui/DetailDialog';
import { PartyMark } from '../ui/PartyMark';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import { cn } from '../ui/cn';

/** A party colour (hex or var()) at a given opacity, for tints and borders. */
const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col justify-center rounded-xl border border-line bg-page px-3 py-2.5 text-center">
      <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      <span className="tabular font-display text-3xl font-extrabold leading-tight" style={{ color }}>{value}</span>
    </div>
  );
}

export function PartyDialog({ vm }: { vm: PartyDialogVM | null }) {
  const { t } = useTranslation();
  if (!vm) return null;
  const { stats } = vm;
  const color = vm.color ?? 'var(--color-fallback)';
  const pct = (n: number) => `${(n / Math.max(vm.totalSeats, 1)) * 100}%`;
  const fields = ([
    ['party_leader', vm.profile?.leader ?? null], ['party_founded', vm.profile?.founded?.toString() ?? null], ['party_hq', vm.profile?.hq ?? null],
    ['party_alliance', stats.alliance?.name ?? null],
  ] as const).filter(([, v]) => v);
  const links = ([['party_website', vm.profile?.website ?? null], ['party_wikipedia', vm.profile?.wikipedia ?? null]] as const).filter(([, v]) => v);
  const leading = (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border shadow-lg" style={{ borderColor: tint(color, 35), background: tint(color, 12) }}>
      <PartyMark mark={vm.mark} color={vm.color} label={vm.abbreviation ?? vm.id} size={40} />
    </span>
  );
  const titleSuffix = vm.abbreviation && vm.abbreviation !== vm.name ? <span className="font-display text-lg font-bold uppercase tracking-wider text-muted">{vm.abbreviation}</span> : null;
  const header = vm.recognition ? (
    <div className="mt-1.5 flex items-center gap-2">
      <span className="inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium" style={{ color, borderColor: tint(color, 40), background: tint(color, 12) }}>{t(`party_recognition_${vm.recognition}`)}</span>
    </div>
  ) : null;
  return (
    <DetailDialog open title={vm.name} onClose={vm.onClose} leading={leading} titleSuffix={titleSuffix} header={header}>
      <div className="flex flex-col gap-4">
        {/* This election */}
        <section className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
            {t('party_this_election', { name: vm.electionName })}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Metric label={t('party_won')} value={String(stats.won)} color="var(--color-ok-text)" />
            <Metric label={t('party_leading')} value={String(stats.leading)} color="var(--color-ok-text)" />
            <Metric label={t('party_contested')} value={String(stats.contested)} />
            {stats.votePct != null && <Metric label={t('party_vote_share')} value={`${Math.round(stats.votePct * 10) / 10}%`} />}
          </div>
          <div className="pt-1">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted">
              <span>{t('party_seats_total', { n: stats.won + stats.leading, contested: stats.contested })}</span>
              <span>{t('party_scale', { total: vm.totalSeats })}</span>
            </div>
            <div className="relative h-4 w-full overflow-hidden rounded-full border border-line bg-page" role="img" aria-label={`${stats.won + stats.leading} / ${vm.totalSeats}`}>
              <span className="absolute inset-y-0 left-0" style={{ width: pct(stats.won), background: color }} />
              <span className="absolute inset-y-0 border-l border-page/60 [background-image:repeating-linear-gradient(45deg,transparent_0_4px,rgba(0,0,0,.35)_4px_8px)]"
                style={{ left: pct(stats.won), width: pct(stats.leading), backgroundColor: tint(color, 70) }} />
              <span className="absolute inset-y-0 z-10 w-0.5 bg-ink shadow-sm" style={{ left: pct(vm.majority) }} />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />{t('party_won_n', { n: stats.won })}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm [background-image:repeating-linear-gradient(45deg,transparent_0_2px,rgba(0,0,0,.35)_2px_4px)]" style={{ backgroundColor: tint(color, 70) }} />{t('party_leading_n', { n: stats.leading })}</span>
              </div>
              <span className="flex items-center gap-1 font-mono text-ink/80"><span className="h-1.5 w-1.5 rounded-full bg-ink" />{t('party_majority_mark', { n: vm.majority })}</span>
            </div>
          </div>
        </section>

        {/* Profile */}
        {(fields.length > 0 || links.length > 0 || vm.profile?.description) && (
          <section className="space-y-3 rounded-xl border border-line bg-page/60 p-3.5 text-xs">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              {fields.map(([k, v]) => (
                <div key={k}><dt className="block text-[10px] font-semibold uppercase tracking-wider text-muted">{t(k)}</dt>
                  <dd className="mt-0.5 block text-xs font-semibold" style={k === 'party_alliance' ? { color } : undefined}>{v}</dd></div>
              ))}
              {links.map(([k, v]) => (
                <div key={k}><dt className="block text-[10px] font-semibold uppercase tracking-wider text-muted">{t(k)}</dt>
                  <dd><a href={v!} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-medium text-accent-text hover:underline">{k === 'party_website' ? v!.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : t(k)}<Icon name="external" className="h-3 w-3" /></a></dd></div>
              ))}
            </dl>
            {vm.profile?.description && <p className={cn('text-[11px] leading-relaxed text-muted', (fields.length > 0 || links.length > 0) && 'border-t border-line pt-2.5')}>{vm.profile.description}</p>}
          </section>
        )}

        {/* Key candidates */}
        {vm.keyCandidates.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <h2 className="font-display font-bold uppercase tracking-wider text-ink/80">{t('party_key_candidates')}</h2>
              <span className="text-[10px] font-medium text-muted">{t('party_key_hint')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {vm.keyCandidates.map(c => (
                <button key={c.key} type="button" onClick={() => vm.onSelectSeat(c.constId)}
                  className="group flex flex-col justify-between rounded-xl border border-line bg-page p-2.5 text-left transition-colors hover:border-[color:var(--hover)]" style={{ '--hover': tint(color, 50) } as CSSProperties}>
                  <div className="mb-2 flex items-start gap-2.5">
                    <Avatar name={c.name} photo={null} size={36} />
                    <div className="min-w-0"><div className="truncate text-xs font-semibold leading-tight text-ink">{c.name}</div><span className="block truncate text-[10px] text-muted">{c.constName}</span></div>
                  </div>
                  <div className="flex items-center justify-end border-t border-line/60 pt-1.5">
                    <span className="rounded border border-ok-text/40 bg-ok-text/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-ok-text">{t(`studio_status_${c.status.toLowerCase()}`)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </DetailDialog>
  );
}
