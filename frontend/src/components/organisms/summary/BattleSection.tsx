import { useMemo } from 'react';
import { Section, formatMargin, LS_BUCKETS, VS_BUCKETS } from './utils';
import type { Region, AllianceDef, PartyDef , TFunc } from './types';

interface BattleSectionProps {
  regions: Region[];
  electionType: 'LS' | 'VS';
  selectedIds: Set<string>;
  alliances: AllianceDef[];
  partyList: PartyDef[];
  t: TFunc;
}

export default function BattleSection({ regions, electionType, selectedIds, alliances, partyList, t }: BattleSectionProps) {
  const buckets = electionType === 'VS' ? VS_BUCKETS : LS_BUCKETS;
  const closeThreshold = electionType === 'VS' ? 1000 : 5000;

  // Battle mode: determine selected entries
  const battleEntries = useMemo(() => {
    if (!selectedIds || selectedIds.size === 0) return [];
    const entries: { id: string; name: string; color: string; partyIds: Set<string> }[] = [];
    for (const id of selectedIds) {
      const alliance = alliances.find((a) => a.id === id);
      if (alliance) {
        entries.push({ id: alliance.id, name: alliance.name, color: alliance.color, partyIds: new Set(alliance.parties) });
      } else {
        const party = partyList.find((p) => p.id === id);
        if (party) {
          entries.push({ id: party.id, name: party.name, color: party.color, partyIds: new Set([party.id]) });
        }
      }
    }
    return entries;
  }, [selectedIds, alliances, partyList]);

  const isBattleGrouped = battleEntries.length > 0;

  // Grouped histogram
  const groupedHistogram = useMemo(() => {
    if (!isBattleGrouped) return [];
    // Pre-bucket each region by entry, then aggregate
    // entryIdx -> bucketIdx -> count
    const grid = battleEntries.map(() => new Array(buckets.length).fill(0) as number[]);
    for (const r of regions) {
      if (r.margin == null || !r.party) continue;
      const ei = battleEntries.findIndex((e) => e.partyIds.has(r.party!));
      if (ei < 0) continue;
      for (let bi = 0; bi < buckets.length; bi++) {
        if (r.margin < buckets[bi].max || bi === buckets.length - 1) {
          grid[ei][bi]++;
          break;
        }
      }
    }
    // Transpose: bucket -> entry counts
    return buckets.map((_, bi) => battleEntries.map((_, ei) => grid[ei][bi]));
  }, [isBattleGrouped, battleEntries, regions, buckets]);

  const maxGroupedBucket = useMemo(() => {
    if (!isBattleGrouped) return 1;
    let max = 1;
    for (const counts of groupedHistogram) {
      for (const c of counts) {
        if (c > max) max = c;
      }
    }
    return max;
  }, [isBattleGrouped, groupedHistogram]);

  // Seat summary
  const battleSeatSummary = useMemo(() => {
    if (!isBattleGrouped) return [];
    return battleEntries.map((entry) => {
      let seats = 0;
      let closeWins = 0;
      let totalMargin = 0;
      for (const r of regions) {
        if (r.margin == null || !r.party) continue;
        if (!entry.partyIds.has(r.party)) continue;
        seats++;
        totalMargin += r.margin;
        if (r.margin < closeThreshold) closeWins++;
      }
      return {
        id: entry.id,
        name: entry.name,
        color: entry.color,
        seats,
        closeWins,
        avgMargin: seats > 0 ? Math.round(totalMargin / seats) : 0,
      };
    });
  }, [isBattleGrouped, battleEntries, regions, closeThreshold]);

  // Closest contests
  const battleClosest = useMemo(() => {
    if (!isBattleGrouped) return [];
    const allPartyIds = new Set<string>();
    for (const entry of battleEntries) {
      for (const pid of entry.partyIds) allPartyIds.add(pid);
    }
    const partyToEntry = new Map<string, { name: string; color: string }>();
    for (const entry of battleEntries) {
      for (const pid of entry.partyIds) {
        partyToEntry.set(pid, { name: entry.name, color: entry.color });
      }
    }
    return regions
      .filter(r => r.margin != null && r.party && allPartyIds.has(r.party))
      .sort((a, b) => a.margin! - b.margin!)
      .slice(0, 5)
      .map(r => ({
        ...r,
        entryName: partyToEntry.get(r.party!)?.name || r.party!,
        entryColor: partyToEntry.get(r.party!)?.color || r.partyColor || '#6b7280',
      }));
  }, [isBattleGrouped, battleEntries, regions]);

  // Head-to-Head computations (when exactly 2 battle entries selected)
  const h2hStats = useMemo(() => {
    if (battleEntries.length !== 2) return null;
    const [a, b] = battleEntries;
    let aSeats = 0, bSeats = 0;
    let aMarginSum = 0, bMarginSum = 0;
    let directContests = 0;
    let aDirectWins = 0, bDirectWins = 0;
    const closestH2H: { name: string; winner: string; winnerColor: string; margin: number }[] = [];

    for (const r of regions) {
      if (r.margin == null || !r.party) continue;
      if (a.partyIds.has(r.party)) { aSeats++; aMarginSum += r.margin; }
      if (b.partyIds.has(r.party)) { bSeats++; bMarginSum += r.margin; }
    }

    // "Direct contests" — seats won by A or B
    for (const r of regions) {
      if (r.margin == null || !r.party) continue;
      const isA = a.partyIds.has(r.party);
      const isB = b.partyIds.has(r.party);
      if (!isA && !isB) continue;
      directContests++;
      if (isA) aDirectWins++;
      if (isB) bDirectWins++;
      closestH2H.push({
        name: r.name.replace(/_/g, ' '),
        winner: isA ? a.name : b.name,
        winnerColor: isA ? a.color : b.color,
        margin: r.margin,
      });
    }
    closestH2H.sort((a, b) => a.margin - b.margin);

    return {
      a: { name: a.name, color: a.color, seats: aSeats, avgMargin: aSeats > 0 ? Math.round(aMarginSum / aSeats) : 0, directWins: aDirectWins },
      b: { name: b.name, color: b.color, seats: bSeats, avgMargin: bSeats > 0 ? Math.round(bMarginSum / bSeats) : 0, directWins: bDirectWins },
      directContests,
      closestH2H: closestH2H.slice(0, 10),
    };
  }, [battleEntries, regions]);

  return (
    <>
      {isBattleGrouped ? (
        <>
          <Section label={t('margin_distribution', 'Margin Distribution')} defaultOpen>
            <div className="es-histogram-v">
              {buckets.map((b, bi) => (
                <div key={b.label} className="es-histogram-col">
                  <div className="es-histogram-bar-bg-v">
                    <div className="es-histogram-bar-group">
                      {battleEntries.map((entry, ei) => {
                        const count = groupedHistogram[bi]?.[ei] ?? 0;
                        return (
                          <div key={entry.id} className="es-histogram-bar-grouped" style={{ height: `${(count / maxGroupedBucket) * 100}%`, background: entry.color }}>
                            {count > 0 && <span className="es-histogram-bar-count">{count}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <span className="es-histogram-label-v">{b.label}</span>
                </div>
              ))}
            </div>
            <div className="es-histogram-legend">
              {battleEntries.map((entry) => (
                <span key={entry.id} className="es-histogram-legend-item">
                  <span className="es-dot" style={{ background: entry.color }} />
                  {entry.name}
                </span>
              ))}
            </div>
          </Section>

          <Section label={t('seat_summary', 'Seat Summary')} defaultOpen>
            <table className="es-table es-battle-summary">
              <thead>
                <tr>
                  <th></th>
                  <th>{t('seats', 'Seats')}</th>
                  <th>{t('close_wins', `Close (<${formatMargin(closeThreshold)})`)}</th>
                  <th>{t('avg', 'Avg')}</th>
                </tr>
              </thead>
              <tbody>
                {battleSeatSummary.map(e => (
                  <tr key={e.id}>
                    <td><span className="es-dot" style={{ background: e.color }} /> {e.name}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{e.seats}</td>
                    <td style={{ textAlign: 'center' }}>{e.closeWins}</td>
                    <td style={{ textAlign: 'right' }}>{formatMargin(e.avgMargin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {battleClosest.length > 0 && (
            <Section label={t('closest_contests', 'Closest Contests')} count={battleClosest.length}>
              <table className="es-table">
                <tbody>
                  {battleClosest.map((r, i) => (
                    <tr key={r.id}>
                      <td className="es-rank">{i + 1}</td>
                      <td><span className="es-dot" style={{ background: r.entryColor }} /></td>
                      <td className="es-name">{r.name.replace(/_/g, ' ')}</td>
                      <td className="es-margin">{formatMargin(r.margin!)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </>
      ) : (
        <p className="es-hint">{t('battle_hint', 'Select alliances above to compare')}</p>
      )}

      {/* Head-to-Head (exactly 2 selected) */}
      {h2hStats && (
        <Section label={`H2H: ${h2hStats.a.name} vs ${h2hStats.b.name}`} defaultOpen>
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'space-around', margin: 'var(--space-2) 0', padding: 'var(--space-2)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: h2hStats.a.color }}>{h2hStats.a.seats}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase' }}>{h2hStats.a.name}</div>
            </div>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '10px', alignSelf: 'center', fontWeight: 'var(--weight-bold)' }}>VS</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: h2hStats.b.color }}>{h2hStats.b.seats}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase' }}>{h2hStats.b.name}</div>
            </div>
          </div>
          <table className="es-table">
            <tbody>
              <tr>
                <td style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'var(--weight-bold)' }}>Avg Margin</td>
                <td style={{ textAlign: 'center', fontWeight: 'var(--weight-bold)', color: h2hStats.a.color }}>{formatMargin(h2hStats.a.avgMargin)}</td>
                <td style={{ textAlign: 'center', fontWeight: 'var(--weight-bold)', color: h2hStats.b.color }}>{formatMargin(h2hStats.b.avgMargin)}</td>
              </tr>
            </tbody>
          </table>
          {h2hStats.closestH2H.length > 0 && (
            <>
              <div style={{ fontSize: '9px', fontWeight: 'var(--weight-bold)', color: 'var(--text-secondary)', marginTop: 'var(--space-3)', marginBottom: 'var(--space-1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Closest H2H Battles</div>
              <table className="es-table">
                <tbody>
                  {h2hStats.closestH2H.slice(0, 5).map((h, i) => (
                    <tr key={i}>
                      <td className="es-rank">{i + 1}</td>
                      <td><span className="es-dot" style={{ background: h.winnerColor }} /></td>
                      <td className="es-name">{h.name}</td>
                      <td className="es-margin">{formatMargin(h.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Section>
      )}
    </>
  );
}
