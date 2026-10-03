import type { CandidateJson, ElectionJson, PartyEntry, PartyMap, RawElection, SeatJson } from './types';
import type { YearConfig } from './years';
import type { ElectionConfig } from './elections';
import { displayName } from './names';
import { resolveParty } from './party-map';

export function normalize(raw: RawElection, cfg: YearConfig | ElectionConfig, map: PartyMap, retrieved: string): { json: ElectionJson; errors: string[] } {
  const errors = new Set<string>();
  const parties = new Map<string, PartyEntry>();
  const summaries = new Map(raw.summaries.map(s => [s.constNo, s]));
  const dates = [...new Set(raw.summaries.map(s => s.pollDate))].sort();
  const seats: SeatJson[] = [];
  for (const seat of [...raw.seats].sort((a, b) => a.constNo - b.constNo)) {
    const m = summaries.get(seat.constNo);
    if (!m) { errors.add(`summary: seat ${seat.constNo} missing`); continue; }
    const top = Math.max(...seat.candidates.map(c => c.total));
    const candidates: CandidateJson[] = seat.candidates.map(c => {
      const p = resolveParty(c.party, raw.parties, map);
      if ('unknown' in p) { errors.add(`party: ${p.unknown}`); return null; }
      if (p.id !== 'NOTA') parties.set(p.id, p);
      return { serial: c.serial, name: displayName(c.name), partyId: p.id, sex: c.sex, age: c.age, votes: c.total, status: c.total === top ? 'WON' : 'LOST' };
    }).filter((c): c is CandidateJson => c !== null);
    if (seat.nota !== null) candidates.push({ serial: Math.max(0, ...seat.candidates.map(c => c.serial)) + 1, name: 'NOTA', partyId: 'NOTA', sex: null, age: null, votes: seat.nota, status: 'LOST' });
    seats.push({ constNo: seat.constNo, ...('newElection' in cfg && cfg.newElection ? { name: displayName(seat.acName) } : {}), type: m.type, electors: m.electors, voters: m.voters, turnout: Math.round((m.voters / m.electors) * 10000) / 100,
      phase: dates.indexOf(m.pollDate) + 1, pollDate: m.pollDate, candidates });
  }
  return {
    json: { year: raw.year, electionId: cfg.electionId, source: { ...cfg.source, retrieved }, parties: [...parties.values()].sort((a, b) => a.id.localeCompare(b.id)), seats },
    errors: [...errors],
  };
}
