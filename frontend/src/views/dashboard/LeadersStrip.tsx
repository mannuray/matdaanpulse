import { useTranslation } from 'react-i18next';
import type { LeadersVM, LeaderCard } from '../../viewmodels/tiles/useLeadersVM';
import { fitCount } from '../../viewmodels/tiles/fit';
import { useElementWidth } from '../hooks/useElementWidth';
import { cn } from '../ui/cn';
import { STATUS_STYLE } from './statusStyle';
import { onKbdFocus } from '../ui/kbdFocus';

const CARD_W = 240;
const MORE_W = 96;
const GAP = 8;

function Card({ c, vm }: { c: LeaderCard; vm: LeadersVM }) {
  const { t } = useTranslation();
  const initials = c.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const color = vm.partyColor.get(c.partyId) ?? 'var(--color-fallback)';
  return (
    <button type="button" onClick={() => vm.onSelectSeat(c.constId)} onMouseEnter={() => vm.onHoverSeat(c.constId)} onMouseLeave={() => vm.onHoverSeat(null)} onFocus={onKbdFocus(() => vm.onHoverSeat(c.constId))} onBlur={() => vm.onHoverSeat(null)}
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
  const [ref, width] = useElementWidth<HTMLDivElement>();
  if (variant === 'focus') {
    return (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {vm.leaders.length === 0 && <span className="text-sm text-muted">{t('studio_no_leaders')}</span>}
        {vm.leaders.map(c => <Card key={c.key} c={c} vm={vm} />)}
      </div>
    );
  }
  const { count, overflow } = fitCount({ available: width, itemHeight: CARD_W, gap: GAP, footerHeight: MORE_W + GAP, total: vm.leaders.length });
  return (
    <section className="flex min-w-0 items-center gap-3 overflow-hidden rounded-tile border border-line bg-tile px-4">
      <h2 className="shrink-0 font-display text-base font-bold uppercase tracking-wider text-ink">{t('studio_key_leaders')}</h2>
      <div ref={ref} className="flex min-w-0 flex-1 gap-2 overflow-hidden">
        {vm.leaders.length === 0 && <span className="text-sm text-muted">{t('studio_no_leaders')}</span>}
        {vm.leaders.slice(0, count).map(c => <Card key={c.key} c={c} vm={vm} />)}
        {overflow > 0 && (
          <button type="button" onClick={vm.onFocus} className="h-12 w-24 shrink-0 rounded-xl border border-line text-sm font-semibold text-muted hover:border-accent hover:text-accent">
            {t('studio_more_leaders', { count: overflow })}
          </button>
        )}
      </div>
      <button type="button" onClick={vm.onFocus} aria-label={t('studio_expand', { name: t('studio_key_leaders') })} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:text-accent">⤢</button>
    </section>
  );
}
