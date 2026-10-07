import { mapLegend, type LegendItem } from '../../model/derive/mapLegend';
export type { LegendItem };
import type { PulseKind } from '../../model/live/pulse';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { activeHighlight, type MapMode } from '../store/dashboardStore';
import { ElectionService } from '../../model/api/election.service';
import { seatFills, showOutline, type SeatFill, countingLive } from '../../model/derive/mapFill';
import { matchFeaturesToSeats } from '../../model/geo/featureMatch';
import type { GeoFeature } from '../../model/geo/geoHelpers';
import type { LayerId } from '../../model/types/dashboard';
import { LS_MAP_URL } from '../../model/geo/maps';
import { regionOutlines, type RegionOutline } from '../../model/derive/regionOutlines';
import { useRegionShares } from '../data/useRegionShares';

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
  /** Regions layer: each region's outline, built from its seats (strong for the highlighted region). Empty elsewhere. */
  regionOutlines: RegionOutline[];
  /** Seats that just changed, with the change kind (pulse colour). */
  recentSeats: Map<string, PulseKind>;
  /** The live legend (calls on the Overview, momentum on Battle); null when not live. */
  legend: LegendItem[] | null;
  selectedSeat: string | null;
  layer: LayerId;
  layers: LayerId[];
  mapMode: MapMode;
  hexAvailable: boolean;
  lockedLabel: string | null;
  /** Tooltip facts; state is the seat's state (LS: from the PC map, VS: the election's state) when known. */
  /** `live`: while counting, the seat's call and whether its lead just switched (hover card, spec §3.1). */
  seatInfo(id: string): { name: string; state: string | null; candidate: string; party: string; status: string; margin?: number; color: string; mark: string | null; type: 'GEN' | 'SC' | 'ST' | null; live?: { call: string; leadSwitch: boolean } } | null;
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
  const url = geo?.map_url || LS_MAP_URL;
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
  const seatOf = useMemo(() => matchFeaturesToSeats(features, seats, { byNumber: isVS }), [features, seats, isVS]);
  const highlight = activeHighlight(state);
  // Highlight sets are rebuilt each render; key them by content so fills only recompute on real changes.
  const hlKey = `${[...highlight.parties].join(',')}|${[...highlight.seats].join(',')}`;
  // Live counting only: the per-seat live state colours the Overview (call) and Battle (momentum).
  const live = useMemo(() => countingLive(src.election.status === 'Live' ? src.liveAnalysis?.seats : undefined), [src.election.status, src.liveAnalysis]);
  const fillCtx = {
    live,
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
  const fills = useMemo(() => seatFills(seats, fillCtx), [seats, state.layer, src.election.type, src.data.partyColorMap, src.swing, src.dominance, src.data.spoilerData, hlKey, live]);
  const legend = useMemo(() => mapLegend(state.layer, live), [state.layer, live]);

  const outline = useMemo(() => showOutline([...fills.values()].filter(f => f.highlighted).length), [fills]);
  const onRegions = state.layer === 'regions';
  const shares = useRegionShares(src.election.id, onRegions && isVS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const regionLines = useMemo(() => (onRegions && shares ? regionOutlines(shares.regions.map(r => ({ name: r.name, seatIds: r.const_ids ?? [] })), highlight.seats) : []), [onRegions, shares, hlKey]);
  const byId = useMemo(() => new Map(seats.map(s => [s.id, s])), [seats]);

  return {
    status, features, stateFeatures, isVS, geoConfig: geo, seatOf, fills, outline: outline && !onRegions, regionOutlines: regionLines,
    recentSeats: src.recentSeats, legend, selectedSeat: state.selectedSeat,
    layer: state.layer, layers: src.availableLayers, mapMode: state.mapMode, hexAvailable: Boolean(geo?.hex_url),
    lockedLabel: state.locked?.label ?? null,
    seatInfo: id => {
      const s = byId.get(id);
      if (!s) return null;
      return { name: s.name, state: (isVS ? src.election.state?.name : s.state) || null, candidate: s.candidate, party: s.party, status: s.party ? t(s.status.toLowerCase(), s.status) : t('results_pending'), margin: s.margin, color: s.partyColor, mark: s.party ? src.partyMeta.get(s.party)?.mark ?? null : null, type: s.type ?? null,
        ...(live?.get(id) ? { live: { call: t(`seat_call_${live.get(id)!.call}`), leadSwitch: live.get(id)!.momentum === 'switched' } } : {}) };
    },
    onLayer: l => dispatch({ type: 'setLayer', layer: l }),
    onMapMode: m => dispatch({ type: 'setMapMode', mode: m }),
    onSelect: id => dispatch({ type: 'selectSeat', seat: id }),
    onClearLock: () => dispatch({ type: 'clearLock' }),
    onFocus: () => dispatch({ type: 'focus', tile: 'map' }),
  };
}
