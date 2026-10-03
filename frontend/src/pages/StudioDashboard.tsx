import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useElection } from '../viewmodels/data/useElection';
import { useDashboardSources } from '../viewmodels/sources/useDashboardSources';
import { DashboardSourcesProvider } from '../viewmodels/sources/DashboardSourcesProvider';
import { DashboardStoreProvider, useDashboardStore } from '../viewmodels/store/DashboardStoreProvider';
import { useTopBarVM } from '../viewmodels/tiles/useTopBarVM';
import { useSearchVM } from '../viewmodels/tiles/useSearchVM';
import { useScoreboardVM } from '../viewmodels/tiles/useScoreboardVM';
import { useStandingsVM } from '../viewmodels/tiles/useStandingsVM';
import { useLayerInsightVM } from '../viewmodels/tiles/useLayerInsightVM';
import { useSummaryVM } from '../viewmodels/tiles/useSummaryVM';
import { useRegionComparisonVM } from '../viewmodels/tiles/useRegionComparisonVM';
import { useLeadersVM } from '../viewmodels/tiles/useLeadersVM';
import { useStatsVM } from '../viewmodels/tiles/useStatsVM';
import { useMapVM } from '../viewmodels/tiles/useMapVM';
import { useSeatDialogVM } from '../viewmodels/tiles/useSeatDialogVM';
import { usePartyDialogVM } from '../viewmodels/tiles/usePartyDialogVM';
import { DashboardGrid } from '../views/dashboard/DashboardGrid';
import type { Election } from '../model/types';

function Wall() {
  const { state, dispatch } = useDashboardStore();
  const topBar = useTopBarVM();
  const search = useSearchVM(topBar.electionId, topBar.onSearchSeat);
  return (
    <DashboardGrid
      topBar={topBar} search={search}
      scoreboard={useScoreboardVM()} standings={useStandingsVM()} insight={useLayerInsightVM()} summary={useSummaryVM()} regions={useRegionComparisonVM()}
      leaders={useLeadersVM()} stats={useStatsVM()} map={useMapVM()} seatDialog={useSeatDialogVM()} partyDialog={usePartyDialogVM()}
      focus={state.focus} onCloseFocus={() => dispatch({ type: 'focus', tile: null })}
    />
  );
}

function Loaded({ election }: { election: Election }) {
  const sources = useDashboardSources(election);
  const { t } = useTranslation();
  const knownParties = useMemo(() => (sources.partyMeta.size ? new Set(sources.partyMeta.keys()) : null), [sources.partyMeta]);
  const knownSeats = useMemo(() => (sources.data.mapRegions.length ? new Set(sources.data.mapRegions.map(r => r.id)) : null), [sources.data.mapRegions]);
  if (sources.data.error && sources.data.mapRegions.length === 0) {
    return (
      <div className="studio-root grid h-screen place-items-center">
        <div className="text-center"><p className="font-semibold text-live">{t('failed_to_load_election')}</p>
          <button type="button" onClick={sources.data.refreshAll} className="mt-3 rounded-full border border-line px-4 py-1.5 text-sm">{t('retry')}</button></div>
      </div>
    );
  }
  return (
    <DashboardSourcesProvider value={sources}>
      <DashboardStoreProvider allowedLayers={sources.availableLayers} knownSeats={knownSeats} knownParties={knownParties}>
        <Wall />
      </DashboardStoreProvider>
    </DashboardSourcesProvider>
  );
}

export default function StudioDashboard() {
  const { election } = useElection();
  const { t } = useTranslation();
  if (!election) return <div className="studio-root grid h-screen place-items-center text-muted">{t('studio_no_elections')}</div>;
  return <Loaded key={election.id} election={election} />;
}
