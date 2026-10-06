import type { CandidateJson, ElectionJson, PartyEntry, PartyMap, RawElection, SeatJson } from './types';
import type { YearConfig } from './years';
import type { ElectionConfig } from './elections';
import { displayName } from './names';
import { resolveParty } from './party-map';

export function normalize(raw: RawElection, cfg: YearConfig | ElectionConfig, map: PartyMap, retrieved: string): { json: ElectionJson; errors: string[] } {
  const errors = new Set<string>();
  const parties = new Map<string, PartyEntry>();
  const summaries = new Map(raw.summaries.map(s => [s.constNo, s]));
  const dates = [...new Set(raw.summaries.map(s => s.pollDate).filter(Boolean))].sort();
  // A seat won unopposed may carry no poll date (Arunachal 2024): it takes the election's most common poll date.
  const counts = new Map<string, number>();
  for (const s of raw.summaries) if (s.pollDate) counts.set(s.pollDate, (counts.get(s.pollDate) ?? 0) + 1);
  const usualDate = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const seats: SeatJson[] = [];
  for (const seat of [...raw.seats].sort((a, b) => a.constNo - b.constNo)) {
    const m = summaries.get(seat.constNo);
    if (!m) { errors.add(`summary: seat ${seat.constNo} missing`); continue; }
    const table = 'seatTypes' in cfg ? cfg.seatTypes : undefined;
    const fixed = table ? table[seat.constNo] ?? 'GEN' : null;
    if (fixed && m.type && m.type !== fixed) errors.add(`seat ${seat.constNo}: the file says ${m.type}, the seat-type table says ${fixed}`);
    const top = Math.max(...seat.candidates.map(c => c.total));
    const candidates: CandidateJson[] = seat.candidates.map(c => {
      const p = resolveParty(c.party, raw.parties, map);
      if ('unknown' in p) { errors.add(`party: ${p.unknown}`); return null; }
      if (p.id !== 'NOTA') parties.set(p.id, p);
      const name = 'stripHonorifics' in cfg && cfg.stripHonorifics ? c.name.replace(/^\s*(shri|smt|sri)\.?\s+/i, '') : c.name;
      return { serial: c.serial, name: displayName(name), partyId: p.id, sex: c.sex, age: c.age, votes: c.total, status: c.total === top ? 'WON' : 'LOST' };
    }).filter((c): c is CandidateJson => c !== null);
    if (seat.nota !== null && !m.uncontested) candidates.push({ serial: Math.max(0, ...seat.candidates.map(c => c.serial)) + 1, name: 'NOTA', partyId: 'NOTA', sex: null, age: null, votes: seat.nota, status: 'LOST' });
    seats.push({ constNo: seat.constNo, ...('newElection' in cfg && cfg.newElection ? { name: displayName(seat.acName) } : {}), type: fixed ?? m.type, electors: m.electors,
      voters: m.uncontested ? null : m.voters, turnout: m.uncontested ? null : Math.round((m.voters / m.electors) * 10000) / 100,
      phase: dates.indexOf(m.pollDate || usualDate) + 1, pollDate: m.pollDate || usualDate, candidates, ...(m.uncontested ? { uncontested: true as const } : {}) });
  }
  return {
    json: { year: raw.year, electionId: cfg.electionId, source: { ...cfg.source, retrieved }, parties: [...parties.values()].sort((a, b) => a.id.localeCompare(b.id)), seats },
    errors: [...errors],
  };
}
