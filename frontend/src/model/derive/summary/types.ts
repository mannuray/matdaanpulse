import type { IncumbencyEntry, MarginTrendPoint, PartySwitchEntry, PartyTrendPoint } from '../../types';
import type { LayerId, PartySeats } from '../../types/dashboard';
import type { InsightContext } from '../layerInsights';

export type ValueFormat = 'int' | 'pct' | 'signed';

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
  /** Extra columns, in the order of the section's columnsKeys (after the primary value). */
  extra?: { value: number | null; format: ValueFormat }[];
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
  /** Column headers for [value, ...extra]. */
  columnsKeys?: string[];
  rows: SummaryRow[];
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
