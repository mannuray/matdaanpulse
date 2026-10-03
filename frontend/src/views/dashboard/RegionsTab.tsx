import { useTranslation } from 'react-i18next';
import type { RegionComparisonVM } from '../../viewmodels/tiles/useRegionComparisonVM';

const fmt = (v: number | null) => (v === null ? '—' : `${v}%`);

/** Statewide and per-region vote share and seats, previous → current election (after a redraw). */
export function RegionsTab({ vm }: { vm: RegionComparisonVM }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">{t('regions_approx_note', 'Seats were redrawn, so regions are compared as a whole: vote share and seats, {{prev}} → {{cur}}. A few seats straddle regions, so this is approximate.', { prev: vm.prevYear, cur: vm.curYear })}</p>
      {vm.rows.map(r => (
        <section key={r.name} className="rounded-lg border border-line p-2">
          <header className="mb-1 flex items-baseline justify-between gap-2">
            <h4 className="font-semibold text-ink">{r.name}</h4>
            <span className="tabular text-xs text-muted">{t('regions_seats', '{{prev}} → {{cur}} seats', { prev: r.seats[0], cur: r.seats[1] })}</span>
          </header>
          <ul className="flex flex-col gap-0.5">
            {r.groups.map(g => (
              <li key={g.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 text-sm">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: g.color }} />
                <span className="truncate text-ink">{g.label}</span>
                <span className="tabular text-muted">{fmt(g.share[0])} → {fmt(g.share[1])}</span>
                <span className="tabular whitespace-nowrap text-right font-semibold text-ink">{g.won[0]} → {g.won[1]}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
