import { useId, useState } from 'react';
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
  // Like the other summary sections: the first (Statewide) starts open, the regions are collapsible headers.
  const [toggled, setToggled] = useState(new Map<string, boolean>());
  const isOpen = (name: string, i: number) => toggled.get(name) ?? i === 0;
  const toggle = (name: string, i: number) => setToggled(new Map(toggled).set(name, !isOpen(name, i)));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <PillToggle<RegionMode> size="sm" value={vm.mode} onChange={vm.onMode} ariaLabel={t('regions_mode', 'Group by')}
          options={[{ value: 'party', label: t('regions_by_party', 'Party') }, { value: 'alliance', label: t('regions_by_alliance', 'Alliance') }]} />
        <span className="text-xs text-muted">{hasPrev ? t('regions_compare', '{{prev}} → {{cur}}', { prev: vm.prevYear, cur: vm.curYear }) : vm.curYear}</span>
      </div>
      {!hasPrev && <p className="text-xs text-muted">{t('regions_no_prev', 'No earlier election of this state to compare with: {{cur}} only.', { cur: vm.curYear })}</p>}
      {vm.approximate && <p className="text-xs text-muted">{t('regions_approx_note', 'Seats were redrawn, so regions are compared as a whole: vote share and seats, {{prev}} → {{cur}}. A few seats straddle regions, so this is approximate.', { prev: vm.prevYear, cur: vm.curYear })}</p>}
      {vm.rows.map((r, i) => (
        <RegionSection key={r.name} r={r} hasPrev={hasPrev} open={isOpen(r.name, i)} onToggle={() => toggle(r.name, i)}
          locked={lockedName === r.name} onHoverRow={onHoverRow} onLockRow={onLockRow} />
      ))}
    </div>
  );
}

/** One region: a header that toggles its rows (hover previews it on the map) and a pin that locks it on the map. */
function RegionSection({ r, hasPrev, open, onToggle, locked, onHoverRow, onLockRow }: {
  r: RegionRow; hasPrev: boolean; open: boolean; onToggle(): void; locked: boolean;
  onHoverRow?(r: RegionRow | null): void; onLockRow?(r: RegionRow): void;
}) {
  const { t } = useTranslation();
  const bodyId = useId();
  const seats = hasPrev ? t('regions_seats', '{{prev}} → {{cur}} seats', { prev: r.seats[0], cur: r.seats[1] }) : t('regions_seats_now', '{{cur}} seats', { cur: r.seats[1] });
  return (
    <section className={cn('rounded-lg border', locked ? 'border-accent bg-tile-raised' : 'border-line')}
      onMouseEnter={() => onHoverRow?.(r)} onMouseLeave={() => onHoverRow?.(null)}>
      <h4 className="flex items-center gap-1 pr-1 text-sm">
        <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={onToggle} onFocus={() => onHoverRow?.(r)} onBlur={() => onHoverRow?.(null)}
          className="flex min-w-0 flex-1 items-baseline justify-between gap-2 px-2 py-1.5 text-left hover:text-ink">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span aria-hidden className={`text-sm leading-none text-muted transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
            <span className="truncate text-sm font-semibold text-ink">{r.name}</span>
          </span>
          <span className="tabular shrink-0 text-xs text-muted">{seats}</span>
        </button>
        {onLockRow && (
          <button type="button" aria-pressed={locked} aria-label={t('regions_pin', 'Show {{name}} on the map', { name: r.name })} onClick={() => onLockRow(r)}
            className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs', locked ? 'bg-accent text-white' : 'text-muted hover:bg-tile-raised hover:text-ink')}>⌖</button>
        )}
      </h4>
      {open && (
        <ul id={bodyId} className="flex flex-col gap-0.5 px-2 pb-2">
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
      )}
    </section>
  );
}
