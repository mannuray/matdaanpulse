import { useTranslation } from 'react-i18next';
import type { TopBarVM } from '../../viewmodels/tiles/useTopBarVM';
import type { SearchVM } from '../../viewmodels/tiles/useSearchVM';
import type { ScoreboardVM } from '../../viewmodels/tiles/useScoreboardVM';
import type { StandingsVM } from '../../viewmodels/tiles/useStandingsVM';
import type { SummaryVM } from '../../viewmodels/tiles/useSummaryVM';
import type { LayerInsightVM } from '../../viewmodels/tiles/useLayerInsightVM';
import type { LeadersVM } from '../../viewmodels/tiles/useLeadersVM';
import type { StatsVM } from '../../viewmodels/tiles/useStatsVM';
import type { MapVM } from '../../viewmodels/tiles/useMapVM';
import type { SeatPanelVM } from '../../viewmodels/tiles/useSeatPanelVM';
import type { FocusTile } from '../../viewmodels/store/dashboardStore';
import { useState } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { TopBar } from './TopBar';
import { ScoreboardTile } from './ScoreboardTile';
import { StandingsTile, WatchlistPreview, type StandingsTab } from './StandingsTile';
import { LayerInsightStrip } from './LayerInsightStrip';
import { LeadersStrip } from './LeadersStrip';
import { StatsStrip } from './StatsStrip';
import { FocusOverlay } from './FocusOverlay';
import { MobileCardRail } from './MobileCardRail';
import { MapTile } from '../map/MapTile';
import { SeatPanel } from '../map/SeatPanel';

export interface DashboardViewProps {
  topBar: TopBarVM; search: SearchVM; scoreboard: ScoreboardVM; standings: StandingsVM; insight: LayerInsightVM; summary?: SummaryVM;
  leaders: LeadersVM; stats: StatsVM; map: MapVM; seatPanel: SeatPanelVM | null;
  focus: FocusTile | null; onCloseFocus(): void;
}

export function DashboardGrid(p: DashboardViewProps) {
  const { t } = useTranslation();
  const [standingsTab, setStandingsTab] = useState<StandingsTab>('parties');
  const desktop = useMediaQuery('(min-width: 1024px)');
  const titles: Record<FocusTile, string> = {
    map: t('constituency_map'), scoreboard: t('studio_results'), standings: t('party_standings'),
    insight: t(`map_tab_${p.insight.layer}`), leaders: t('studio_key_leaders'), stats: t('studio_stats'),
  };
  const overlay = (
    <FocusOverlay tile={p.focus} titles={titles} onClose={p.onCloseFocus} render={tile => {
      switch (tile) {
        case 'map': return <MapTile vm={p.map} variant="focus" seatPanel={<SeatPanel vm={p.seatPanel} />} />;
        case 'scoreboard': return <ScoreboardTile vm={p.scoreboard} variant="focus" />;
        case 'standings': return <StandingsTile vm={p.standings} variant="focus" watchlist={p.leaders} initialTab={standingsTab} />;
        case 'insight': return <LayerInsightStrip vm={p.insight} variant="focus" />;
        case 'leaders': return <LeadersStrip vm={p.leaders} variant="focus" />;
        case 'stats': return <StatsStrip vm={p.stats} variant="focus" />;
      }
    }} />
  );

  if (!desktop) {
    return (
      <div className="studio-root flex h-dvh w-screen flex-col gap-2 overflow-hidden pt-2">
        <div className="px-3"><TopBar vm={p.topBar} search={p.search} compact /></div>
        <div className="px-3"><div className="rounded-tile border border-line bg-tile p-3"><ScoreboardTile vm={p.scoreboard} variant="compact" /></div></div>
        <div className="min-h-0 flex-1 px-3"><MapTile vm={p.map} variant="tile" /></div>
        <MobileCardRail cards={[
          { id: 'insight', title: titles.insight, node: <LayerInsightStrip vm={p.insight} variant="tile" />, onOpen: p.insight.onFocus },
          { id: 'standings', title: titles.standings, node: <StandingsTile vm={p.standings} variant="focus" />, onOpen: () => { setStandingsTab('parties'); p.standings.onFocus(); } },
          { id: 'watchlist', title: t('studio_tab_watchlist', { count: p.leaders.watchlist.length }), node: <WatchlistPreview vm={p.leaders} />, onOpen: () => { setStandingsTab('watchlist'); p.standings.onFocus(); } },
          { id: 'leaders', title: titles.leaders, node: <LeadersStrip vm={p.leaders} variant="tile" />, onOpen: p.leaders.onFocus },
          { id: 'stats', title: titles.stats, node: <StatsStrip vm={p.stats} variant="tile" />, onOpen: p.stats.onFocus },
        ]} />
        {overlay}
      </div>
    );
  }

  return (
    <div className="studio-root grid h-screen w-screen grid-cols-[minmax(0,1.4fr)_minmax(340px,1fr)] grid-rows-[48px_minmax(0,1fr)_64px_64px] gap-3 overflow-hidden p-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)]">
      <div className="col-span-2"><TopBar vm={p.topBar} search={p.search} /></div>
      <MapTile vm={p.map} variant="tile" footer={<LayerInsightStrip vm={p.insight} variant="footer" />} />
      <div className="grid min-h-0 grid-rows-[148px_minmax(0,1fr)] gap-3">
        <ScoreboardTile vm={p.scoreboard} variant="tile" />
        <StandingsTile vm={p.standings} variant="tile" watchlist={p.leaders} summary={p.summary} />
      </div>
      <div className="col-span-2 grid min-h-0"><LeadersStrip vm={p.leaders} variant="tile" /></div>
      <div className="col-span-2 grid min-h-0"><StatsStrip vm={p.stats} variant="tile" /></div>
      {overlay}
    </div>
  );
}
