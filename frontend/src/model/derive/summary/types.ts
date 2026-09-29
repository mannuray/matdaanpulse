import type { IncumbencyEntry, MarginTrendPoint, PartySwitchEntry, PartyTrendPoint } from '../../types';
import type { LayerId, PartySeats } from '../../types/dashboard';
import type { InsightContext } from '../layerInsights';

/**
 * int: 1,234 · pct: 12.3% · pct0: 12% · signed: +5 / −5 · signed1: +35.0 / −23.1 · compact: 950, 21.1K, 1.2L (margins)
 * lakh: 147.7L (vote totals) · intDash: int but 0 / null render "–" · pp: +67.7 pp · result: Won / Lost (1 / 0)
 * text: `text` verbatim.
 */
export type ValueFormat = 'int' | 'pct' | 'pct0' | 'signed' | 'signed1' | 'compact' | 'lakh' | 'intDash' | 'pp' | 'result' | 'text';

export interface SummaryCell { value: number | null; format: ValueFormat; text?: string }

export interface SummaryRow {
  id: string;
  /** Proper nouns / ids (party ids, seat names). */
  label: string;
  /** Set when the label is translatable (the view renders t(labelKey)). */
  labelKey?: string;
  /** Secondary text, e.g. "RJD → JDU". */
  sub?: string;
  /** Primary number (null renders "—"). */
  value: number | null;
  valueFormat: ValueFormat;
  /** Text shown when valueFormat is 'text'. */
  valueText?: string;
  /** Extra columns, in the order of the section's columnsKeys (after the primary value). */
  extra?: SummaryCell[];
  bar?: { value: number; max: number; color: string };
  /** Party / alliance dot. */
  color?: string;
  /** For highlight / select. */
  seatIds?: string[];
  partyIds?: string[];
}

export interface ChartSeries {
  id: string;
  label: string;
  /** Translatable series name; the view prefers t(labelKey) over label when set. */
  labelKey?: string;
  color: string;
  points: { x: string | number; y: number }[];
}

export interface ChartSpec {
  type: 'bar' | 'groupedBar' | 'line';
  series: ChartSeries[];
  xKey?: string;
  yKey?: string;
}

export interface SummarySection {
  id: string;
  titleKey: string;
  titleParams?: Record<string, string | number>;
  /** Column headers for [value, ...extra] (a header that is not an i18n key, e.g. a year, is shown as is). */
  columnsKeys?: string[];
  /** Which of [value, ...extra] the compact card shows (default 0). */
  primaryCol?: number;
  /** 'stats': the rows render as big numbers side by side (all-or-nothing in the compact card). No title when titleKey is ''. */
  layout?: 'stats';
  rows: SummaryRow[];
  /** Rows the model dropped beyond its own cap (e.g. "+ 3 more seats"); added to the compact footer's row count. */
  more?: number;
  chart?: ChartSpec;
}

export interface LayerSummary {
  layer: LayerId;
  sections: SummarySection[];
}

export interface SummaryContext extends InsightContext {
  votePct: Map<string, number>;
  parties: PartySeats[];
  marginTrend: MarginTrendPoint[];
  partyTrend: PartyTrendPoint[];
  partySwitches: PartySwitchEntry[];
  incumbency: IncumbencyEntry[];
}
