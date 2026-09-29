import type { ManifestAlliance } from '../types';
import type { PartySeats } from '../types/dashboard';

export interface ScoreBloc {
  id: string;
  name: string;
  color: string;
  seats: number;
  votePct: number | null;
  kind: 'alliance' | 'party';
}

export interface Scoreboard {
  blocs: ScoreBloc[];
  others: { seats: number; votePct: number | null };
  totalSeats: number;
  majority: number;
  countedSeats: number;
  winnerId: string | null;
  marginOverMajority: number | null;
}

export function roundPct(n: number): number {
  return Math.round(n * 10) / 10;
}

/** The two biggest blocs (alliances, or parties when no alliances are defined) plus "others". */
export function deriveScoreboard(
  alliances: ManifestAlliance[],
  parties: PartySeats[],
  votePct: Map<string, number>,
  totalSeats: number,
  majority: number,
): Scoreboard {
  const hasPct = votePct.size > 0;
  const countedSeats = parties.reduce((s, p) => s + p.seats, 0);

  const candidates: ScoreBloc[] = alliances.length > 0
    ? alliances.map(a => {
        const members = new Set(a.parties);
        const seats = parties.filter(p => members.has(p.id)).reduce((s, p) => s + p.seats, 0);
        const pct = a.parties.reduce((s, id) => s + (votePct.get(id) ?? 0), 0);
        return { id: a.id, name: a.name, color: a.color, seats, votePct: hasPct ? roundPct(pct) : null, kind: 'alliance' as const };
      })
    : parties.map(p => ({ id: p.id, name: p.name, color: p.color, seats: p.seats, votePct: hasPct ? roundPct(votePct.get(p.id) ?? 0) : null, kind: 'party' as const }));

  const blocs = [...candidates].sort((a, b) => b.seats - a.seats).slice(0, 2);
  const blocSeats = blocs.reduce((s, b) => s + b.seats, 0);
  const blocPct = blocs.reduce((s, b) => s + (b.votePct ?? 0), 0);
  const winner = blocs[0] && blocs[0].seats >= majority ? blocs[0] : null;

  return {
    blocs,
    others: { seats: Math.max(0, countedSeats - blocSeats), votePct: hasPct ? roundPct(Math.max(0, 100 - blocPct)) : null },
    totalSeats,
    majority,
    countedSeats,
    winnerId: winner?.id ?? null,
    marginOverMajority: winner ? winner.seats - majority : null,
  };
}
