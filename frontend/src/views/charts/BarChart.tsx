import type { ChartSpec } from '../../viewmodels/tiles/useSummaryVM';
import { categories, ChartFrame, labelFormatter, niceScale, TONE_COLOR, useChartWidth, useSeriesLabel, useXLabel, clip } from './shared';

/** One series as vertical bars with a value label above each (a point may carry its own colour, a group its own note). */
export function BarChart({ spec, title, height = 200 }: { spec: ChartSpec; title: string; height?: number }) {
  const [ref, width] = useChartWidth();
  const label = useSeriesLabel();
  const xLabel = useXLabel(spec);
  const value = labelFormatter(spec);
  const s = spec.series[0];
  const xs = categories(spec);
  const { top, ticks } = niceScale(Math.max(0, ...(s?.points.map(p => p.y) ?? [0])));
  return (
    <ChartFrame spec={{ ...spec, series: s ? [s] : [] }} title={title} height={height} width={width} ticks={{ top, values: ticks }} containerRef={ref}>
      {({ x0, x1, y, base, top: plotTop }) => {
        const slot = (x1 - x0) / Math.max(1, xs.length);
        const bw = Math.min(48, slot * 0.6);
        return xs.map((x, i) => {
          const p = s?.points.find(q => q.x === x);
          const v = p?.y ?? 0;
          const cx = x0 + slot * (i + 0.5);
          const note = spec.annotations?.find(a => a.x === x);
          return (
            <g key={String(x)} data-bar>
              <rect x={cx - bw / 2} y={y(v)} width={bw} height={Math.max(0, base - y(v))} rx={3} fill={p?.color ?? s.color} fillOpacity={s.opacity}><title>{`${xLabel.full(x)}: ${value(v)} (${label(s)})`}</title></rect>
              <text x={cx} y={y(v) - 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-ink)" className="tabular">{value(v)}</text>
              {note && <text data-annotation={note.tone} x={cx} y={Math.max(plotTop - 6, y(v) - 18)} textAnchor="middle" fontSize={11} fontWeight={700} fill={TONE_COLOR[note.tone]} className="tabular">{note.text}</text>}
              <text x={cx} y={base + 15} textAnchor="middle" fontSize={10} fill="var(--color-muted)"><title>{xLabel.full(x)}</title>{clip(xLabel.short(x), slot - 4)}</text>
            </g>
          );
        });
      }}
    </ChartFrame>
  );
}
