import { useMemo } from 'react';
import type { AllianceDef, ResultRow, VoteSplitConfig , TFunc } from './types';
import { Section, formatMargin } from './utils';

interface InsightsSectionProps {
  constCandidates?: Map<string, ResultRow[]>;
  voteSplits?: VoteSplitConfig[];
  alliances: AllianceDef[];
  spoilerFilter?: string | null;
  onSpoilerFilterChange?: (id: string | null) => void;
  onRegionClick?: (id: string) => void;
  t: TFunc;
}

export default function InsightsSection({ 
  constCandidates, voteSplits, alliances, 
  spoilerFilter, onSpoilerFilterChange, onRegionClick,
  t: _t 
}: InsightsSectionProps) {
  const insightsData = useMemo(() => {
    if (!constCandidates || constCandidates.size === 0) return null;

    let hasFullData = false;
    for (const [, cands] of constCandidates) {
      if (cands.length > 2) { hasFullData = true; break; }
    }
    if (!hasFullData) return { hasData: false as const };

    // 1. Setup normalized maps
    const partyToAllianceId = new Map<string, string>();
    const allianceMap = new Map<string, AllianceDef>();
    
    (alliances || []).forEach(a => {
      if (!a) return;
      const aId = a.id.toUpperCase();
      allianceMap.set(aId, a);
      (a.parties || []).forEach(pid => {
        partyToAllianceId.set(pid.toUpperCase(), aId);
      });
    });

    let analyzed = 0;
    let threeWayCount = 0;
    let multiCornered = 0;
    let twoWay = 0;
    const spoilerResults: { config: VoteSplitConfig; seats: { constId: string; winner: string; winnerParty: string; winnerColor: string; margin: number; spoilerVotes: number; beneficiary: string }[] }[] = [];

    if (voteSplits) {
      voteSplits.forEach(vs => {
        spoilerResults.push({ config: vs, seats: [] });
      });
    }

    // 2. Main Analysis Loop
    for (const [constId, cands] of constCandidates) {
      if (!cands || cands.length < 3) continue;
      analyzed++;
      const total = cands.reduce((s, c) => s + (c.votes || 0), 0);
      if (total === 0) continue;

      const thirdShare = (cands[2].votes / total) * 100;
      const topTwoShare = ((cands[0].votes + cands[1].votes) / total) * 100;

      if (topTwoShare >= 80) twoWay++;
      else if (thirdShare >= 15) threeWayCount++;

      const above10 = cands.filter(c => (c.votes / total) * 100 >= 10).length;
      if (above10 >= 3) multiCornered++;

      if (voteSplits && voteSplits.length > 0) {
        const winner = cands[0];
        const runnerUp = cands[1];
        const winnerMargin = winner.votes - runnerUp.votes;
        
        const runnerUpPartyId = runnerUp.party_id.toUpperCase();
        const runnerUpAllianceId = partyToAllianceId.get(runnerUpPartyId);

        spoilerResults.forEach((sr) => {
          const vs = sr.config;
          const vsHurts = vs.hurts.toUpperCase();
          const vsSpoiler = vs.spoiler.toUpperCase();
          
          // Match if split config targets the runner-up party directly OR its alliance
          const matchesHurts = (vsHurts === runnerUpPartyId) || (runnerUpAllianceId && vsHurts === runnerUpAllianceId);
          if (!matchesHurts) return;

          const spoilerCand = cands.find(c => c.party_id.toUpperCase() === vsSpoiler);
          if (!spoilerCand) return;

          // Cumulative logic for THIS specific beneficiary alliance/party
          const allianceSplitters = voteSplits.filter(v => v.hurts.toUpperCase() === vsHurts);
          const cumulativeSplitVotes = allianceSplitters.reduce((sum, v) => {
            const cand = cands.find(c => c.party_id.toUpperCase() === v.spoiler.toUpperCase());
            return sum + (cand?.votes || 0);
          }, 0);

          const isIndividualSpoiler = spoilerCand.votes > winnerMargin;
          const isPartOfCumulativeSpoiler = cumulativeSplitVotes > winnerMargin;

          if (isIndividualSpoiler || isPartOfCumulativeSpoiler) {
            const shortName = constId.replace(/^[A-Z]{2}_(?:VS\d*_)?(?:\d+_)?/, '').replace(/_/g, ' ');
            const winnerPartyId = winner.party_id.toUpperCase();
            const winnerAlId = partyToAllianceId.get(winnerPartyId);
            const winnerAl = winnerAlId ? allianceMap.get(winnerAlId) : null;
            
            sr.seats.push({
              constId,
              winner: shortName,
              winnerParty: winnerAl?.name || winner.party_id,
              winnerColor: winnerAl?.color || '#6b7280',
              margin: winnerMargin,
              spoilerVotes: spoilerCand.votes,
              beneficiary: allianceMap.get(vsHurts)?.name || vs.hurts,
            });
          }
        });
      }
    }

    spoilerResults.forEach(sr => {
      sr.seats.sort((a, b) => a.margin - b.margin);
    });

    const uniqueSpoilerSeats = new Set<string>();
    spoilerResults.forEach(sr => sr.seats.forEach(s => uniqueSpoilerSeats.add(s.constId)));

    return {
      hasData: true as const,
      analyzed,
      threeWayCount,
      multiCornered,
      twoWay,
      totalSpoilerSeats: uniqueSpoilerSeats.size,
      spoilerResults,
    };
  }, [constCandidates, voteSplits, alliances]);

  if (!insightsData || !insightsData.hasData) {
    return <p className="es-hint">Spoiler analysis requires full candidate data (available for Bihar 2025+).</p>;
  }

  const toggleFilter = (partyId: string) => {
    if (onSpoilerFilterChange) {
      onSpoilerFilterChange(spoilerFilter === partyId ? null : partyId);
    }
  };

  return (
    <>
      <Section label="Vote Split Analysis" defaultOpen>
        <div className="es-quick-stats" style={{ marginBottom: 4 }}>
          <div className="es-stat">
            <span className="es-stat-value">{insightsData.analyzed}</span>
            <span className="es-stat-label">Analyzed</span>
          </div>
          <div className="es-stat">
            <span className="es-stat-value">{insightsData.threeWayCount}</span>
            <span className="es-stat-label">Three-way</span>
          </div>
          <div className="es-stat">
            <span className="es-stat-value">{insightsData.totalSpoilerSeats}</span>
            <span className="es-stat-label">Spoiler-affected</span>
          </div>
        </div>
      </Section>

      {insightsData.spoilerResults.map((sr) => (
        sr.seats.length > 0 && (
          <Section 
            key={sr.config.spoiler} 
            label={sr.config.label} 
            count={sr.seats.length} 
            defaultOpen={spoilerFilter === sr.config.spoiler}
          >
            <div style={{ padding: '4px 8px 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  Hurting <strong>{sr.config.hurts}</strong>
                </span>
                <button 
                  onClick={() => toggleFilter(sr.config.spoiler)}
                  className={`btn btn-xs ${spoilerFilter === sr.config.spoiler ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: 9, height: 20, padding: '0 8px' }}
                >
                  {spoilerFilter === sr.config.spoiler ? 'SHOW ALL' : 'MAP FILTER'}
                </button>
              </div>

              <table className="es-table">
                <thead>
                  <tr>
                    <th>Seat</th>
                    <th>Winner</th>
                    <th style={{ textAlign: 'right' }}>Margin</th>
                    <th style={{ textAlign: 'right' }}>{sr.config.spoiler}</th>
                  </tr>
                </thead>
                <tbody>
                  {sr.seats.slice(0, 10).map((s) => (
                    <tr 
                      key={s.constId} 
                      style={{ 
                        background: spoilerFilter === sr.config.spoiler ? 'var(--bg-secondary)' : 'transparent',
                        cursor: onRegionClick ? 'pointer' : 'default'
                      }}
                      onClick={() => onRegionClick?.(s.constId)}
                    >
                      <td className="es-name" style={{ fontSize: 10 }}>{s.winner}</td>
                      <td style={{ fontSize: 10 }}><span className="es-dot" style={{ background: s.winnerColor }} /> {s.winnerParty}</td>
                      <td className="es-margin" style={{ fontSize: 10 }}>{formatMargin(s.margin)}</td>
                      <td className="es-margin" style={{ fontSize: 10, color: s.spoilerVotes > s.margin ? 'var(--danger)' : 'inherit', fontWeight: s.spoilerVotes > s.margin ? 700 : 400 }}>{formatMargin(s.spoilerVotes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sr.seats.length > 10 && (
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                  + {sr.seats.length - 10} more seats
                </div>
              )}
            </div>
          </Section>
        )
      ))}

      <Section label="Seat Classification">
        <table className="es-table">
          <tbody>
            <tr>
              <td style={{ fontSize: 10 }}>Two-way (top 2 have 80%+ combined)</td>
              <td className="es-margin">{insightsData.twoWay}</td>
            </tr>
            <tr>
              <td style={{ fontSize: 10 }}>Three-way (3rd place 15%+)</td>
              <td className="es-margin">{insightsData.threeWayCount}</td>
            </tr>
            <tr>
              <td style={{ fontSize: 10 }}>Multi-cornered (3+ above 10%)</td>
              <td className="es-margin">{insightsData.multiCornered}</td>
            </tr>
          </tbody>
        </table>
      </Section>
    </>
  );
}
