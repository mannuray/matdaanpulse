import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatSummaryValue, type ChartSeries, type ChartSpec } from '../../viewmodels/tiles/useSummaryVM';
import { useElementWidth } from '../hooks/useElementWidth';

export const M = { top: 18, right: 12, bottom: 26, left: 40 };
/** Width used before the first measurement (and in jsdom, which has no layout). */
export const FALLBACK_WIDTH = 480;

export const fmt = (v: number) => formatSummaryValue(v, 'compact');

/** The series name: the translated key when the model provides one. */
export function useSeriesLabel() {
  const { t } = useTranslation();
  return (s: ChartSeries) => (s.labelKey ? t(s.labelKey) : s.label);
}

/** x categories in first-seen order across all series. */
export function categories(spec: ChartSpec): (string | number)[] {
  const seen: (string | number)[] = [];
  spec.series.forEach(s => s.points.forEach(p => { if (!seen.includes(p.x)) seen.push(p.x); }));
  return seen;
}

/** A "nice" axis maximum and step for `max` with about `n` ticks. */
export function niceScale(max: number, n = 4): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const raw = max / n;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw)) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { top, ticks };
}

export function useChartWidth() {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  return [ref, width > 0 ? width : FALLBACK_WIDTH] as const;
}

/** Visually hidden data table: the accessible twin of the drawing. */
export function DataTable({ title, spec }: { title: string; spec: ChartSpec }) {
  const { t } = useTranslation();
  const label = useSeriesLabel();
  const xs = categories(spec);
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <thead><tr><th scope="col">{t('studio_chart_category')}</th>{spec.series.map(s => <th key={s.id} scope="col">{label(s)}</th>)}</tr></thead>
      <tbody>
        {xs.map(x => (
          <tr key={String(x)}><th scope="row">{String(x)}</th>{spec.series.map(s => <td key={s.id}>{s.points.find(p => p.x === x)?.y ?? ''}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export function Legend({ series }: { series: ChartSeries[] }) {
  const label = useSeriesLabel();
  if (series.length < 2) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted" data-chart-legend>
      {series.map(s => <li key={s.id} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{label(s)}</li>)}
    </ul>
  );
}

/** Shared frame: measured wrapper, SVG with role img, gridlines and y axis, then the children (marks), legend, hidden table. */
export function ChartFrame({ spec, title, height, ticks, children, width, containerRef }: {
  spec: ChartSpec; title: string; height: number; width: number; ticks: { top: number; values: number[] };
  containerRef: (el: HTMLDivElement | null) => void; children: (plot: { x0: number; x1: number; y: (v: number) => number; base: number }) => ReactNode;
}) {
  const x0 = M.left;
  const x1 = Math.max(x0 + 10, width - M.right);
  const base = height - M.bottom;
  const y = (v: number) => base - (v / ticks.top) * (base - M.top);
  return (
    <div ref={containerRef} className="w-full min-w-0">
      <svg role="img" aria-label={title} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block max-w-full">
        <g aria-hidden="true">
          {ticks.values.map(v => (
            <g key={v}>
              <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={1} />
              <text x={x0 - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--color-muted)" className="tabular">{fmt(v)}</text>
            </g>
          ))}
          {children({ x0, x1, y, base })}
        </g>
      </svg>
      <Legend series={spec.series} />
      <DataTable title={title} spec={spec} />
    </div>
  );
}
