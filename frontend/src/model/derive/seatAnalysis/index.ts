import { seatNotes } from './notes';
import { analyseElection } from './election';
import { rank, type Ranked } from './rank';
import { analyseSeat, type Ctx } from './seat';
import type { AnalysisInput, ElectionAnalysis, ElectionIn, SeatAnalysis } from './types';

export * from './types';
export { normName, samePerson, findPerson } from './match';

/** The whole analysis of one election (spec §§3–4). Pure; throws when `history` is not oldest → newest. */
export function analyse(input: AnalysisInput): { seats: SeatAnalysis[]; election: ElectionAnalysis } {
  const years = [...input.history.map(e => e.year), input.current.year];
  for (let i = 1; i < years.length; i++) {
    if (years[i] <= years[i - 1]) throw new Error(`seat analysis: history must be oldest → newest and before ${input.current.year} (got ${years.join(', ')})`);
  }
  const idx = new Map<string, Map<number, Ranked>>();
  const add = (e: ElectionIn | null) => { if (e && !idx.has(e.id)) idx.set(e.id, new Map(e.seats.map(s => [s.const_no, rank(s)]))); };
  [...input.history, input.previousAny, input.current].forEach(add);
  const ctx: Ctx = { input, idx };
  const seats = input.current.seats.map(s => {
    const a = analyseSeat(ctx, s);
    a.notes = seatNotes(ctx, s, a);
    return a;
  });
  const election = analyseElection(ctx, seats);
  const bell = new Set(election.bellwethers);
  for (const a of seats) if (bell.has(a.const_id)) a.notes.push({ kind: 'bellwether', elections: a.history.length });
  return { seats, election };
}
