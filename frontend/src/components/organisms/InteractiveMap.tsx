import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { select, zoomTransform } from 'd3';
import StatesMiniMap from './StatesMiniMap';
import type { MapTab, SwingEntry, ResultRow, VoteSplitConfig, DominanceEntry } from '../../types';
import { LS_BUCKETS, VS_BUCKETS } from './summary/utils';
import { MapLegend } from './MapLegend';
import { MapControls } from './MapControls';
import { useMapRendering } from './useMapRendering';
import { ElectionService } from '../../services/election.service';
import { featureName, featureCategory, normName } from '../../utils/geoHelpers';
import type { GeoFeature } from '../../utils/geoHelpers';

interface MapRegion {
  id: string;
  name: string;
  color: string;
  candidate?: string;
  party?: string;
  partyColor?: string;
  margin?: number;
  status?: string;
  type?: 'GEN' | 'SC' | 'ST';
  isFlip?: boolean;
  isVip?: boolean;
  recentChange?: boolean;
}

interface AllianceDef {
  id: string;
  name: string;
  color: string;
  parties: string[];
}

interface PartyDef {
  id: string;
  name: string;
  color: string;
  seats: number;
}

interface GeoConfig {
  map_url?: string;
  center?: [number, number];
  zoom?: number;
}

interface InteractiveMapProps {
  regions: MapRegion[];
  onRegionClick: (id: string) => void;
  alliances: AllianceDef[];
  partyList: PartyDef[];
  geoConfig?: GeoConfig;
  electionType?: 'LS' | 'VS';
  mapTab?: MapTab;
  onMapTabChange?: (tab: MapTab) => void;
  selectedIds?: Set<string>;
  onSelectedIdsChange?: (ids: Set<string>) => void;
  swingMap?: Map<string, SwingEntry>;
  constCandidates?: Map<string, ResultRow[]>;
  voteSplits?: VoteSplitConfig[];
  dominanceMap?: Map<string, DominanceEntry>;
  spoilerData?: { spoilerSeats: Set<string>; threeWaySeats: Set<string>; hasData: boolean };
  spoilerFilter?: string | null;
}

function abbreviateName(name: string): string {
  const words = name.split(/[\s_]+/);
  if (words.length === 1 && name.length <= 6) return name;
  if (words[0].length <= 6) return words[0];
  return name.slice(0, 3) + '.';
}

const DEFAULT_FILL = '#d4d4d4';
const MAP_BG = '#f0f0f0';
const MAP_WIDTH = 560;
const MAP_HEIGHT = 680;

const STATE_CODE_TO_NAME: Record<string, string> = {
  AN: 'ANDAMANNICOBARISLANDS', AP: 'ANDHRAPRADESH', AR: 'ARUNACHALPRADESH',
  AS: 'ASSAM', BR: 'BIHAR', CH: 'CHANDIGARH', CG: 'CHHATTISGARH',
  DD: 'DADRAANDNAGARHAVELI', GA: 'GOA', GJ: 'GUJARAT', HR: 'HARYANA',
  HP: 'HIMACHALPRADESH', JK: 'JAMMUANDKASHMIR', JH: 'JHARKHAND',
  KA: 'KARNATAKA', KL: 'KERALA', LA: 'LADAKH', LD: 'LAKSHADWEEP',
  MP: 'MADHYAPRADESH', MH: 'MAHARASHTRA', MN: 'MANIPUR', ML: 'MEGHALAYA',
  MZ: 'MIZORAM', NL: 'NAGALAND', OD: 'ODISHA', PB: 'PUNJAB',
  RJ: 'RAJASTHAN', SK: 'SIKKIM', TN: 'TAMILNADU', TS: 'TELANGANA',
  TR: 'TRIPURA', UP: 'UTTARPRADESH', UK: 'UTTARAKHAND', WB: 'WESTBENGAL',
  DL: 'NCT', PY: 'PUDUCHERRY',
};

