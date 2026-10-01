import { useEffect, useMemo, useState } from 'react';
import { NAV_GROUPS } from '../utils/navigation.config';
import { searchCandidatesAll, searchSeats, type CandidateHit, type SeatHit } from '../services/search.service';
import { getPartiesPaginated } from '../services/geo.service';
import { getPersons } from '../services/person.api';
import { shortElectionName } from '../components/shell/ElectionPicker';
import type { Election, Party, PersonWithStats } from '../types';

export type CommandGroup = 'Pages' | 'Seats' | 'Candidates' | 'Parties' | 'Persons';

export interface CommandItem {
  key: string;
  group: CommandGroup;
  label: string;
  hint?: string;
  /** Path without query; the palette adds `?election=`. */
  to: string;
  /** Election the record belongs to (seats, candidates). */
  electionId?: string;
}

export const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;
const LIMIT = 6;

/** Pages (always, filtered by the query) plus seats, candidates, parties and persons once the query has 2+ letters. */
export function useCommandSearch(query: string, electionId: string, elections: Election[], canSee: (roles: string[]) => boolean) {
  const q = query.trim();
  const [remote, setRemote] = useState<CommandItem[]>([]);
  const [loading, setLoading] = useState(false);

  const pages = useMemo<CommandItem[]>(() => {
    const lower = q.toLowerCase();
    return NAV_GROUPS.flatMap((g) => g.items)
      .filter((i) => canSee(i.roles) && (!lower || i.label.toLowerCase().includes(lower)))
      .map((i): CommandItem => ({ key: `page:${i.path}`, group: 'Pages', label: i.label, to: i.path }));
  }, [q, canSee]);

  useEffect(() => {
    if (q.length < MIN_QUERY) { setRemote([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const electionName = (eid: string) => {
        const e = elections.find((x) => x.id === eid);
        return e ? shortElectionName(e.name, e.type, e.year) : 'Other election';
      };
      const [seats, cands, candsHere, parties, persons] = await Promise.all([
        electionId ? searchSeats(q, electionId).catch((): SeatHit[] => []) : Promise.resolve<SeatHit[]>([]),
        searchCandidatesAll(q).catch((): CandidateHit[] => []),
        // The all-elections query caps at 50 rows, so ask for the selected election on its own too.
        electionId ? searchCandidatesAll(q, electionId).catch((): CandidateHit[] => []) : Promise.resolve<CandidateHit[]>([]),
        getPartiesPaginated(1, LIMIT, q).then((r): Party[] => r.data).catch((): Party[] => []),
        getPersons(1, LIMIT, q).then((r): PersonWithStats[] => r.data).catch((): PersonWithStats[] => []),
      ]);
      if (cancelled) return;
      // The selected election's candidates first (de-duplicated by id), then the rest.
      const seen = new Set<string>();
      const merged = [...candsHere, ...cands].filter((c) => !seen.has(c.id) && seen.add(c.id));
      const rank = (c: CandidateHit) => (c.election_id === electionId ? 0 : 1);
      setRemote([
        ...seats.slice(0, LIMIT).map((s): CommandItem => ({
          key: `seat:${s.id}`, group: 'Seats', label: `${s.const_no} ${s.name}`, hint: s.type,
          to: `/constituencies/${encodeURIComponent(s.id)}`, electionId: s.election_id,
        })),
        ...merged.filter((c) => c.party_id !== 'NOTA' && c.name !== 'NOTA').sort((a, b) => rank(a) - rank(b)).slice(0, LIMIT)
          .map((c): CommandItem => ({
            key: `cand:${c.id}`, group: 'Candidates', label: c.name, hint: `${c.party_id ?? 'IND'} · ${electionName(c.election_id)}`,
            to: `/candidates/${encodeURIComponent(c.id)}`, electionId: c.election_id,
          })),
        ...parties.map((p): CommandItem => ({ key: `party:${p.id}`, group: 'Parties', label: p.name, hint: p.id, to: `/parties/${encodeURIComponent(p.id)}` })),
        ...persons.map((p): CommandItem => ({ key: `person:${p.id}`, group: 'Persons', label: p.name, hint: `${p.candidate_count} contests`, to: `/persons/${encodeURIComponent(p.id)}` })),
      ]);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q, electionId, elections]);

  // A record is only offered when its target page is one the role can open.
  const items = useMemo(() => {
    const allowed = (to: string) => {
      const base = '/' + to.split('/')[1];
      const nav = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.path === base);
      return !nav || canSee(nav.roles);
    };
    return [...pages, ...remote.filter((r) => allowed(r.to))];
  }, [pages, remote, canSee]);

  return { items, loading };
}
