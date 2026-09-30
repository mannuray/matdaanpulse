import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatSummaryValue, type ChartSeries, type ChartSpec } from '../../viewmodels/tiles/useSummaryVM';
import { useElementWidth } from '../hooks/useElementWidth';
import { cn } from '../ui/cn';

export const M = { top: 18, right: 12, bottom: 26, left: 40 };
/** Width used before the first measurement (and in jsdom, which has no layout). */
export const FALLBACK_WIDTH = 480;

/** Value label above a bar: the spec's format (percent bars drop the % sign to stay narrow; the axis carries it). */
export function labelFormatter(spec: ChartSpec): (v: number) => string {
  const f = spec.valueFormat ?? 'compact';
  return f === 'pct' ? v => v.toFixed(1) : v => formatSummaryValue(v, f);
}

/** Data-table cell text: the drawing's format with its unit (48.1%, 30.4K). */
export function cellFormatter(spec: ChartSpec): (v: number) => string {
  const f = spec.valueFormat ?? 'compact';
  return v => formatSummaryValue(v, f);
}

/** y axis tick text. */
export function axisFormatter(spec: ChartSpec): (v: number) => string {
  const f = spec.valueFormat ?? 'compact';
  return f === 'pct' ? v => `${v}%` : v => formatSummaryValue(v, f);
}

export const TONE_COLOR = { up: 'var(--color-ok-text)', down: 'var(--color-live-text)', neutral: 'var(--color-muted)' } as const;

type XPoint = ChartSeries['points'][number];

/** The first point drawn at `x` (carries the optional labelKey / full name). */
export function pointAt(spec: ChartSpec, x: string | number): XPoint | undefined {
  for (const s of spec.series) { const p = s.points.find(q => q.x === x); if (p) return p; }
  return undefined;
}

/** x category texts: `short` for the axis (a translated labelKey, else x), `full` for tooltips and the data table. */
export function useXLabel(spec: ChartSpec) {
  const { t } = useTranslation();
  const short = (x: string | number) => { const p = pointAt(spec, x); return p?.labelKey ? t(p.labelKey) : String(x); };
  return { short, full: (x: string | number) => pointAt(spec, x)?.label ?? short(x) };
}

/** Axis label clipped with an ellipsis to roughly `width` px at 10px text. */
export function clip(text: string, width: number): string {
  const max = Math.max(3, Math.floor(width / 5.6));
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** Extra headroom above the plot for the annotation line. */
export const ANNOTATION_H = 14;

/** The series name: the translated key when the model provides one. */
export function useSeriesLabel() {
  const { t } = useTranslation();
  return (s: ChartSeries) => (s.labelKey ? t(s.labelKey) : s.label ?? s.id);
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
  const xLabel = useXLabel(spec);
  const cell = cellFormatter(spec);
  const xs = categories(spec);
  const notes = spec.annotations ?? [];
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <thead><tr><th scope="col">{t('studio_chart_category')}</th>{spec.series.map(s => <th key={s.id} scope="col">{label(s)}</th>)}{notes.length > 0 && <th scope="col">{t('studio_chart_note')}</th>}</tr></thead>
      <tbody>
        {xs.map(x => (
          <tr key={String(x)}><th scope="row">{xLabel.full(x)}</th>{spec.series.map(s => { const y = s.points.find(p => p.x === x)?.y; return <td key={s.id}>{y == null ? '' : cell(y)}</td>; })}{notes.length > 0 && <td>{notes.find(a => a.x === x)?.text ?? ''}</td>}</tr>
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
      {series.map(s => <li key={s.id} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color, opacity: s.opacity }} />{label(s)}</li>)}
    </ul>
  );
}

/** Shared frame: measured wrapper, SVG with role img, gridlines and y axis, then the children (marks), legend, hidden table. A `minWidth` wider than the box makes the drawing scroll horizontally inside it. */
export function ChartFrame({ spec, title, height, ticks, children, width, minWidth = 0, containerRef }: {
  spec: ChartSpec; title: string; height: number; width: number; ticks: { top: number; values: number[] }; minWidth?: number;
  containerRef: (el: HTMLDivElement | null) => void; children: (plot: { x0: number; x1: number; y: (v: number) => number; base: number; top: number }) => ReactNode;
}) {
  const axis = axisFormatter(spec);
  const w = Math.max(width, minWidth);
  const top = M.top + (spec.annotations?.length ? ANNOTATION_H : 0);
  const x0 = M.left;
  const x1 = Math.max(x0 + 10, w - M.right);
  const base = height - M.bottom;
  const y = (v: number) => base - (v / ticks.top) * (base - top);
  return (
    <div ref={containerRef} className="w-full min-w-0">
      <div className={cn(w > width && 'studio-scroll overflow-x-auto overscroll-x-contain')} data-chart-scroll={w > width ? '' : undefined}
        {...(w > width ? { role: 'region', tabIndex: 0, 'aria-label': title } : {})}>
        <svg role="img" aria-label={title} width={w} height={height} viewBox={`0 0 ${w} ${height}`} className={cn('block', w <= width && 'max-w-full')}>
          <g aria-hidden="true">
            {ticks.values.map(v => (
              <g key={v}>
                <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={1} />
                <text x={x0 - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="var(--color-muted)" className="tabular">{axis(v)}</text>
              </g>
            ))}
            {children({ x0, x1, y, base, top })}
          </g>
        </svg>
      </div>
      <Legend series={spec.series} />
      <DataTable title={title} spec={spec} />
    </div>
  );
}