function blendWithWhite(hex: string, intensity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(255 + (c - 255) * intensity);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function marginIntensity(margin: number, buckets: { max: number }[]): number {
  for (let i = 0; i < buckets.length; i++) {
    if (margin < buckets[i].max) return BUCKET_INTENSITIES[i];
  }
  return 1.0;
}

const BUCKET_INTENSITIES = [0.10, 0.30, 0.55, 0.80, 1.0] as const;
const MARGIN_BUCKETS_LS = LS_BUCKETS.map((b, i) => ({ label: b.label, intensity: BUCKET_INTENSITIES[i] }));
const MARGIN_BUCKETS_VS = VS_BUCKETS.map((b, i) => ({ label: b.label, intensity: BUCKET_INTENSITIES[i] }));

const DEMO_CATEGORIES = ['GEN', 'SC', 'ST'] as const;
type DemoCategory = typeof DEMO_CATEGORIES[number];

/**
 * ORGANISM: Interactive Map (SOLID: Performance Optimized)
 */
export default function InteractiveMap({ regions, onRegionClick, alliances, partyList, geoConfig, electionType, mapTab: controlledTab, onMapTabChange, selectedIds: controlledIds, onSelectedIdsChange, swingMap, constCandidates, voteSplits, dominanceMap, spoilerData: externalSpoilerData, spoilerFilter }: InteractiveMapProps) {
  const { t } = useTranslation();
  const geoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const stateGeoRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const onRegionClickRef = useRef(onRegionClick);
  onRegionClickRef.current = onRegionClick;

  const isVS = electionType === 'VS';

  const { svgRef, gRef, pathGenRef, handleResetZoom } = useMapRendering({
    loaded,
    geoRef,
    stateGeoRef,
    isVS,
    geoConfig,
    MAP_WIDTH,
    MAP_HEIGHT,
    MAP_BG
  });

  const activeBuckets = isVS ? VS_BUCKETS : LS_BUCKETS;
  const getMarginIntensity = useCallback(
    (margin: number) => marginIntensity(margin, activeBuckets),
    [activeBuckets]
  );
  const MARGIN_BUCKETS = isVS ? MARGIN_BUCKETS_VS : MARGIN_BUCKETS_LS;

  const mapUrl = geoConfig?.map_url || '/geo/india_pc.geojson';

  const [internalTab, setInternalTab] = useState<MapTab>('overview');
  const mapTab = controlledTab ?? internalTab;
  const setMapTab = onMapTabChange ?? setInternalTab;
  
  const [internalIds, setInternalIds] = useState<Set<string>>(new Set());
  const selectedIds = controlledIds ?? internalIds;
  const setSelectedIds = onSelectedIdsChange ?? setInternalIds;
  
  const [selectedCategories, setSelectedCategories] = useState<Set<DemoCategory>>(new Set());
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());
  const [stateSearch, setStateSearch] = useState('');
  const [partySearch, setPartySearch] = useState('');

  const hasSwingData = swingMap && swingMap.size > 0;
  const hasDominanceData = dominanceMap && dominanceMap.size > 0;

  const availableTabs = useMemo<MapTab[]>(() => isVS
    ? ['overview', 'battle', ...(hasSwingData ? ['swing' as MapTab] : []), ...(hasDominanceData ? ['history' as MapTab] : []), 'demographics', 'insights']
    : ['overview', 'battle', ...(hasSwingData ? ['swing' as MapTab] : []), ...(hasDominanceData ? ['history' as MapTab] : []), 'demographics', 'states', 'insights'],
    [isVS, hasSwingData, hasDominanceData]
  );

  useEffect(() => {
    if (isVS && mapTab === 'states') setMapTab('overview');
  }, [isVS, mapTab, setMapTab]);

  const emptySpoiler = useMemo(() => ({ spoilerSeats: new Set<string>(), threeWaySeats: new Set<string>(), hasData: false }), []);
  const spoilerData = externalSpoilerData || emptySpoiler;

  const selectedPartyColors = useMemo(() => {
    const map = new Map<string, string>();
    for (const id of selectedIds) {
      const alliance = alliances.find((a) => a.id === id);
      if (alliance) {
        alliance.parties.forEach((p) => map.set(p, alliance.color));
      } else {
        const otherAlliance = id === '__others__';
        if (otherAlliance) {
          const inAlliance = new Set<string>();
          alliances.forEach((a) => a.parties.forEach((p) => inAlliance.add(p)));
          partyList.filter((p) => !inAlliance.has(p.id)).forEach((p) => map.set(p.id, '#6b7280'));
        } else {
          const party = partyList.find((p) => p.id === id);
          map.set(id, party?.color || '#6b7280');
        }
      }
    }
    return map;
  }, [selectedIds, alliances, partyList]);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError(false);
    geoRef.current = null;
    stateGeoRef.current = null;

    const load = async () => {
      try {
        const [pcData, stateData] = await Promise.all([
          ElectionService.getGeoJSON(mapUrl),
          !isVS ? ElectionService.getGeoJSON('/geo/india_states.geojson') : Promise.resolve(null)
        ]);
        if (!active) return;
        geoRef.current = pcData;
        stateGeoRef.current = stateData as any;
        setLoaded(true);
      } catch (e) {
        if (active) setError(true);
      }
    };
    load();
    return () => { active = false; };
  }, [mapUrl, isVS]);

  const partyColorLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of regions) {
      if (r.party && r.partyColor && !map.has(r.party)) map.set(r.party, r.partyColor);
    }
    return map;
  }, [regions]);

  const regionLookup = useMemo(() => {
    const lookup = new Map<string, MapRegion>();
    regions.forEach((r) => {
      lookup.set(r.id.toUpperCase(), r);
      lookup.set(normName(r.name), r);
      lookup.set(normName(r.id), r);
      const underIdx = r.id.indexOf('_');
      if (underIdx > 0 && underIdx <= 3) {
        const stateCode = r.id.slice(0, underIdx).toUpperCase();
        let restOfId = r.id.slice(underIdx + 1);
        const vsMatch = restOfId.match(/^VS\d*_(.*)$/);
        if (vsMatch) restOfId = vsMatch[1];
        const pcNorm = normName(restOfId);
        lookup.set(pcNorm, r);
        const numMatch = restOfId.match(/^(\d+)_(.+)$/);
        if (numMatch) {
          const constNo = numMatch[1];
          const namePart = normName(numMatch[2]);
          lookup.set(namePart, r);
          lookup.set(`${constNo}:${namePart}`, r);
        }
        const stateNorm = STATE_CODE_TO_NAME[stateCode];
        if (stateNorm) lookup.set(`${stateNorm}:${pcNorm}`, r);
      }
    });
    return lookup;
  }, [regions]);

  const findRegion = useCallback((f: GeoFeature): MapRegion | undefined => {
    const name = featureName(f.properties);
    const pcNorm = normName(name);
    const stNorm = normName(f.properties.st_name);
    const acNo = f.properties.ac_no;
    if (acNo) {
      const numKey = `${acNo}:${pcNorm}`;
      const match = regionLookup.get(numKey);
      if (match) return match;
    }
    return regionLookup.get(`${stNorm}:${pcNorm}`) || regionLookup.get(pcNorm);
  }, [regionLookup]);

  const partyToAlliance = useMemo(() => {
    const map = new Map<string, string>();
    alliances.forEach(a => a.parties.forEach(p => map.set(p, a.id)));
    return map;
  }, [alliances]);

  const getFillDemographics = useCallback((f: GeoFeature, r?: MapRegion): string => {
    const cat = (r?.type || featureCategory(f.properties)) as DemoCategory;
    if (selectedCategories.size === 0 || !selectedCategories.has(cat)) return DEFAULT_FILL;
    if (r?.party && selectedPartyColors.get(r.party)) {
      return blendWithWhite(selectedPartyColors.get(r.party)!, getMarginIntensity(r.margin ?? 0));
    }
    return '#ffffff';
  }, [selectedCategories, selectedPartyColors, getMarginIntensity]);

  const getFillSwing = useCallback((_f: GeoFeature, r?: MapRegion): string => {
    if (!swingMap || !r) return DEFAULT_FILL;
    const swing = swingMap.get(r.id);
    if (!swing || !swing.flipped) return DEFAULT_FILL;
    const displayColor = selectedPartyColors.get(swing.currentParty) || r.partyColor || r.color;
    return (selectedPartyColors.size > 0 && !selectedPartyColors.get(swing.currentParty)) ? DEFAULT_FILL : (displayColor || '#10b981');
  }, [swingMap, selectedPartyColors]);

  const getFillInsights = useCallback((_f: GeoFeature, r?: MapRegion): string => {
    if (!r) return DEFAULT_FILL;
    const isRelevantToSelection = selectedPartyColors.size === 0 ||
      (r.party && selectedPartyColors.has(r.party)) ||
      (constCandidates?.get(r.id)?.[1] && selectedPartyColors.has(constCandidates.get(r.id)![1].party_id));
    if (!isRelevantToSelection) return '#f3f4f6';

    if (spoilerFilter && voteSplits) {
      const cands = constCandidates?.get(r.id);
      if (!cands || cands.length < 2) return DEFAULT_FILL;
      const winner = cands[0], runnerUp = cands[1];
      const margin = winner.votes - runnerUp.votes;
      const filterCand = cands.find(c => c.party_id === spoilerFilter);
      const filterConfig = voteSplits.find(vs => vs.spoiler === spoilerFilter);
      const runnerUpAlliance = partyToAlliance.get(runnerUp.party_id);
      if (filterCand && runnerUpAlliance === filterConfig?.hurts && filterCand.votes > margin) {
        return r.partyColor || r.color || '#ef4444';
      }
      return '#e5e7eb';
    }

    if (spoilerData.hasData) {
      if (spoilerData.spoilerSeats.has(r.id)) return r.partyColor || r.color || '#ef4444';
      if (spoilerData.threeWaySeats.has(r.id)) return '#f59e0b';
      return '#e5e7eb';
    }
    const m = r.margin ?? 0;
    const maxM = isVS ? 50000 : 200000;
    const intensity = 1 - Math.min(m / maxM, 1);
    return `rgb(${Math.round(230 - intensity * 180)},${Math.round(230 - intensity * 130)},${Math.round(100 + intensity * 155)})`;
  }, [selectedPartyColors, spoilerData, isVS, spoilerFilter, voteSplits, constCandidates, partyToAlliance]);

  const getFillHistory = useCallback((_f: GeoFeature, r?: MapRegion): string => {
    if (!dominanceMap || !r) return DEFAULT_FILL;
    const dom = dominanceMap.get(r.id);
    if (!dom || dom.classification === 'new') return DEFAULT_FILL;
    if (dom.classification === 'swing') return '#f59e0b';
    const domParty = dom.dominantParty;
    if (!domParty || (selectedPartyColors.size > 0 && !selectedPartyColors.has(domParty))) return DEFAULT_FILL;
    const partyColor = selectedPartyColors.get(domParty) || partyColorLookup.get(domParty) || '#6b7280';
    return dom.classification === 'stronghold' ? partyColor : blendWithWhite(partyColor, 0.6);
  }, [dominanceMap, selectedPartyColors, partyColorLookup]);

  const getFillDefault = useCallback((_f: GeoFeature, r?: MapRegion): string => {
    if (!r || !r.party) return DEFAULT_FILL;
    const displayColor = selectedPartyColors.get(r.party);
    if (mapTab === 'overview') return displayColor || r.color || DEFAULT_FILL;
    return (!displayColor) ? DEFAULT_FILL : blendWithWhite(displayColor, getMarginIntensity(r.margin ?? 0));
  }, [mapTab, selectedPartyColors, getMarginIntensity]);

  const getFill = useCallback((f: GeoFeature, r?: MapRegion): string => {
    switch (mapTab) {
      case 'demographics': return getFillDemographics(f, r);
      case 'swing': return getFillSwing(f, r);
      case 'insights': return getFillInsights(f, r);
      case 'history': return getFillHistory(f, r);
      default: return getFillDefault(f, r);
    }
  }, [mapTab, getFillDemographics, getFillSwing, getFillInsights, getFillHistory, getFillDefault]);

  useEffect(() => {
    if (!loaded || !geoRef.current || !gRef.current) return;
    const g = gRef.current;
    const pcPaths = g.selectAll<SVGPathElement, GeoFeature>('path.pc');

    g.selectAll('path.hatch-overlay').remove();

    pcPaths
      .on('click', (_event, d) => {
        const region = findRegion(d);
        onRegionClickRef.current(region?.id || normName(featureName(d.properties)).replace(/\s+/g, '_'));
      })
      .on('mousemove', (event: MouseEvent, d) => {
        const el = tooltipRef.current;
        if (!el) return;
        const region = findRegion(d);
        const name = featureName(d.properties);
        const statusColors: Record<string, string> = { 'WON': 'var(--success)', 'LEADING': 'var(--accent)', 'TRAILING': 'var(--text-muted)' };

        el.style.display = 'block';
        el.style.left = `${event.clientX + 12}px`;
        el.style.top = `${event.clientY - 10}px`;
        el.style.borderLeft = region?.partyColor ? `3px solid ${region.partyColor}` : '3px solid var(--border)';

        // Build tooltip safely using textContent (no innerHTML XSS)
        el.textContent = '';
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;gap:3px';
        const nameDiv = document.createElement('div');
        nameDiv.style.cssText = 'font-weight:800;font-size:10px;color:var(--text-secondary);text-transform:uppercase';
        nameDiv.textContent = name;
        wrapper.appendChild(nameDiv);
        if (region?.candidate) {
          const candDiv = document.createElement('div');
          candDiv.style.cssText = 'font-weight:700;font-size:12px;color:var(--text-primary)';
          candDiv.textContent = region.candidate;
          wrapper.appendChild(candDiv);
          const infoDiv = document.createElement('div');
          infoDiv.style.cssText = 'display:flex;align-items:center;gap:5px';
          const partySpan = document.createElement('span');
          partySpan.style.cssText = 'font-size:9px;font-weight:600';
          partySpan.textContent = region.party || '';
          infoDiv.appendChild(partySpan);
          const statusSpan = document.createElement('span');
          statusSpan.style.cssText = `padding:0 5px;border-radius:3px;font-size:8px;font-weight:800;color:#fff;background:${statusColors[region.status!] || 'var(--text-muted)'}`;
          statusSpan.textContent = region.status || '';
          infoDiv.appendChild(statusSpan);
          if (region.margin! > 0) {
            const marginSpan = document.createElement('span');
            marginSpan.style.cssText = 'font-size:10px;font-weight:800';
            marginSpan.textContent = `+${region.margin!.toLocaleString()}`;
            infoDiv.appendChild(marginSpan);
          }
          wrapper.appendChild(infoDiv);
        } else {
          const pendingDiv = document.createElement('div');
          pendingDiv.style.cssText = 'font-size:9px;color:var(--text-muted);font-weight:600';
          pendingDiv.textContent = 'RESULTS PENDING';
          wrapper.appendChild(pendingDiv);
        }
        el.appendChild(wrapper);
      })
      .on('mouseleave', () => { if (tooltipRef.current) tooltipRef.current.style.display = 'none'; });

    pcPaths.each(function (d) {
      const region = findRegion(d);
      const nextFill = getFill(d, region);
      const el = select(this);
      if (this.getAttribute('fill') !== nextFill) el.attr('fill', nextFill);
      if (region?.recentChange) {
        el.classed('pulse', true);
        setTimeout(() => el.classed('pulse', false), 2000);
      }
    });

    if (mapTab === 'insights' && spoilerData.hasData && pathGenRef.current) {
      const spoilerFeatures = (geoRef.current!.features as GeoFeature[]).filter(f => {
        const r = findRegion(f);
        if (!r) return false;

        // If there's a selection, hatching should only apply to relevant seats
        const isRelevantToSelection = selectedPartyColors.size === 0 || 
          (r.party && selectedPartyColors.has(r.party)) || 
          (constCandidates?.get(r.id)?.[1] && selectedPartyColors.has(constCandidates.get(r.id)![1].party_id));

        if (!isRelevantToSelection) return false;
        
        if (spoilerFilter && voteSplits) {
          const cands = constCandidates?.get(r.id);
          if (!cands || cands.length < 2) return false;
          const winner = cands[0];
          const runnerUp = cands[1];
          const margin = winner.votes - runnerUp.votes;
          const filterCand = cands.find(c => c.party_id === spoilerFilter);
          const filterConfig = voteSplits.find(vs => vs.spoiler === spoilerFilter);
          const runnerUpAlliance = partyToAlliance.get(runnerUp.party_id);
          return filterCand && runnerUpAlliance === filterConfig?.hurts && filterCand.votes > margin;
        }
        
        return spoilerData.spoilerSeats.has(r.id);
      });
      g.selectAll<SVGPathElement, GeoFeature>('path.hatch-overlay').data(spoilerFeatures).join('path').attr('class', 'hatch-overlay').attr('d', d => pathGenRef.current!(d) || '').attr('fill', 'url(#spoiler-hatch)').attr('stroke', 'none').attr('pointer-events', 'none');
    }

    if (mapTab !== 'overview') g.selectAll('text.pc-label').attr('opacity', 0);
    else if (svgRef.current && pathGenRef.current) {
      const k = zoomTransform(svgRef.current).k;
      g.selectAll<SVGTextElement, GeoFeature>('text.pc-label').each(function (d) {
        const area = Math.abs(pathGenRef.current!.area(d)) * k * k;
        const el = select(this);
        if (area < 10000) el.attr('opacity', 0);
        else {
          const name = featureName(d.properties);
          el.attr('opacity', 1).attr('font-size', 3 / k).attr('stroke-width', 2.5 / k).text(area < 24000 ? abbreviateName(name) : name);
        }
      });
    }
  }, [loaded, mapTab, findRegion, getFill, spoilerData, svgRef, pathGenRef, spoilerFilter, voteSplits, constCandidates, partyToAlliance]);

  const othersAlliance = useMemo<AllianceDef>(() => {
    const inAlliance = new Set<string>();
    alliances.forEach((a) => a.parties.forEach((p) => inAlliance.add(p)));
    const otherParties = partyList.filter((p) => !inAlliance.has(p.id)).map((p) => p.id);
    return { id: '__others__', name: 'Others', color: '#6b7280', parties: otherParties };
  }, [alliances, partyList]);

  const allAllianceChips = useMemo(() => [...alliances, othersAlliance], [alliances, othersAlliance]);

  const selectedIndividualParties = useMemo(() => {
    const allianceIds = new Set(allAllianceChips.map((a) => a.id));
    return [...selectedIds]
      .filter((id) => !allianceIds.has(id))
      .map((id) => partyList.find((p) => p.id === id))
      .filter((p): p is PartyDef => !!p);
  }, [selectedIds, allAllianceChips, partyList]);

  const filteredParties = useMemo(() => {
    const search = partySearch.toLowerCase();
    return partyList
      .filter((p) => !selectedIds.has(p.id))
      .filter((p) => !search || p.name.toLowerCase().includes(search) || p.id.toLowerCase().includes(search))
      .slice(0, 30);
  }, [partyList, selectedIds, partySearch]);

  const demoCounts = useMemo(() => {
    if (!geoRef.current) return { SC: 0, ST: 0, GEN: 0 };
    const counts = { SC: 0, ST: 0, GEN: 0 };
    for (const f of geoRef.current.features as GeoFeature[]) {
      const cat = featureCategory(f.properties) as keyof typeof counts;
      if (cat in counts) counts[cat]++;
      else counts.GEN++;
    }
    return counts;
  }, [loaded]);

  const statesList = useMemo(() => {
    if (!geoRef.current) return [];
    const counts = new Map<string, number>();
    for (const f of geoRef.current.features as GeoFeature[]) {
      const st = f.properties.st_name;
      counts.set(st, (counts.get(st) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [loaded]);

  const formatStateName = (name: string): string => {
    return name
      .replace(/([A-Z])/g, ' $1').trim()
      .replace(/^./, (c) => c.toUpperCase())
      .replace(/N C T/, 'NCT')
      .replace(/Andamannicobarislands/i, 'A&N Islands');
  };

  const filteredStates = useMemo(() => {
    const search = stateSearch.toLowerCase();
    return statesList
      .filter((s) => !selectedStates.has(s.name))
      .filter((s) => !search || formatStateName(s.name).toLowerCase().includes(search));
  }, [statesList, selectedStates, stateSearch]);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <MapControls
        availableTabs={availableTabs}
        mapTab={mapTab}
        setMapTab={setMapTab}
        isVS={isVS}
        loaded={loaded}
        handleResetZoom={handleResetZoom}
        allAllianceChips={allAllianceChips}
        selectedIds={selectedIds}
        toggleSelection={(id) => {
          const next = new Set(selectedIds);
          if (next.has(id)) next.delete(id); else next.add(id);
          setSelectedIds(next);
        }}
        selectedIndividualParties={selectedIndividualParties}
        filteredParties={filteredParties}
        addParty={(id) => { setSelectedIds(new Set(selectedIds).add(id)); setPartySearch(''); }}
        partySearch={partySearch}
        setPartySearch={setPartySearch}
        demoCategories={DEMO_CATEGORIES}
        selectedCategories={selectedCategories}
        toggleCategory={(cat) => setSelectedCategories(p => {
          const next = new Set(p);
          if (next.has(cat)) next.delete(cat); else next.add(cat);
          return next;
        })}
        demoCounts={demoCounts}
        statesList={statesList}
        selectedStates={selectedStates}
        toggleState={(name) => setSelectedStates(p => {
          const next = new Set(p);
          if (next.has(name)) next.delete(name); else next.add(name);
          return next;
        })}
        stateSearch={stateSearch}
        setStateSearch={setStateSearch}
        formatStateName={formatStateName}
        filteredStates={filteredStates}
      />

      {!loaded && !error && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400, color: 'var(--text-secondary)' }}>
          <div className="spinner" style={{ marginRight: 8 }} />
          Loading map...
        </div>
      )}

      {error && (
        <div className="empty-state" style={{ padding: 32 }}>
          <p>Could not load map data</p>
        </div>
      )}

      {loaded && mapTab === 'states' && !isVS && (
        <div className="states-scroll">
          {selectedStates.size === 0 && (
            <div className="empty-state" style={{ padding: 32, flex: 1 }}>
              <p>Select states above to compare</p>
            </div>
          )}
          {statesList.filter((s) => selectedStates.has(s.name)).map((s) => {
            const stateFeatures = (geoRef.current?.features as GeoFeature[] || []).filter(
              (f) => f.properties.st_name === s.name
            );
            const stateRegions = regions.filter(r => {
              const f = (geoRef.current?.features as GeoFeature[]).find(ff => featureName(ff.properties) === r.name);
              return f && f.properties.st_name === s.name;
            });
            return (
              <StatesMiniMap
                key={s.name}
                stateName={s.name}
                features={stateFeatures}
                regions={stateRegions}
                selectedPartyColors={selectedPartyColors}
                onRegionClick={onRegionClick}
              />
            );
          })}
        </div>
      )}

      {loaded && (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', flex: 1, cursor: 'grab', minHeight: 0, background: MAP_BG, display: mapTab === 'states' ? 'none' : 'block' }}
          role="img"
          aria-label={t('constituency_map')}
        />
      )}

      {loaded && mapTab !== 'states' && (
        <div style={{ padding: '3px 10px 4px', fontSize: 9, textAlign: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
          Click constituency · Scroll to zoom
          {mapTab === 'overview' && regions.length > 0 && ` · ${regions.length} reporting`}
        </div>
      )}

      <MapLegend
        mapTab={mapTab}
        legendEntries={useMemo(() => {
          return [...selectedIds].map(id => {
            const a = allAllianceChips.find(x => x.id === id);
            if (a) return { name: a.id === '__others__' ? 'Others' : a.id, color: a.color };
            const p = partyList.find(x => x.id === id);
            return { name: id, color: p?.color || '#6b7280' };
          });
        }, [selectedIds, allAllianceChips, partyList])}
        marginBuckets={MARGIN_BUCKETS}
        blendWithWhite={blendWithWhite}
        hasSwingData={hasSwingData}
        hasDominanceData={hasDominanceData}
        spoilerData={spoilerData}
      />

      <div
        ref={tooltipRef}
        role="tooltip"
        style={{
          display: 'none', position: 'fixed',
          padding: '6px 10px', 
          background: 'rgba(255, 255, 255, 0.96)', 
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', 
          pointerEvents: 'none', zIndex: 100,
          boxShadow: 'var(--shadow-md)', 
          maxWidth: 220,
          transition: 'opacity 0.1s ease-out'
        }}
      />
    </div>
  );
}
