import type { ChartSpec } from '../../viewmodels/tiles/useSummaryVM';
import { categories, ChartFrame, fmt, niceScale, useChartWidth, useSeriesLabel } from './shared';

/** One bar per series inside each x group, value label above each bar, legend below. */
export function GroupedBarChart({ spec, title, height = 200 }: { spec: ChartSpec; title: string; height?: number }) {
  const [ref, width] = useChartWidth();
  const label = useSeriesLabel();
  const xs = categories(spec);
  const { top, ticks } = niceScale(Math.max(0, ...spec.series.flatMap(s => s.points.map(p => p.y))));
  const n = Math.max(1, spec.series.length);
  return (
    <ChartFrame spec={spec} title={title} height={height} width={width} ticks={{ top, values: ticks }} containerRef={ref}>
      {({ x0, x1, y, base }) => {
        const slot = (x1 - x0) / Math.max(1, xs.length);
        const group = slot * 0.78;
        const bw = Math.min(28, group / n);
        return xs.map((x, i) => {
          const gx = x0 + slot * (i + 0.5) - (bw * n) / 2;
          return (
            <g key={String(x)}>
              {spec.series.map((s, k) => {
                const v = s.points.find(p => p.x === x)?.y ?? 0;
                return (
                  <g key={s.id} data-bar>
                    <rect x={gx + k * bw} y={y(v)} width={Math.max(1, bw - 2)} height={Math.max(0, base - y(v))} rx={2} fill={s.color}><title>{`${String(x)} · ${label(s)}: ${v}`}</title></rect>
                    <text x={gx + k * bw + (bw - 2) / 2} y={y(v) - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--color-ink)" className="tabular">{fmt(v)}</text>
                  </g>
                );
              })}
              <text x={x0 + slot * (i + 0.5)} y={base + 15} textAnchor="middle" fontSize={10} fill="var(--color-muted)">{String(x)}</text>
            </g>
          );
        });
      }}
    </ChartFrame>
  );
}
