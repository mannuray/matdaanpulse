import type { Momentum, SeatBaseline, SeatLive, SeatTrail, Upset } from './seatAnalysis';

export interface SeatRound { seq: number; r: number | null; rt: number | null; lp: string | null; m: number | null; v: number; declared: boolean; at: string }

/** Margin-by-round chart points: the leader's margin, its party (segment colour), and where the lead switched. */
export function trendPoints(rounds: SeatRound[]) {
  return rounds.filter(r => r.m != null).map((r, i, a) => ({ x: r.r ?? i + 1, y: r.m!, party: r.lp, switched: i > 0 && a[i - 1].lp !== r.lp }));
}

/** "Lead narrowed from X to Y over the last N rounds" from the trail's last 3 points (only while narrowing / widening). */
export function narrowedLine(trail: SeatTrail | null, momentum: Momentum | null): { kind: 'narrowed' | 'widened'; from: number; to: number; rounds: number } | null {
  if (!trail || (momentum !== 'narrowing' && momentum !== 'widening')) return null;
  const pts = trail.points.slice(-3).filter(p => p.m != null);
  if (pts.length < 2) return null;
  return { kind: momentum === 'narrowing' ? 'narrowed' : 'widened', from: pts[0].m!, to: pts[pts.length - 1].m!, rounds: pts.length };
}

/** One badge per upset, with the names behind it (spec §4). */
export function upsetBadges(live: SeatLive, base: SeatBaseline | null): { kind: Upset; name?: string; party?: string | null; margin?: number | null; since?: number }[] {
  return live.upsets.map(kind => {
    if (kind === 'sitting_trailing') return { kind, name: base?.sitting?.name, party: base?.sitting?.party ?? null, margin: live.margin };
    if (kind === 'stronghold_trailing') return { kind, party: base?.class_before?.holder ?? null, since: base?.class_before?.since };
    const h = base?.heavyweights[0];
    return { kind, name: h?.name, party: h?.party ?? null };
  });
}
