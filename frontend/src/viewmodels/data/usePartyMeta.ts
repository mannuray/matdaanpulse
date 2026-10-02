import { useMemo } from 'react';
import { useApi } from './useApi';
import { getParties } from '../../model/api/geo.service';
import { buildPartyMeta, type PartyMeta } from '../../model/derive/partyMeta';

const EMPTY = new Map<string, PartyMeta>();

/** Every party's name, abbreviation and mark (one cached /parties call for the whole app). */
export function usePartyMeta(): Map<string, PartyMeta> {
  const { data } = useApi(() => getParties(), [], { key: 'parties_all' });
  return useMemo(() => (data ? buildPartyMeta(data) : EMPTY), [data]);
}
