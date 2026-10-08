import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../data/useApi';
import { usePartyMeta } from '../data/usePartyMeta';
import { usePartyMap, type PartyMapVM } from './usePartyMap';
import { getParty } from '../../model/api/geo.service';
import { getPartyRecord } from '../../model/api/party.service';
import { ApiError } from '../../model/api/api-client';
import { deltaOf, headline, latestByState, previousComparable, recordLines, sparkline, type Delta, type Headline, type RecordLine } from '../../model/derive/partyRecord';
import type { LineageEvent, PartyDetail, PartyRecord, PartyUnit } from '../../model/types';

export type { Delta, Headline, RecordLine };
export type { PartyMapVM, PartySeatFill } from './usePartyMap';
export type { LineageEvent } from '../../model/types';

interface Missing { id: string; notFound: true }

export interface RoleView { name: string; personId: string | null; photo: string | null; since: string | null }

export interface StateRowView {
  code: string; name: string; year: number; won: number; contested: number; seatsTotal: number; share: number;
  delta: Delta | null; spark: number[]; president: { name: string; personId: string | null; photo: string | null } | null; href: string;
}

export type StateSection = 'record' | 'map' | 'changes' | 'mlas' | 'regions';
export interface MlaView { personId: string | null; name: string; photo: string | null; constId: string; constName: string; margin: number | null }

/** One state's view (party page spec §4). */
export interface PartyStateView {
  code: string; name: string; electionId: string; year: number; won: number; seatsTotal: number; share: number; delta: Delta | null;
  recognition: string | null; office: string | null; website: string | null;
  president: RoleView | null; leader: RoleView | null; pastPresidents: { name: string; from: string | null; to: string | null }[];
  /** Newest first, with lineage events and redraws in place. */
  lines: RecordLine[];
  /** Oldest → newest. */
  chart: { year: number; won: number; share: number }[];
  /** Null when there is no earlier election on the same boundaries. */
  changes: { held: number; gained: number; lost: number; gainedFrom: { party: string; seats: number; split: boolean }[]; lostTo: { party: string; seats: number; split: boolean }[] } | null;
  mlas: MlaView[];
  query: string; setQuery(q: string): void; filteredMlas: MlaView[];
  regions: { region: string; seats: number; won: number }[] | null;
  /** Jump links: sections that have something to show. */
  sections: StateSection[];
}

export interface PartyPageVM {
  status: 'loading' | 'error' | 'notFound' | 'ready';
  party: PartyDetail | null;
  mark: string | null; color: string;
  view: 'national' | 'state';
  stateCode: string | null;
  /** `?state=` names a state the party never contested (its code: units carry no codes). */
  missingState: string | null;
  /** "All states" first (code ''), then the contested states by seats won. Empty without results. */
  chips: { code: string; name: string; href: string; active: boolean }[];
  headline: Headline;
  states: StateRowView[];
  lineage: LineageEvent[];
  noResults: boolean;
  stateView: PartyStateView | null;
  /** The state view's map (null on the national view). */
  map: PartyMapVM | null;
  recordError: boolean;
  retry(): void;
  nameOf(partyId: string): string;
}

/** The current holder of a unit role (no end date), if any. */
export function currentRole(unit: PartyUnit | undefined, role: 'state_president' | 'legislature_leader'): RoleView | null {
  const r = unit?.roles.find(x => x.role === role && x.to_date == null);
  return r ? { name: r.person_name, personId: r.person_id, photo: r.photo_url ?? null, since: r.from_date } : null;
}

