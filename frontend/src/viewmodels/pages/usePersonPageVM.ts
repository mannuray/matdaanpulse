import { useMemo } from 'react';
import { useApi } from '../data/useApi';
import { getPerson } from '../../model/api/person.service';
import { ApiError } from '../../model/api/api-client';
import { ageFrom, affidavitSeries, contestViews, personStats, type ContestView, type PersonStats, type AffidavitPoint } from '../../model/derive/personPage';

const NOT_FOUND = 'NOT_FOUND' as const;

export interface PersonPageVM {
  status: 'loading' | 'error' | 'notFound' | 'ready';
  name: string; photo: string | null; currentParty: { label: string; mark: string | null; color: string } | null;
  facts: { age: number | null; gender: string | null; education: string | null; home: string | null }; wikipedia: string | null; bio: string | null;
  incumbent: boolean; stats: PersonStats; contests: ContestView[]; affidavit: AffidavitPoint[]; latest: AffidavitPoint | null;
}

export function usePersonPageVM(id: string): PersonPageVM {
  // useApi's error is a string, so a 404 is turned into a value here.
  const { data: raw, error } = useApi(() => getPerson(id).catch(e => { if (e instanceof ApiError && e.status === 404) return NOT_FOUND; throw e; }), [id], { key: `person_${id}` });
  return useMemo((): PersonPageVM => {
    const notFound = raw === NOT_FOUND;
    // useApi keeps the previous person's data while the next loads: only use data that belongs to this id.
    const p = raw && raw !== NOT_FOUND && raw.id === id ? raw : null;
    const cands = p?.candidates ?? [];
    const contests = contestViews(cands);
    const affidavit = affidavitSeries(cands);
    const latestContest = contests[0];
    const newest = cands.slice().sort((a, b) => (b.election_year ?? 0) - (a.election_year ?? 0))[0];
    return {
      status: notFound ? 'notFound' : p ? 'ready' : error ? 'error' : 'loading',
      name: p?.name ?? '', photo: p?.photo_url ?? null,
      currentParty: latestContest?.partyId ? { label: latestContest.partyLabel, mark: latestContest.mark, color: latestContest.color } : null,
      facts: { age: ageFrom(p?.date_of_birth ?? null), gender: p?.gender || null, education: p?.education || null, home: [p?.district?.name, p?.state?.name].filter(Boolean).join(', ') || null },
      wikipedia: p?.wikipedia_url ?? null, bio: p?.bio?.trim() ? p.bio : null,
      incumbent: !!newest?.is_incumbent,
      stats: personStats(cands), contests, affidavit, latest: affidavit[affidavit.length - 1] ?? null,
    };
  }, [raw, error, id]);
}
