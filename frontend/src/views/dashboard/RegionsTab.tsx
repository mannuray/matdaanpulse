import { useTranslation } from 'react-i18next';
import type { RegionComparisonVM, RegionMode } from '../../viewmodels/tiles/useRegionComparisonVM';
import type { RegionRow } from '../../viewmodels/tiles/useRegionComparisonVM';
import { PillToggle } from '../ui/PillToggle';
import { cn } from '../ui/cn';

const pct = (v: number | null) => (v === null ? '—' : `${v}%`);
const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((b - a) * 10) / 10);

/**
 * The Regions layer's summary: statewide and per-region vote share (with its change in points) and seats, previous →
 * current. Hovering a region previews it on the map, clicking locks it (the map outlines it and dims the rest).
 */
export function RegionsTab({ vm, onHoverRow, onLockRow, lockedName }: {
  vm: RegionComparisonVM; onHoverRow?(r: RegionRow | null): void; onLockRow?(r: RegionRow): void; lockedName?: string | null;
}) {
  const { t } = useTranslation();
  const hasPrev = vm.prevYear !== null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <PillToggle<RegionMode> size="sm" value={vm.mode} onChange={vm.onMode} ariaLabel={t('regions_mode', 'Group by')}
          options={[{ value: 'party', label: t('regions_by_party', 'Party') }, { value: 'alliance', label: t('regions_by_alliance', 'Alliance') }]} />
        <span className="text-xs text-muted">{hasPrev ? t('regions_compare', '{{prev}} → {{cur}}', { prev: vm.prevYear, cur: vm.curYear }) : vm.curYear}</span>
      </div>
      {!hasPrev && <p className="text-xs text-muted">{t('regions_no_prev', 'No earlier election of this state to compare with: {{cur}} only.', { cur: vm.curYear })}</p>}
      {vm.approximate && <p className="text-xs text-muted">{t('regions_approx_note', 'Seats were redrawn, so regions are compared as a whole: vote share and seats, {{prev}} → {{cur}}. A few seats straddle regions, so this is approximate.', { prev: vm.prevYear, cur: vm.curYear })}</p>}
      {vm.rows.map(r => (
        <section key={r.name} role="button" tabIndex={0} aria-pressed={lockedName === r.name} aria-label={r.name}
          onMouseEnter={() => onHoverRow?.(r)} onMouseLeave={() => onHoverRow?.(null)} onFocus={() => onHoverRow?.(r)} onBlur={() => onHoverRow?.(null)}
          onClick={() => onLockRow?.(r)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLockRow?.(r); } }}
          className={cn('cursor-pointer rounded-lg border p-2 hover:border-accent', lockedName === r.name ? 'border-accent bg-tile-raised' : 'border-line')}>
          <header className="mb-1 flex items-baseline justify-between gap-2">
            <h4 className="font-semibold text-ink">{r.name}</h4>
            <span className="tabular text-xs text-muted">{hasPrev ? t('regions_seats', '{{prev}} → {{cur}} seats', { prev: r.seats[0], cur: r.seats[1] }) : t('regions_seats_now', '{{cur}} seats', { cur: r.seats[1] })}</span>
          </header>
          <ul className="flex flex-col gap-0.5">
            {r.groups.map(g => {
              const d = delta(g.share[0], g.share[1]);
              return (
                <li key={g.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2 text-sm">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: g.color }} />
                  <span className="truncate text-ink">{g.label}</span>
                  <span className="tabular text-ink">{pct(g.share[1])}</span>
                  <span className={cn('tabular w-12 text-right text-xs', d === null ? 'text-muted' : d > 0 ? 'text-emerald-500' : d < 0 ? 'text-rose-500' : 'text-muted')}>
                    {d === null ? '' : d > 0 ? `+${d}` : `${d}`}
                  </span>
                  <span className="tabular whitespace-nowrap text-right font-semibold text-ink">{hasPrev ? `${g.won[0] ?? 0} → ${g.won[1]}` : `${g.won[1]}`}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