export function usePartyPageVM(id: string): PartyPageVM {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const wanted = params.get('state')?.trim().toUpperCase() || null;
  const meta = usePartyMeta();
  const [query, setQuery] = useState('');
  // useApi's error is a string, so a 404 is turned into a value here.
  const party = useApi(() => getParty(id).catch((e): Missing => { if (e instanceof ApiError && e.status === 404) return { id, notFound: true }; throw e; }), [id], { key: `party_${id}` });
  const record = useApi(() => getPartyRecord(id, wanted ?? undefined), [id, wanted], { key: `party_record_${id}_${wanted ?? ''}` });

  const mineParty = party.isStale ? null : party.data;
  // useApi keeps the previous payload while the next loads (isStale): never show it as this party's or this view's.
  const rec: PartyRecord | null = record.isStale ? null : record.data;
  const latest = useMemo(() => (rec ? latestByState(rec) : []), [rec]);

  const contestedHere = !!wanted && latest.some(r => r.state_code === wanted);
  const mapYears = useMemo(() => (rec && contestedHere ? rec.elections.filter(r => r.state_code === wanted).map(r => ({ electionId: r.election_id, year: r.year })) : []), [rec, contestedHere, wanted]);
  const partyColor = (mineParty && !('notFound' in mineParty) ? (mineParty as PartyDetail).color : null) || meta.get(id)?.color || 'var(--color-fallback)';
  const map = usePartyMap(id, partyColor, mapYears);

  // A party that contested one state opens on its state view.
  useEffect(() => {
    if (!wanted && latest.length === 1) navigate(`/party/${encodeURIComponent(id)}?state=${latest[0].state_code}`, { replace: true });
  }, [wanted, latest, id, navigate]);

  return useMemo((): PartyPageVM => {
    const notFound = !!mineParty && 'notFound' in mineParty;
    const p = mineParty && !('notFound' in mineParty) ? (mineParty as PartyDetail) : null;
    const m = meta.get(id);
    const nameOf = (pid: string) => meta.get(pid)?.abbreviation || pid;
    const unitOf = (stateId: number) => p?.units?.find(u => u.state_id === stateId);
    const contested = !!wanted && latest.some(r => r.state_code === wanted);
    const href = (code: string) => `/party/${encodeURIComponent(id)}${code ? `?state=${code}` : ''}`;
    const states: StateRowView[] = rec ? latest.map(r => {
      const pres = currentRole(unitOf(r.state_id), 'state_president');
      return {
        code: r.state_code, name: r.state_name, year: r.year, won: r.won, contested: r.contested, seatsTotal: r.seats_total, share: r.share,
        delta: deltaOf(id, rec.elections, r, rec.lineage, nameOf, rec.family_elections ?? [], rec.state_elections ?? []), spark: sparkline(rec, r.state_id),
        president: pres ? { name: pres.name, personId: pres.personId, photo: pres.photo } : null, href: href(r.state_code),
      };
    }) : [];
    const chips = latest.length ? [
      { code: '', name: '', href: href(''), active: !contested },
      ...latest.map(r => ({ code: r.state_code, name: r.state_name, href: href(r.state_code), active: contested && r.state_code === wanted })),
    ] : [];
    return {
      status: notFound ? 'notFound' : p ? 'ready' : party.error ? 'error' : 'loading',
      party: p, mark: m?.mark ?? p?.symbol_url ?? p?.eci_symbol_url ?? null, color: p?.color || m?.color || 'var(--color-fallback)',
      view: contested ? 'state' : 'national', stateCode: contested ? wanted : null,
      missingState: wanted && rec && !contested ? wanted : null,
      chips, headline: headline(rec ?? { party_id: id, elections: [], lineage: [] }), states,
      lineage: rec?.lineage ?? p?.lineage ?? [], noResults: !!rec && rec.elections.length === 0,
      map,
      stateView: contested && rec ? stateViewOf(id, rec, wanted!, p?.units, nameOf, query, setQuery) : null, recordError: !!record.error && !rec, retry: record.refetch, nameOf,
    };
  }, [mineParty, party.error, rec, record.error, record.refetch, latest, wanted, id, meta, query, map]);
}

function stateViewOf(id: string, rec: PartyRecord, code: string, units: PartyUnit[] | undefined, nameOf: (pid: string) => string,
  query: string, setQuery: (q: string) => void): PartyStateView | null {
  const rows = rec.elections.filter(r => r.state_code === code);
  const latest = rows[0];
  if (!latest) return null;
  const unit = units?.find(u => u.state_id === latest.state_id);
  const flow = rec.state?.code === code ? rec.state.flow : [];
  // Seat changes compare with the state's previous election (as the stored analysis does), contested or not;
  // none when the boundaries changed in between or there is no earlier election.
  const stateEls = (rec.state_elections ?? []).filter(e => e.state_id === latest.state_id && e.date < latest.date).sort((a, b) => b.date.localeCompare(a.date));
  const comparable = rec.state_elections ? !!stateEls[0] && stateEls[0].delimitation != null && stateEls[0].delimitation === latest.delimitation : !!previousComparable(rows, latest);
  const changes = comparable ? {
    held: latest.held, gained: latest.gained, lost: latest.lost,
    gainedFrom: flow.filter(f => f.to === id).map(f => ({ party: f.from, seats: f.seats, split: f.split })),
    lostTo: flow.filter(f => f.from === id).map(f => ({ party: f.to, seats: f.seats, split: f.split })),
  } : null;
  const mlas: MlaView[] = (rec.state?.code === code ? rec.state.mlas : []).map(m => ({ personId: m.person_id, name: m.name, photo: m.photo_url, constId: m.const_id, constName: m.const_name, margin: m.margin }));
  const q = query.trim().toLowerCase();
  const regions = rec.state?.code === code ? rec.state.regions : null;
  // The seat-changes card always shows (it says when there is nothing to compare with), so it always has a link.
  const sections: StateSection[] = ['record', 'map', 'changes', ...(mlas.length ? ['mlas' as const] : []), ...(regions?.length ? ['regions' as const] : [])];
  return {
    code, name: latest.state_name, electionId: latest.election_id, year: latest.year, won: latest.won, seatsTotal: latest.seats_total, share: latest.share,
    delta: deltaOf(id, rows, latest, rec.lineage, nameOf, rec.family_elections ?? [], rec.state_elections ?? []),
    recognition: unit?.eci_recognition ?? null, office: unit?.office ?? null, website: unit?.website ?? null,
    president: currentRole(unit, 'state_president'), leader: currentRole(unit, 'legislature_leader'),
    pastPresidents: (unit?.roles ?? []).filter(r => r.role === 'state_president' && r.to_date != null).map(r => ({ name: r.person_name, from: r.from_date, to: r.to_date })),
    lines: recordLines(id, rec, latest.state_id, nameOf),
    chart: rows.map(r => ({ year: r.year, won: r.won, share: r.share })).reverse(),
    changes, mlas, query, setQuery,
    filteredMlas: q ? mlas.filter(m => m.name.toLowerCase().includes(q) || m.constName.toLowerCase().includes(q)) : mlas,
    regions, sections,
  };
}
