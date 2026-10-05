import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useApi } from '../data/useApi';
import { useTheme } from '../theme/useTheme';
import { getElections, getManifest, getRegionShares } from '../../model/api/election.service';
import { compareRegions, type Alliance, type RegionRow } from '../../model/derive/regionComparison';
import { forTheme } from '../../model/derive/themeColor';

export type RegionMode = 'party' | 'alliance';

export interface RegionComparisonVM {
  /** The year compared with, or null when the state has no earlier election. */
  prevYear: number | null;
  curYear: number;
  /** Boundaries were redrawn since the previous election: regions compare only approximately. */
  approximate: boolean;
  mode: RegionMode;
  onMode(m: RegionMode): void;
  rows: RegionRow[];
}

/**
 * The Regions tab of a Vidhan Sabha election whose seats carry regions: statewide and per region, by party (default) or
 * alliance, against the state's previous election. Null while loading and when the seats have no regions.
 */
export function useRegionComparisonVM(): RegionComparisonVM | null {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const src = useSources();
  const election = src.election;
  const [mode, setMode] = useState<RegionMode>('party');
  const isVS = election.type === 'VS';
  const list = useApi(() => (isVS ? getElections({ type: 'VS', state_id: election.state_id ?? undefined }).catch(() => []) : Promise.resolve([])), [election.id]);
  const prev = useMemo(() => (list.data ?? [])
    .filter(e => e.type === election.type && e.state_id === election.state_id && e.year < election.year)
    .sort((a, b) => b.year - a.year)[0] ?? null, [list.data, election]);
  const cur = useApi(() => (isVS ? getRegionShares(election.id).catch(() => null) : Promise.resolve(null)), [election.id]);
  const old = useApi(() => (prev ? getRegionShares(prev.id).catch(() => null) : Promise.resolve(null)), [prev?.id]);
  const oldManifest = useApi(() => (prev ? getManifest(prev.id).catch(() => null) : Promise.resolve(null)), [prev?.id]);
  const curAlliances = useMemo(() => (src.data.manifestData?.alliances ?? []) as Alliance[], [src.data.manifestData]);
  return useMemo(() => {
    if (!cur.data || cur.data.regions.length === 0 || list.loading || (prev && (old.loading || oldManifest.loading))) return null;
    const labels = { statewide: t('regions_statewide', 'Statewide'), others: t('regions_others', 'Others') };
    const prevShares = prev && old.data && old.data.regions.length ? old.data : null;
    const partyMeta = new Map([...src.partyMeta].map(([id, m]) => [id, { label: m.abbreviation ?? id, color: src.data.partyColorMap.get(id) ?? m.color ?? 'var(--color-fallback)' }]));
    const prevAlliances = ((oldManifest.data?.draft?.alliances ?? []) as Alliance[]).map(a => ({ ...a, color: theme === 'dark' ? a.color : forTheme(a.color, theme) }));
    const rows = compareRegions(cur.data, prevShares, mode === 'party'
      ? { mode: 'party', partyMeta, labels }
      : { mode: 'alliance', curAlliances, prevAlliances, labels });
    return {
      prevYear: prevShares ? prev!.year : null,
      curYear: election.year,
      approximate: !!(prevShares && prev!.delimitation && election.delimitation && prev!.delimitation !== election.delimitation),
      mode, onMode: setMode, rows,
    };
  }, [cur.data, list.loading, prev, old.loading, old.data, oldManifest.loading, oldManifest.data, curAlliances, src.partyMeta, src.data.partyColorMap, mode, theme, t, election.year, election.delimitation]);
}
