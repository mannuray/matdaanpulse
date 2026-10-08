import { useEffect, useMemo, useState } from 'react';
import { useApi } from '../data/useApi';
import { ElectionService, getManifest, getResults } from '../../model/api/election.service';
import { matchFeaturesToSeats } from '../../model/geo/featureMatch';
import { displayNameFromConstId } from '../../model/geo/regionMatching';
import { partySeatFills, type PartySeatFill } from '../../model/derive/partyMap';
import type { GeoFeature } from '../../model/geo/geoHelpers';

export type { PartySeatFill };

export interface PartyMapVM {
  electionId: string; year: number;
  years: { electionId: string; year: number }[];
  setElection(id: string): void;
  status: 'loading' | 'ready' | 'error';
  features: GeoFeature[];
  seatOf: Map<GeoFeature, string>;
  fills: Map<string, PartySeatFill>;
  seatName(constId: string): string;
}

/** "Where it won": the picked election's own map (manifest geo.map_url) coloured by the party's result per seat. */
export function usePartyMap(partyId: string, color: string, years: { electionId: string; year: number }[]): PartyMapVM | null {
  const [picked, setPicked] = useState<string | null>(null);
  const electionId = picked && years.some(y => y.electionId === picked) ? picked : years[0]?.electionId ?? null;
  useEffect(() => { setPicked(null); }, [partyId]);
  const manifest = useApi(() => (electionId ? getManifest(electionId) : Promise.resolve(null)), [electionId], { key: electionId ? `manifest_${electionId}` : undefined });
  // Tagged with its election: useApi keeps the previous result while the next loads, and an old year's rows must never colour the new one.
  const results = useApi(() => (electionId ? getResults(electionId).then(rows => ({ electionId, rows })) : Promise.resolve(null)), [electionId], { key: electionId ? `party_map_results_${electionId}` : undefined });
  const mapUrl = manifest.data && manifest.data.election_id === electionId ? manifest.data.draft?.geo?.map_url ?? null : null;
  const geo = useApi(() => (mapUrl ? ElectionService.getGeoJSON(mapUrl) : Promise.resolve(null)), [mapUrl], { key: mapUrl ? `geo_${mapUrl}` : undefined });

  return useMemo((): PartyMapVM | null => {
    if (!electionId) return null;
    const rows = results.data && results.data.electionId === electionId ? results.data.rows : null;
    const features = (geo.data?.features ?? []) as GeoFeature[];
    const seats = [...new Set((rows ?? []).map(r => r.const_id))].map(id => ({ id, name: displayNameFromConstId(id) }));
    const ready = !!geo.data && !!rows;
    return {
      electionId, year: years.find(y => y.electionId === electionId)?.year ?? 0, years, setElection: setPicked,
      status: manifest.error || results.error || geo.error ? 'error' : ready ? 'ready' : 'loading',
      features, seatOf: ready ? matchFeaturesToSeats(features, seats, { byNumber: true }) : new Map(),
      fills: partySeatFills(partyId, rows ?? [], color), seatName: displayNameFromConstId,
    };
  }, [electionId, years, results.data, results.error, geo.data, geo.error, manifest.error, partyId, color]);
}
