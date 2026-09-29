import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LeadersVM, LeaderCard } from '../../viewmodels/tiles/useLeadersVM';
import { PickerSelect } from '../ui/PickerSelect';
import { cn } from '../ui/cn';

const STATUS_STYLE: Record<LeaderCard['status'], string> = {
  WON: 'bg-emerald-500/15 text-emerald-300', LEADING: 'bg-accent/15 text-accent', LOST: 'bg-live/15 text-live', TRAILING: 'bg-live/10 text-live', PENDING: 'bg-muted/15 text-muted',
};

function Card({ c, vm }: { c: LeaderCard; vm: LeadersVM }) {
  const { t } = useTranslation();
  const initials = c.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const color = vm.partyColor.get(c.partyId) ?? '#8A93A6';
  return (
    <button type="button" onClick={() => vm.onSelectSeat(c.constId)} onMouseEnter={() => vm.onHoverSeat(c.constId)} onMouseLeave={() => vm.onHoverSeat(null)}
      className="flex h-12 min-w-[240px] flex-1 items-center gap-3 rounded-xl border border-line bg-page/50 px-3 text-left hover:border-accent">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold" style={{ borderColor: color, color }}>{initials}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
        <span className="block truncate text-xs text-muted">{c.constName} · {c.partyId}</span>
      </span>
      <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold', STATUS_STYLE[c.status])}>{t(`studio_status_${c.status.toLowerCase()}`)}</span>
      {c.margin != null && c.status !== 'PENDING' && <span className="tabular shrink-0 text-xs font-semibold text-ink">{c.status === 'WON' || c.status === 'LEADING' ? '+' : '−'}{c.margin.toLocaleString()}</span>}
    </button>
  );
}

export function LeadersStrip({ vm, variant }: { vm: LeadersVM; variant: 'tile' | 'focus' }) {
  const { t } = useTranslation();
  const [pick, setPick] = useState('');
  if (variant === 'focus') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <PickerSelect value={pick} onChange={setPick} ariaLabel={t('studio_add_seat')} placeholder={t('studio_add_seat')} options={vm.seatOptions.map(s => ({ value: s.id, label: s.name }))} />
          <button type="button" disabled={!pick} onClick={() => { vm.onAddCustom(pick); setPick(''); }} className="h-8 rounded-full bg-accent px-4 text-sm font-semibold text-page disabled:opacity-40">{t('studio_add')}</button>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {vm.cards.map(c => (
            <div key={c.key} className="flex items-center gap-2">
              <Card c={c} vm={vm} />
              {c.custom && <button type="button" onClick={() => vm.onRemoveCustom(c.constId)} aria-label={t('studio_remove')} className="text-muted hover:text-live">✕</button>}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <section className="flex min-w-0 items-center gap-3 overflow-hidden rounded-tile border border-line bg-tile px-4">
      <h2 className="shrink-0 font-display text-base font-bold uppercase tracking-wider text-ink">{t('studio_key_leaders')}</h2>
      <div className="flex min-w-0 flex-1 gap-2 overflow-hidden">
        {vm.cards.length === 0 && <span className="text-sm text-muted">{t('studio_no_leaders')}</span>}
        {vm.cards.map(c => <Card key={c.key} c={c} vm={vm} />)}
      </div>
      <button type="button" onClick={vm.onFocus} aria-label={t('studio_expand', { name: t('studio_key_leaders') })} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:text-accent">⤢</button>
    </section>
  );
}
