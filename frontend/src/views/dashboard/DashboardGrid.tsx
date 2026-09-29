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
import { StandingsTile, StandingsPreview, WatchlistPreview, type StandingsTab } from './StandingsTile';
import { LayerInsightStrip } from './LayerInsightStrip';
import { SummaryFocus } from './SummaryFocus';
import { SummaryPreview } from './SummaryTab';
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
    map: t('constituency_map'), scoreboard: t('studio_results'), standings: t(standingsTab === 'watchlist' ? 'studio_title_watchlist' : 'party_standings'),
    insight: t('studio_title_summary'), leaders: t('studio_key_leaders'), stats: t('studio_stats'),
  };
  const overlay = (
    <FocusOverlay tile={p.focus} titles={titles} onClose={p.onCloseFocus} render={tile => {
      switch (tile) {
        case 'map': return <MapTile vm={p.map} variant="focus" seatPanel={<SeatPanel vm={p.seatPanel} />} />;
        case 'scoreboard': return <ScoreboardTile vm={p.scoreboard} variant="focus" />;
        case 'standings': return <StandingsTile vm={p.standings} variant="focus" watchlist={p.leaders} initialTab={standingsTab} onTabChange={setStandingsTab} />;
        case 'insight': return p.summary ? <SummaryFocus vm={p.summary} /> : null;
        case 'leaders': return <LeadersStrip vm={p.leaders} variant="focus" />;
        case 'stats': return <StatsStrip vm={p.stats} variant="focus" />;
      }
    }} />
  );

  if (!desktop) {
    return (
      <div className="studio-root flex h-dvh w-screen flex-col gap-2 overflow-hidden pt-2">
        <div className="shrink-0 px-3"><TopBar vm={p.topBar} search={p.search} compact /></div>
        <div className="shrink-0 px-3"><div data-mobile-scoreboard className="rounded-tile border border-line bg-tile p-3"><ScoreboardTile vm={p.scoreboard} variant="compact" /></div></div>
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] px-3"><MapTile vm={p.map} variant="tile" stackActions /></div>
        <MobileCardRail cards={[
          { id: 'insight', title: titles.insight, node: p.summary ? <SummaryPreview vm={p.summary} /> : <LayerInsightStrip vm={p.insight} variant="tile" />, onOpen: p.summary?.onFocus ?? p.insight.onFocus },
          { id: 'standings', title: t('party_standings'), node: <StandingsPreview vm={p.standings} />, onOpen: () => { setStandingsTab('parties'); p.standings.onFocus(); } },
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
        <StandingsTile vm={p.standings} variant="tile" watchlist={p.leaders} summary={p.summary} onTabChange={setStandingsTab} />
      </div>
      <div className="col-span-2 grid min-h-0"><LeadersStrip vm={p.leaders} variant="tile" /></div>
      <div className="col-span-2 grid min-h-0"><StatsStrip vm={p.stats} variant="tile" /></div>
      {overlay}
    </div>
  );
}
