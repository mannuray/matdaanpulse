import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../data/useApi';
import { usePartyMeta } from '../data/usePartyMeta';
import { getParty } from '../../model/api/geo.service';
import { getPartyRecord } from '../../model/api/party.service';
import { ApiError } from '../../model/api/api-client';
import { deltaOf, headline, latestByState, sparkline, type Delta, type Headline } from '../../model/derive/partyRecord';
import type { LineageEvent, PartyDetail, PartyRecord, PartyUnit } from '../../model/types';

export type { Delta, Headline };
export type { LineageEvent } from '../../model/types';

interface Missing { id: string; notFound: true }

export interface RoleView { name: string; personId: string | null; photo: string | null; since: string | null }

export interface StateRowView {
  code: string; name: string; year: number; won: number; contested: number; seatsTotal: number; share: number;
  delta: Delta | null; spark: number[]; president: { name: string; personId: string | null; photo: string | null } | null; href: string;
}

/** The state view's sections (party page spec §4); filled in by the state view. */
export type PartyStateView = null;

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
  stateView: PartyStateView;
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
  // useApi's error is a string, so a 404 is turned into a value here.
  const party = useApi(() => getParty(id).catch((e): Missing => { if (e instanceof ApiError && e.status === 404) return { id, notFound: true }; throw e; }), [id], { key: `party_${id}` });
  const record = useApi(() => getPartyRecord(id, wanted ?? undefined), [id, wanted], { key: `party_record_${id}_${wanted ?? ''}` });

  const mineParty = party.data && party.data.id === id ? party.data : null;
  const rec: PartyRecord | null = record.data && record.data.party_id === id ? record.data : null;
  const latest = useMemo(() => (rec ? latestByState(rec) : []), [rec]);

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
        delta: deltaOf(id, rec.elections, r, rec.lineage, nameOf), spark: sparkline(rec, r.state_id),
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
      stateView: null, recordError: !!record.error && !rec, retry: record.refetch, nameOf,
    };
  }, [mineParty, party.error, rec, record.error, record.refetch, latest, wanted, id, meta]);
}
