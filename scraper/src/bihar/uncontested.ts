/**
 * Seats won unopposed, completed from the other table of the same report:
 * - Detailed Results leave the seat out (Arunachal 2024): the seat is built from its summary — the winner as the only
 *   candidate with 0 votes, `fromSummary` so the party performance check skips it (that table leaves it out too);
 * - the summary is all zeros (Arunachal 2019: no electors, no winner): electors and winner come from Detailed Results.
 */
import { normName } from './names';
import type { RawElection, RawSeat } from './types';

export function completeUncontested(raw: RawElection): RawElection {
  if (!raw.summaries.some(s => s.uncontested)) return raw;
  const seats = [...raw.seats];
  const summaries = raw.summaries.map(s => {
    if (!s.uncontested) return s;
    const seat = seats.find(x => x.constNo === s.constNo);
    if (!seat) {
      // The summary names the party in full; Detailed Results use the abbreviation (from the year's party list).
      const party = raw.parties.find(p => normName(p.name) === normName(s.winner.party))?.abbr ?? s.winner.party;
      const built: RawSeat = { constNo: s.constNo, acName: s.name, type: s.type, electors: s.electors, nota: s.nota, totalVotes: 0, fromSummary: true,
        candidates: [{ serial: 1, name: s.winner.name, sex: null, age: null, party, general: 0, postal: 0, total: 0 }] };
      seats.push(built);
      return s;
    }
    const only = seat.candidates.length === 1 ? seat.candidates[0] : null;
    return { ...s, electors: s.electors || seat.electors, winner: s.winner.name || !only ? s.winner : { party: only.party, name: only.name, votes: 0 } };
  });
  return { ...raw, seats: seats.sort((a, b) => a.constNo - b.constNo), summaries };
}
