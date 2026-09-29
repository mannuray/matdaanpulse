import type { ChartSpec } from '../../viewmodels/tiles/useSummaryVM';
import { categories, ChartFrame, fmt, niceScale, useChartWidth, useSeriesLabel } from './shared';

/** One series as vertical bars with a value label above each. */
export function BarChart({ spec, title, height = 200 }: { spec: ChartSpec; title: string; height?: number }) {
  const [ref, width] = useChartWidth();
  const label = useSeriesLabel();
  const s = spec.series[0];
  const xs = categories(spec);
  const { top, ticks } = niceScale(Math.max(0, ...(s?.points.map(p => p.y) ?? [0])));
  return (
    <ChartFrame spec={{ ...spec, series: s ? [s] : [] }} title={title} height={height} width={width} ticks={{ top, values: ticks }} containerRef={ref}>
      {({ x0, x1, y, base }) => {
        const slot = (x1 - x0) / Math.max(1, xs.length);
        const bw = Math.min(48, slot * 0.6);
        return xs.map((x, i) => {
          const v = s?.points.find(p => p.x === x)?.y ?? 0;
          const cx = x0 + slot * (i + 0.5);
          return (
            <g key={String(x)} data-bar>
              <rect x={cx - bw / 2} y={y(v)} width={bw} height={Math.max(0, base - y(v))} rx={3} fill={s.color}><title>{`${String(x)}: ${v} (${label(s)})`}</title></rect>
              <text x={cx} y={y(v) - 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-ink)" className="tabular">{fmt(v)}</text>
              <text x={cx} y={base + 15} textAnchor="middle" fontSize={10} fill="var(--color-muted)">{String(x)}</text>
            </g>
          );
        });
      }}
    </ChartFrame>
  );
}
