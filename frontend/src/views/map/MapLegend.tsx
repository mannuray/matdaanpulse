import { useTranslation } from 'react-i18next';
import type { LegendItem } from '../../viewmodels/tiles/useMapVM';

/** Overview swatches show the call's strength (as on the map); Battle swatches show the momentum colour. */
const STRENGTH: Record<string, number> = { safe: 1, likely: 0.6, too_close: 0.3, not_started: 1 };

/** The live map legend (spec §3): Safe · Likely · Too close · Not started, or the Battle momentum colours, with counts. */
export function MapLegend({ items }: { items: LegendItem[] }) {
  const { t } = useTranslation();
  const calls = items.some(i => i.key === 'too_close');
  return (
    <ul
      className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-line bg-tile/90 px-3 py-1 text-[11px] text-ink-2"
      title={calls ? t('map_legend_rule') : undefined}
    >
      {items.map(i => (
        <li key={i.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: i.color, opacity: calls ? STRENGTH[i.key] ?? 1 : 1, outline: i.dashed ? `1px dashed ${i.color}` : undefined, outlineOffset: 1 }}
          />
          <span>{t(i.labelKey)}</span>
          <span className="tabular font-semibold text-ink">{i.count}</span>
        </li>
      ))}
    </ul>
  );
}
