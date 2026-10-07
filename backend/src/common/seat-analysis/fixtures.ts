import type { AnalysisInput, CandidateIn, ElectionIn, SeatIn } from './types';

/** [name, party, votes, status?, person_id?]: the most-voted real candidate is WON unless a status is given. */
export type C = [string, string | null, number, string?, string?];
export function seat(no: number, cands: C[], extra: Partial<SeatIn> = {}): SeatIn {
  const top = Math.max(...cands.filter(c => c[1] !== 'NOTA').map(c => c[2]));
  const candidates: CandidateIn[] = cands.map(([name, party_id, votes, status, person_id]) => ({
    name, party_id, votes, person_id: person_id ?? null,
    status: status ?? (party_id !== 'NOTA' && votes === top ? 'WON' : 'LOST'),
  }));
  return { const_id: `T_${no}`, const_no: no, reserved: 'GEN', region_id: null, turnout: null, candidates, ...extra };
}
export const el = (year: number, seats: SeatIn[], extra: Partial<ElectionIn> = {}): ElectionIn =>
  ({ id: `E${year}`, year, date: `${year}-07-01`, seats, alliances: [], government: null, ...extra });
export const input = (current: ElectionIn, history: ElectionIn[] = [], extra: Partial<AnalysisInput> = {}): AnalysisInput =>
  ({ stateId: 1, current, voteSplits: [], heavyweights: [], history, previousAny: history[history.length - 1] ?? null, lineage: [], ...extra });

export const JVM_MERGER = { party_id: 'BJP', predecessor_id: 'JVM', kind: 'merger', effective_date: '2020-02-17', state_id: null, is_successor: true };
export const SHS_SPLIT = { party_id: 'SHSUBT', predecessor_id: 'SHS', kind: 'split', effective_date: '2022-10-10', state_id: null, is_successor: false };
