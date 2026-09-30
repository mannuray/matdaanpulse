import type { ChartSpec } from '../../viewmodels/tiles/useSummaryVM';
import { categories, ChartFrame, labelFormatter, niceScale, useChartWidth, useSeriesLabel } from './shared';

/** One polyline per series over categorical x (years); a dot per point, legend for several series. */
export function LineChart({ spec, title, height = 200 }: { spec: ChartSpec; title: string; height?: number }) {
  const [ref, width] = useChartWidth();
  const label = useSeriesLabel();
  const xs = categories(spec);
  const value = labelFormatter(spec);
  const { top, ticks } = niceScale(Math.max(0, ...spec.series.flatMap(s => s.points.map(p => p.y))));
  return (
    <ChartFrame spec={spec} title={title} height={height} width={width} ticks={{ top, values: ticks }} containerRef={ref}>
      {({ x0, x1, y, base }) => {
        const px = (x: string | number) => {
          const i = xs.indexOf(x);
          return xs.length === 1 ? (x0 + x1) / 2 : x0 + 16 + ((x1 - x0 - 32) * i) / (xs.length - 1);
        };
        return (
          <>
            {xs.map(x => <text key={String(x)} x={px(x)} y={base + 15} textAnchor="middle" fontSize={10} fill="var(--color-muted)">{String(x)}</text>)}
            {spec.series.map(s => (
              <g key={s.id} data-series={s.id}>
                <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={s.points.map(p => `${px(p.x)},${y(p.y)}`).join(' ')} />
                {s.points.map(p => (
                  <g key={String(p.x)} data-point>
                    <circle cx={px(p.x)} cy={y(p.y)} r={3.5} fill={s.color} stroke="var(--color-tile)" strokeWidth={1.5}><title>{`${String(p.x)} · ${label(s)}: ${p.y}`}</title></circle>
                    {spec.series.length === 1 && <text x={px(p.x)} y={y(p.y) - 8} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--color-ink)" className="tabular">{value(p.y)}</text>}
                  </g>
                ))}
              </g>
            ))}
          </>
        );
      }}
    </ChartFrame>
  );
}
