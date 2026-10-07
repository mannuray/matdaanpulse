import { useTranslation } from 'react-i18next';
import { formatIN } from '../ui/format';
import type { SeatDialogVM } from '../../viewmodels/tiles/useSeatDialogVM';

const W = 320, H = 80, PAD = 8;

/** The leader's margin by round (spec §4): segments in the leading party's colour, lead switches marked, the latest value labelled. */
export function MarginTrend({ points, colorOf }: { points: SeatDialogVM['trend']; colorOf(party: string | null): string }) {
  const { t } = useTranslation();
  if (points.length < 2) return null;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), yMax = Math.max(...ys, 1);
  const px = (x: number) => PAD + ((x - x0) / Math.max(x1 - x0, 1)) * (W - 2 * PAD);
  const py = (y: number) => H - PAD - (y / yMax) * (H - 2 * PAD);
  const last = points[points.length - 1];
  return (
    <figure className="mb-4 rounded-tile border border-line bg-page/40 px-3 py-2">
      <figcaption className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{t('seat_trend_title')}</figcaption>
      <svg data-margin-trend viewBox={`0 0 ${W} ${H}`} className="h-20 w-full" role="img" aria-label={t('seat_trend_title')}>
        <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} stroke="var(--color-line)" strokeDasharray="3 3" />
        {points.slice(1).map((p, i) => (
          <line key={p.x} x1={px(points[i].x)} y1={py(points[i].y)} x2={px(p.x)} y2={py(p.y)} stroke={colorOf(p.party)} strokeWidth={2} strokeLinecap="round" />
        ))}
        {points.filter(p => p.switched).map(p => (
          <g key={`s${p.x}`}>
            <circle cx={px(p.x)} cy={py(p.y)} r={3.5} fill="var(--color-map-mo-switched)" />
            <text x={px(p.x)} y={H - 1} textAnchor="middle" className="fill-[var(--color-muted)] text-[9px]">{t('seat_trend_switch', { r: p.x })}</text>
          </g>
        ))}
        <circle cx={px(last.x)} cy={py(last.y)} r={3.5} fill={colorOf(last.party)} />
      </svg>
      <div className="text-right text-xs font-semibold text-ink">{t('seat_trend_now', { m: formatIN(last.y) })}</div>
    </figure>
  );
}
