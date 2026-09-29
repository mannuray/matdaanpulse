import { useGlobalSearch } from '../data/useGlobalSearch';

export interface SearchVM {
  query: string;
  open: boolean;
  seats: { id: string; name: string; meta: string }[];
  candidates: { id: string; seatId: string; name: string; meta: string }[];
  onQuery(q: string): void;
  onOpen(o: boolean): void;
  onPick(seatId: string): void;
}

export function useSearchVM(electionId: string, onSeat: (id: string) => void): SearchVM {
  const s = useGlobalSearch(electionId);
  return {
    query: s.query,
    open: s.open && s.hasResults,
    seats: s.constituencies.slice(0, 8).map(c => ({ id: c.id, name: c.name, meta: `#${c.const_no} ${c.district?.name ?? ''}`.trim() })),
    candidates: s.candidates.slice(0, 8).map(c => ({ id: c.id, seatId: c.const_id, name: c.name, meta: c.party?.name ?? '' })),
    onQuery: s.handleQueryChange,
    onOpen: s.setOpen,
    onPick: seatId => { onSeat(seatId); s.reset(); },
  };
}
