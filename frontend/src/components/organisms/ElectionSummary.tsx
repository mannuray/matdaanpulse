import { useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMargin } from './summary/utils';
import OverviewSection from './summary/OverviewSection';
import BattleSection from './summary/BattleSection';
import DemographicsSection from './summary/DemographicsSection';
import StatesSection from './summary/StatesSection';
import SwingSection from './summary/SwingSection';
import InsightsSection from './summary/InsightsSection';
import HistorySection from './summary/HistorySection';
import { countDeclared, leaderMargins, median } from './summary/stats';
import type { ElectionSummaryProps, Region, TFunc } from './summary/types';

export type { ElectionSummaryProps };

/** Declared (WON) seat count for badge display */
export function useDeclaredCount(regions: Region[]): number {
  return useMemo(() => countDeclared(regions), [regions]);
}

const ElectionSummary = memo(function ElectionSummary({
  regions,
  electionType = 'LS',
  mapTab,
  selectedIds,
  alliances = [],
  partyList = [],
  swingMap,
  constCandidates,
  voteSplits,
  standings,
  dominanceMap,
  incumbencyData,
  partySwitchData,
  marginTrend,
  partyTrend,
  spoilerFilter,
  onSpoilerFilterChange,
  onRegionClick,
}: ElectionSummaryProps) {
  const { t: _t } = useTranslation();
  const t = _t as TFunc;

  // Margin stats cover every seat with a leader (WON or LEADING); "Declared" counts WON only.
  const margins = useMemo(() => leaderMargins(regions), [regions]);
  const declared = useMemo(() => countDeclared(regions), [regions]);
  const reporting = margins.length;

  const avgMargin = useMemo(() =>
    reporting > 0 ? Math.round(margins.reduce((s, m) => s + m, 0) / reporting) : 0,
    [margins, reporting]
  );

  const medianMargin = useMemo(() => median(margins), [margins]);

  if (reporting === 0) return null;

  const isOverview = !mapTab || mapTab === 'overview';
  const isBattle = mapTab === 'battle';
  const isDemographics = mapTab === 'demographics';
  const isStates = mapTab === 'states' && electionType !== 'VS';
  const isSwing = mapTab === 'swing';
  const isInsights = mapTab === 'insights';
  const isHistory = mapTab === 'history';

  return (
    <div style={{ fontSize: 'var(--text-xs)' }}>
      {/* Quick stats */}
      <div className="es-quick-stats">
        <div className="es-stat">
          <span className="es-stat-value">{declared}</span>
          <span className="es-stat-label">{t('seats_declared', 'Declared')}</span>
        </div>
        <div className="es-stat">
          <span className="es-stat-value">{formatMargin(avgMargin)}</span>
          <span className="es-stat-label">{t('avg_margin', 'Avg Margin')}</span>
        </div>
        <div className="es-stat">
          <span className="es-stat-value">{formatMargin(medianMargin)}</span>
          <span className="es-stat-label">{t('median_margin', 'Median')}</span>
        </div>
      </div>

      <div>
        {isOverview && (
          <OverviewSection
            regions={regions}
            electionType={electionType}
            alliances={alliances}
            standings={standings}
            constCandidates={constCandidates}
            margins={margins}
            onRegionClick={onRegionClick}
            t={t}
          />
        )}

        {isBattle && (
          <BattleSection
            regions={regions}
            electionType={electionType}
            selectedIds={selectedIds || new Set()}
            alliances={alliances}
            partyList={partyList}
            t={t}
          />
        )}

        {isDemographics && (
          <DemographicsSection
            regions={regions}
            alliances={alliances}
            mapTab={mapTab}
            t={t}
          />
        )}

        {isStates && (
          <StatesSection
            regions={regions}
            alliances={alliances}
            electionType={electionType}
            t={t}
          />
        )}

        {isSwing && (
          <SwingSection
            regions={regions}
            alliances={alliances}
            swingMap={swingMap}
            t={t}
          />
        )}

        {isInsights && (
          <InsightsSection
            constCandidates={constCandidates}
            voteSplits={voteSplits}
            alliances={alliances}
            spoilerFilter={spoilerFilter}
            onSpoilerFilterChange={onSpoilerFilterChange}
            onRegionClick={onRegionClick}
            t={t}
          />
        )}

        {isHistory && (
          <HistorySection
            regions={regions}
            partyList={partyList}
            dominanceMap={dominanceMap}
            incumbencyData={incumbencyData}
            partySwitchData={partySwitchData}
            marginTrend={marginTrend}
            partyTrend={partyTrend}
            onRegionClick={onRegionClick}
            t={t}
          />
        )}
      </div>
    </div>
  );
});

export default ElectionSummary;
