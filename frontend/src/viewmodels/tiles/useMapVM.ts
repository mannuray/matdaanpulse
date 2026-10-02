import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { activeHighlight, type MapMode } from '../store/dashboardStore';
import { ElectionService } from '../../model/api/election.service';
import { seatFills, showOutline, type SeatFill } from '../../model/derive/mapFill';
import { matchFeaturesToSeats } from '../../model/geo/featureMatch';
import type { GeoFeature } from '../../model/geo/geoHelpers';
import type { LayerId } from '../../model/types/dashboard';

const LS_PC = '/geo/india_pc.geojson';
const LS_STATES = '/geo/india_states.geojson';

export interface MapVM {
  status: 'loading' | 'error' | 'ready';
  features: GeoFeature[];
  stateFeatures: GeoFeature[] | null;
  isVS: boolean;
  geoConfig?: { map_url?: string; center?: [number, number]; zoom?: number };
  seatOf: Map<GeoFeature, string>;
  fills: Map<string, SeatFill>;
  /** Draw the highlight outline (small highlights only). */
  outline: boolean;
  recentSeats: Set<string>;
  selectedSeat: string | null;
  layer: LayerId;
  layers: LayerId[];
  mapMode: MapMode;
  hexAvailable: boolean;
  lockedLabel: string | null;
  seatInfo(id: string): { name: string; candidate: string; party: string; status: string; margin?: number; color: string; mark: string | null; type: 'GEN' | 'SC' | 'ST' | null } | null;
  onLayer(l: LayerId): void;
  onMapMode(m: MapMode): void;
  onSelect(id: string): void;
  onClearLock(): void;
  onFocus(): void;
}

export function useMapVM(): MapVM {
  const { t } = useTranslation();
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const geo = src.data.manifestData?.geo;
  const isVS = src.election.type === 'VS';
  const url = geo?.map_url || LS_PC;
  const [status, setStatus] = useState<MapVM['status']>('loading');
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [stateFeatures, setStateFeatures] = useState<GeoFeature[] | null>(null);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    Promise.all([ElectionService.getGeoJSON(url), isVS ? Promise.resolve(null) : ElectionService.getGeoJSON(LS_STATES)])
      .then(([pc, st]) => {
        if (!active) return;
        setFeatures(pc.features as GeoFeature[]);
        setStateFeatures(st ? (st.features as GeoFeature[]) : null);
        setStatus('ready');
      })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [url, isVS]);

  const seats = src.data.mapRegions;
  const seatOf = useMemo(() => matchFeaturesToSeats(features, seats), [features, seats]);
  const highlight = activeHighlight(state);
  // Highlight sets are rebuilt each render; key them by content so fills only recompute on real changes.
  const hlKey = `${[...highlight.parties].join(',')}|${[...highlight.seats].join(',')}`;
  const fillCtx = {
    layer: state.layer,
    electionType: src.election.type,
    partyColor: src.data.partyColorMap,
    swing: src.swing,
    dominance: src.dominance,
    spoilerSeats: src.data.spoilerData.spoilerSeats,
    threeWaySeats: src.data.spoilerData.threeWaySeats,
    highlight,
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fills = useMemo(() => seatFills(seats, fillCtx), [seats, state.layer, src.election.type, src.data.partyColorMap, src.swing, src.dominance, src.data.spoilerData, hlKey]);

  const outline = useMemo(() => showOutline([...fills.values()].filter(f => f.highlighted).length), [fills]);
  const byId = useMemo(() => new Map(seats.map(s => [s.id, s])), [seats]);

  return {
    status, features, stateFeatures, isVS, geoConfig: geo, seatOf, fills, outline,
    recentSeats: src.recentSeats, selectedSeat: state.selectedSeat,
    layer: state.layer, layers: src.availableLayers, mapMode: state.mapMode, hexAvailable: Boolean(geo?.hex_url),
    lockedLabel: state.locked?.label ?? null,
    seatInfo: id => {
      const s = byId.get(id);
      if (!s) return null;
      return { name: s.name, candidate: s.candidate, party: s.party, status: s.party ? t(s.status.toLowerCase(), s.status) : t('results_pending'), margin: s.margin, color: s.partyColor, mark: s.party ? src.partyMeta.get(s.party)?.mark ?? null : null, type: s.type ?? null };
    },
    onLayer: l => dispatch({ type: 'setLayer', layer: l }),
    onMapMode: m => dispatch({ type: 'setMapMode', mode: m }),
    onSelect: id => dispatch({ type: 'selectSeat', seat: id }),
    onClearLock: () => dispatch({ type: 'clearLock' }),
    onFocus: () => dispatch({ type: 'focus', tile: 'map' }),
  };
}
