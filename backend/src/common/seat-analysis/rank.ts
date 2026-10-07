import { NOTA, type CandidateIn, type SeatIn } from './types';

export const r1 = (x: number) => Math.round(x * 10) / 10;
export const share = (votes: number, total: number): number | null => (total > 0 ? r1((votes / total) * 100) : null);

export interface Ranked {
  seat: SeatIn;
  /** Real candidates (no NOTA), most votes first. */
  ranked: CandidateIn[];
  /** Every vote polled, NOTA included. */
  total: number;
  nota: number;
  winner: CandidateIn | null;
  runnerUp: CandidateIn | null;
  /** null without a winner or a runner-up (unopposed). */
  margin: number | null;
}

export function rank(seat: SeatIn): Ranked {
  const total = seat.candidates.reduce((s, c) => s + c.votes, 0);
  const nota = seat.candidates.filter(c => c.party_id === NOTA).reduce((s, c) => s + c.votes, 0);
  const ranked = seat.candidates.filter(c => c.party_id !== NOTA).sort((a, b) => b.votes - a.votes);
  const winner = ranked.find(c => c.status === 'WON' || c.status === 'LEADING') ?? null;
  const runnerUp = winner ? ranked.find(c => c !== winner) ?? null : null;
  const margin = winner && runnerUp ? winner.votes - runnerUp.votes : null;
  return { seat, ranked, total, nota, winner, runnerUp, margin };
}
