import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApi } from '../data/useApi';
import { useElection } from '../data/useElection';
import { getElections } from '../../model/api/election.service';
import { getStates } from '../../model/api/geo.service';
import type { Election } from '../../model/types';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useTheme, type Theme } from '../theme/useTheme';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { pickLatestElection } from '../../model/derive/electionPick';
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
  /** Type, state and year in one short string, e.g. "VS · Bihar 2025" (LS has no state). */
  electionLabel: string;
  statusLabel: { kind: 'final' | 'live' | 'upcoming'; declared: number; total: number };
  shareText: string;
  lang: string;
  langs: string[];
  onType(t: 'LS' | 'VS'): void;
  onState(id: number): void;
  onElection(id: string): void;
  onLang(l: string): void;
  onSearchSeat(id: string): void;
  theme: Theme;
  onTheme(t: Theme): void;
  onToggleTheme(): void;
}

export function useTopBarVM(): TopBarVM {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const src = useSources();
  const { theme, setTheme, toggle } = useTheme();
  const { dispatch } = useDashboardStore();
  const { setElection, setElectionType, setSelectedStateId } = useElection();
  const { data: elections, error: electionsError, refetch: refetchElections } = useApi(() => getElections(), []);
  const { data: states } = useApi(() => getStates(), []);
  // A throttled or failed /elections is retried once, so the pickers do not stay empty.
  const retried = useRef(false);
  useEffect(() => {
    if (!electionsError || retried.current) return;
    retried.current = true;
    const id = setTimeout(refetchElections, 1500);
    return () => clearTimeout(id);
  }, [electionsError, refetchElections]);
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
    const list = (states ?? []).filter(s => ids.has(s.id)).map(s => ({ id: s.id, name: s.name }));
    // The current state is always an option, so a failed fetch shows "Bihar" instead of a blank picker.
    if (!elections && current.type === 'VS' && current.state_id != null && !list.some(s => s.id === current.state_id)) list.push({ id: current.state_id, name: current.state?.name ?? String(current.state_id) });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [all, elections, states, current.type, current.state_id, current.state?.name]);

  const years = useMemo(() => {
    const list = all.filter(e => e.type === 'VS' && e.state_id === current.state_id).sort((a, b) => b.year - a.year).map(e => ({ id: e.id, year: e.year }));
    if (!elections && current.type === 'VS' && !list.some(y => y.id === current.id)) list.unshift({ id: current.id, year: current.year });
    return list;
  }, [all, elections, current.state_id, current.type, current.id, current.year]);
  const lsElections = useMemo(() => {
    const list = all.filter(e => e.type === 'LS').sort((a, b) => b.year - a.year).map(e => ({ id: e.id, name: e.name }));
    if (!elections && current.type === 'LS' && !list.some(e => e.id === current.id)) list.unshift({ id: current.id, name: current.name });
    return list;
  }, [all, elections, current.type, current.id, current.name]);

  return {
    electionType: current.type,
    electionId: current.id,
    states: vsStates,
    stateId: current.state_id,
    years,
    lsElections,
    electionLabel: [`${t(current.type === 'VS' ? 'studio_type_vs_short' : 'studio_type_ls_short')} ·`, current.type === 'VS' ? (vsStates.find(s => s.id === current.state_id)?.name ?? current.state?.name) : null, current.year].filter(Boolean).join(' '),
    statusLabel: {
      kind: current.status === 'Live' ? 'live' : current.status === 'Finalized' ? 'final' : 'upcoming',
      declared: countDeclared(src.data.mapRegions),
      total: src.totalSeats,
    },
    shareText: `${current.name} - MatdaanPulse`,
    lang: i18n.language,
    langs: LANGS,
    onType: t => { if (t !== current.type) go(recall(t, all) ?? pickLatestElection(all, t), t); },
    onState: id => go(pickLatestElection(all.filter(e => e.state_id === id), 'VS'), 'VS'),
    onElection: id => { const el = all.find(e => e.id === id) ?? null; go(el, el?.type ?? current.type); },
    onLang: l => { void i18n.changeLanguage(l); },
    onSearchSeat: id => dispatch({ type: 'selectSeat', seat: id }),
    theme,
    onTheme: setTheme,
    onToggleTheme: toggle,
  };
}
