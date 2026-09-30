import type { ChartSpec } from '../../viewmodels/tiles/useSummaryVM';
import { categories, ChartFrame, labelFormatter, niceScale, TONE_COLOR, useChartWidth, useSeriesLabel, useXLabel } from './shared';

/** Narrowest slot per x group before the drawing scrolls horizontally inside its box. */
export const MIN_GROUP_W = 52;

/** One bar per series inside each x group, value label above each bar, optional note above each group, legend below. */
export function GroupedBarChart({ spec, title, height = 200 }: { spec: ChartSpec; title: string; height?: number }) {
  const [ref, width] = useChartWidth();
  const label = useSeriesLabel();
  const xLabel = useXLabel();
  const value = labelFormatter(spec);
  const xs = categories(spec);
  const { top, ticks } = niceScale(Math.max(0, ...spec.series.flatMap(s => s.points.map(p => p.y))));
  const n = Math.max(1, spec.series.length);
  return (
    <ChartFrame spec={spec} title={title} height={height} width={width} minWidth={40 + 12 + xs.length * MIN_GROUP_W} ticks={{ top, values: ticks }} containerRef={ref}>
      {({ x0, x1, y, base, top: plotTop }) => {
        const slot = (x1 - x0) / Math.max(1, xs.length);
        const group = slot * 0.78;
        const bw = Math.min(n <= 2 ? 34 : 28, group / n);
        return xs.map((x, i) => {
          const gx = x0 + slot * (i + 0.5) - (bw * n) / 2;
          const note = spec.annotations?.find(a => a.x === x);
          const tallest = Math.max(0, ...spec.series.map(s => s.points.find(p => p.x === x)?.y ?? 0));
          return (
            <g key={String(x)}>
              {spec.series.map((s, k) => {
                const p = s.points.find(q => q.x === x);
                const v = p?.y ?? 0;
                return (
                  <g key={s.id} data-bar>
                    <rect x={gx + k * bw} y={y(v)} width={Math.max(1, bw - 2)} height={Math.max(0, base - y(v))} rx={2} fill={p?.color ?? s.color} fillOpacity={s.opacity}><title>{`${xLabel(x)} · ${label(s)}: ${value(v)}`}</title></rect>
                    <text x={gx + k * bw + (bw - 2) / 2} y={y(v) - 4} textAnchor="middle" fontSize={9} fontWeight={600} fill="var(--color-ink)" className="tabular">{value(v)}</text>
                  </g>
                );
              })}
              {note && <text data-annotation={note.tone} x={x0 + slot * (i + 0.5)} y={Math.max(plotTop - 6, y(tallest) - 16)} textAnchor="middle" fontSize={11} fontWeight={700} fill={TONE_COLOR[note.tone]} className="tabular">{note.text}</text>}
              <text x={x0 + slot * (i + 0.5)} y={base + 15} textAnchor="middle" fontSize={10} fill="var(--color-muted)">{xLabel(x)}</text>
            </g>
          );
        });
      }}
    </ChartFrame>
  );
}
