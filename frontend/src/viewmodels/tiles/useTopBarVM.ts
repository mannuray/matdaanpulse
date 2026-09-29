import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApi } from '../data/useApi';
import { useElection } from '../data/useElection';
import { getElections } from '../../model/api/election.service';
import { getStates } from '../../model/api/geo.service';
import type { Election } from '../../model/types';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { countDeclared } from '../../model/derive/marginStats';

const LANGS = ['en', 'hi', 'ta', 'mr'];

function remember(type: 'LS' | 'VS', id: string | null) {
  try { if (id) localStorage.setItem(`lastElection_${type}`, id); else localStorage.removeItem(`lastElection_${type}`); } catch { /* best effort */ }
}
function recall(type: 'LS' | 'VS', elections: Election[]): Election | null {
  let id: string | null = null;
  try { id = localStorage.getItem(`lastElection_${type}`); } catch { id = null; }
  return elections.find(e => e.id === id && e.type === type) ?? null;
}

export interface TopBarVM {
  electionType: 'LS' | 'VS';
  electionId: string;
  states: { id: number; name: string }[];
  stateId: number | null;
  years: { id: string; year: number }[];
  lsElections: { id: string; name: string }[];
  statusLabel: { kind: 'final' | 'live' | 'upcoming'; declared: number; total: number };
  shareText: string;
  lang: string;
  langs: string[];
  onType(t: 'LS' | 'VS'): void;
  onState(id: number): void;
  onElection(id: string): void;
  onLang(l: string): void;
  onSearchSeat(id: string): void;
}

export function useTopBarVM(): TopBarVM {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const src = useSources();
  const { dispatch } = useDashboardStore();
  const { setElection, setElectionType, setSelectedStateId } = useElection();
  const { data: elections } = useApi(() => getElections(), []);
  const { data: states } = useApi(() => getStates(), []);
  const all = useMemo(() => elections ?? [], [elections]);
  const current = src.election;

  const go = useCallback((el: Election | null, type: 'LS' | 'VS') => {
    setElection(el);
    setElectionType(type);
    remember(type, el?.id ?? null);
    if (el?.state_id) setSelectedStateId(el.state_id);
    navigate(el ? `/election/${el.id}` : '/');
  }, [navigate, setElection, setElectionType, setSelectedStateId]);

  const vsStates = useMemo(() => {
    const ids = new Set(all.filter(e => e.type === 'VS' && e.state_id != null).map(e => e.state_id!));
    return (states ?? []).filter(s => ids.has(s.id)).map(s => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [all, states]);

  const years = useMemo(() => all.filter(e => e.type === 'VS' && e.state_id === current.state_id).sort((a, b) => b.year - a.year).map(e => ({ id: e.id, year: e.year })), [all, current.state_id]);
  const lsElections = useMemo(() => all.filter(e => e.type === 'LS').sort((a, b) => b.year - a.year).map(e => ({ id: e.id, name: e.name })), [all]);

  return {
    electionType: current.type,
    electionId: current.id,
    states: vsStates,
    stateId: current.state_id,
    years,
    lsElections,
    statusLabel: {
      kind: current.status === 'Live' ? 'live' : current.status === 'Finalized' ? 'final' : 'upcoming',
      declared: countDeclared(src.data.mapRegions),
      total: src.totalSeats,
    },
    shareText: `${current.name} - Election Tracker`,
    lang: i18n.language,
    langs: LANGS,
    onType: t => { if (t !== current.type) go(recall(t, all) ?? all.find(e => e.type === t) ?? null, t); },
    onState: id => go(all.filter(e => e.type === 'VS' && e.state_id === id).sort((a, b) => b.year - a.year)[0] ?? null, 'VS'),
    onElection: id => { const el = all.find(e => e.id === id) ?? null; go(el, el?.type ?? current.type); },
    onLang: l => { void i18n.changeLanguage(l); },
    onSearchSeat: id => dispatch({ type: 'selectSeat', seat: id }),
  };
}
