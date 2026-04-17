import { useMemo } from 'react';
import type { Region, PartyDef, DominanceEntry, IncumbencyEntry, PartySwitchEntry, MarginTrendPoint, PartyTrendPoint , TFunc } from './types';
import { Section, formatMargin } from './utils';

interface HistorySectionProps {
  regions: Region[];
  partyList: PartyDef[];
  dominanceMap?: Map<string, DominanceEntry>;
  incumbencyData?: IncumbencyEntry[];
  partySwitchData?: PartySwitchEntry[];
  marginTrend?: MarginTrendPoint[];
  partyTrend?: PartyTrendPoint[];
  onRegionClick?: (id: string) => void;
  t: TFunc;
}

export default function HistorySection({ regions, partyList, dominanceMap, incumbencyData, partySwitchData, marginTrend, partyTrend, t: _t }: HistorySectionProps) {
  const partyMap = useMemo(() => {
    const m = new Map<string, PartyDef>();
    for (const p of partyList) m.set(p.id, p);
    return m;
  }, [partyList]);

  const regionMap = useMemo(() => {
    const m = new Map<string, Region>();
    for (const r of regions) m.set(r.id, r);
    return m;
  }, [regions]);

  return (
    <>
      <DominanceSection dominanceMap={dominanceMap} partyMap={partyMap} regionMap={regionMap} />
      <IncumbencySection incumbencyData={incumbencyData} partyMap={partyMap} />
      <PartySwitcherSection partySwitchData={partySwitchData} partyMap={partyMap} />
      <MarginTrendSection marginTrend={marginTrend} partyTrend={partyTrend} partyMap={partyMap} />
    </>
  );
}

// ─── Dominance ────────────────────────────────────────────────────────────────

function DominanceSection({ dominanceMap, partyMap, regionMap }: {
  dominanceMap?: Map<string, DominanceEntry>;
  partyMap: Map<string, PartyDef>;
  regionMap: Map<string, Region>;
}) {
  const stats = useMemo(() => {
    if (!dominanceMap || dominanceMap.size === 0) return null;
    let strongholds = 0, loyal = 0, swing = 0, newSeats = 0;
    const partyBreakdown = new Map<string, { stronghold: number; loyal: number; total: number }>();

    for (const [, dom] of dominanceMap) {
      if (dom.classification === 'stronghold') {
        strongholds++;
        if (dom.dominantParty) {
          const entry = partyBreakdown.get(dom.dominantParty) || { stronghold: 0, loyal: 0, total: 0 };
          entry.stronghold++; entry.total++;
          partyBreakdown.set(dom.dominantParty, entry);
        }
      } else if (dom.classification === 'loyal') {
        loyal++;
        if (dom.dominantParty) {
          const entry = partyBreakdown.get(dom.dominantParty) || { stronghold: 0, loyal: 0, total: 0 };
          entry.loyal++; entry.total++;
          partyBreakdown.set(dom.dominantParty, entry);
        }
      } else if (dom.classification === 'swing') { swing++; }
      else { newSeats++; }
    }

    const partyRows = [...partyBreakdown.entries()]
      .map(([party, counts]) => {
        const p = partyMap.get(party);
        return { party, name: p?.name || party, color: p?.color || '#6b7280', ...counts };
      })
      .sort((a, b) => b.total - a.total);

    const swingSeats = [...dominanceMap.values()]
      .filter(d => d.classification === 'swing')
      .map(d => {
        const reg = regionMap.get(d.constId);
        return { constId: d.constId, name: d.constId.replace(/^[A-Z]{2}_(?:VS\d*_)?(?:\d+_)?/, '').replace(/_/g, ' '), partyColor: reg?.partyColor || '#6b7280', winners: d.winners };
      });

    return { strongholds, loyal, swing, newSeats, partyRows, swingSeats };
  }, [dominanceMap, partyMap, regionMap]);

  if (!stats) return <p className="es-hint">No historical data available</p>;

  return (
    <>
      <Section label="Seat Dominance" defaultOpen>
        <div className="es-quick-stats" style={{ marginBottom: 4 }}>
          <div className="es-stat"><span className="es-stat-value">{stats.strongholds}</span><span className="es-stat-label">Strongholds</span></div>
          <div className="es-stat"><span className="es-stat-value">{stats.loyal}</span><span className="es-stat-label">Loyal</span></div>
          <div className="es-stat"><span className="es-stat-value">{stats.swing}</span><span className="es-stat-label">Swing</span></div>
        </div>
      </Section>

      {stats.partyRows.length > 0 && (
        <Section label="Dominance by Party" defaultOpen>
          <table className="es-table">
            <thead><tr><th></th><th>Party</th><th>Stronghold</th><th>Loyal</th></tr></thead>
            <tbody>
              {stats.partyRows.map(r => (
                <tr key={r.party}>
                  <td><span className="es-dot" style={{ background: r.color }} /></td>
                  <td className="es-name">{r.name}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.stronghold}</td>
                  <td style={{ textAlign: 'center' }}>{r.loyal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {stats.swingSeats.length > 0 && (
        <Section label="Swing Seats" count={stats.swingSeats.length}>
          <table className="es-table">
            <tbody>
              {stats.swingSeats.slice(0, 15).map((s, i) => (
                <tr key={s.constId}>
                  <td className="es-rank">{i + 1}</td>
                  <td><span className="es-dot" style={{ background: s.partyColor }} /></td>
                  <td className="es-name">{s.name}</td>
                  <td style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{s.winners.map(w => w.party).join(' \u2192 ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </>
  );
}

// ─── Anti-Incumbency ──────────────────────────────────────────────────────────

function IncumbencySection({ incumbencyData, partyMap }: {
  incumbencyData?: IncumbencyEntry[];
  partyMap: Map<string, PartyDef>;
}) {
  const stats = useMemo(() => {
    if (!incumbencyData || incumbencyData.length === 0) return null;
    const total = incumbencyData.length;
    const won = incumbencyData.filter(e => e.won).length;
    const lost = total - won;
    const winRate = total > 0 ? Math.round((won / total) * 100) : 0;

    const incByParty = new Map<string, { contested: number; won: number }>();
    for (const e of incumbencyData) {
      const entry = incByParty.get(e.incumbentParty) || { contested: 0, won: 0 };
      entry.contested++;
      if (e.won) entry.won++;
      incByParty.set(e.incumbentParty, entry);
    }
    const partyRows = [...incByParty.entries()]
      .map(([party, counts]) => {
        const p = partyMap.get(party);
        return { party, name: p?.name || party, color: p?.color || '#6b7280', ...counts, winRate: Math.round((counts.won / counts.contested) * 100) };
      })
      .sort((a, b) => b.contested - a.contested);

    const defeats = incumbencyData
      .filter(e => !e.won)
      .sort((a, b) => a.currentMargin - b.currentMargin)
      .slice(0, 10)
      .map(e => {
        const p = partyMap.get(e.incumbentParty);
        return { ...e, shortName: e.constId.replace(/^[A-Z]{2}_(?:VS\d*_)?(?:\d+_)?/, '').replace(/_/g, ' '), partyColor: p?.color || '#6b7280' };
      });

    return { total, won, lost, winRate, partyRows, defeats };
  }, [incumbencyData, partyMap]);

  if (!stats) return null;

  return (
    <>
      <Section label="Anti-Incumbency" defaultOpen>
        <div className="es-quick-stats" style={{ marginBottom: 4 }}>
          <div className="es-stat"><span className="es-stat-value">{stats.total}</span><span className="es-stat-label">Re-contested</span></div>
          <div className="es-stat"><span className="es-stat-value">{stats.won}</span><span className="es-stat-label">Won</span></div>
          <div className="es-stat"><span className="es-stat-value">{stats.winRate}%</span><span className="es-stat-label">Win Rate</span></div>
        </div>
      </Section>

      {stats.partyRows.length > 0 && (
        <Section label="Incumbent Win Rate by Party">
          <table className="es-table">
            <thead><tr><th></th><th>Party</th><th>Contested</th><th>Won</th><th>Rate</th></tr></thead>
            <tbody>
              {stats.partyRows.map(r => (
                <tr key={r.party}>
                  <td><span className="es-dot" style={{ background: r.color }} /></td>
                  <td className="es-name">{r.name}</td>
                  <td style={{ textAlign: 'center' }}>{r.contested}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.won}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: r.winRate >= 50 ? 'var(--success)' : 'var(--danger)' }}>{r.winRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {stats.defeats.length > 0 && (
        <Section label="Notable Incumbent Defeats" count={stats.defeats.length}>
          <table className="es-table">
            <tbody>
              {stats.defeats.map((d, i) => (
                <tr key={d.constId}>
                  <td className="es-rank">{i + 1}</td>
                  <td><span className="es-dot" style={{ background: d.partyColor }} /></td>
                  <td className="es-name">{d.shortName}</td>
                  <td style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{d.incumbentName.split(' ').slice(0, 2).join(' ')}</td>
                  <td className="es-margin">{formatMargin(d.currentMargin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </>
  );
}

// ─── Party Switchers ──────────────────────────────────────────────────────────

function PartySwitcherSection({ partySwitchData, partyMap }: {
  partySwitchData?: PartySwitchEntry[];
  partyMap: Map<string, PartyDef>;
}) {
  const directions = useMemo(() => {
    if (!partySwitchData || partySwitchData.length === 0) return null;
    const dirMap = new Map<string, { from: string; to: string; count: number; won: number }>();
    for (const e of partySwitchData) {
      const key = `${e.fromParty}\u2192${e.toParty}`;
      const entry = dirMap.get(key) || { from: e.fromParty, to: e.toParty, count: 0, won: 0 };
      entry.count++;
      if (e.wonInNewParty) entry.won++;
      dirMap.set(key, entry);
    }
    return [...dirMap.values()].sort((a, b) => b.count - a.count);
  }, [partySwitchData]);

  if (!partySwitchData || partySwitchData.length === 0) return null;

  const wonCount = partySwitchData.filter(e => e.wonInNewParty).length;
  const successRate = Math.round((wonCount / partySwitchData.length) * 100);

  return (
    <>
      <Section label="Party Switchers" defaultOpen>
        <div className="es-quick-stats" style={{ marginBottom: 4 }}>
          <div className="es-stat"><span className="es-stat-value">{partySwitchData.length}</span><span className="es-stat-label">Switchers</span></div>
          <div className="es-stat"><span className="es-stat-value">{wonCount}</span><span className="es-stat-label">Won</span></div>
          <div className="es-stat"><span className="es-stat-value">{successRate}%</span><span className="es-stat-label">Success</span></div>
        </div>
      </Section>

      {directions && directions.length > 0 && (
        <Section label="Switch Directions" defaultOpen>
          <table className="es-table">
            <thead><tr><th>From &rarr; To</th><th>Count</th><th>Won</th></tr></thead>
            <tbody>
              {directions.map(d => {
                const fromP = partyMap.get(d.from);
                const toP = partyMap.get(d.to);
                return (
                  <tr key={`${d.from}\u2192${d.to}`}>
                    <td>
                      <span className="es-dot" style={{ background: fromP?.color || '#6b7280' }} />
                      <span className="es-name">{d.from}</span>
                      <span style={{ fontSize: 10, margin: '0 3px', color: 'var(--text-secondary)' }}>&rarr;</span>
                      <span className="es-dot" style={{ background: toP?.color || '#6b7280' }} />
                      <span className="es-name">{d.to}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{d.count}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: d.won > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>{d.won}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}

      <Section label="Notable Switchers" count={partySwitchData.length}>
        <table className="es-table">
          <thead><tr><th>Name</th><th>From &rarr; To</th><th>Year</th><th>Result</th><th>Margin</th></tr></thead>
          <tbody>
            {partySwitchData.slice(0, 20).map((e, i) => {
              const fromP = partyMap.get(e.fromParty);
              const toP = partyMap.get(e.toParty);
              return (
                <tr key={`${e.constId}-${i}`}>
                  <td className="es-name" style={{ fontSize: 10 }}>{e.candidateName.split(' ').slice(0, 2).join(' ')}</td>
                  <td>
                    <span className="es-dot" style={{ background: fromP?.color || '#6b7280' }} />
                    <span style={{ fontSize: 10, margin: '0 2px', color: 'var(--text-secondary)' }}>&rarr;</span>
                    <span className="es-dot" style={{ background: toP?.color || '#6b7280' }} />
                  </td>
                  <td style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{e.fromYear}&rarr;{e.toYear}</td>
                  <td style={{ fontSize: 10, fontWeight: 600, color: e.wonInNewParty ? 'var(--success)' : 'var(--danger)' }}>
                    {e.wonInNewParty ? 'Won' : 'Lost'}
                  </td>
                  <td className="es-margin">{formatMargin(e.margin)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
    </>
  );
}

// ─── Margin Trend ─────────────────────────────────────────────────────────────

function MarginTrendSection({ marginTrend, partyTrend, partyMap }: {
  marginTrend?: MarginTrendPoint[];
  partyTrend?: PartyTrendPoint[];
  partyMap: Map<string, PartyDef>;
}) {
  const partyTrendTable = useMemo(() => {
    if (!partyTrend || partyTrend.length === 0 || !marginTrend || marginTrend.length === 0) return null;
    const years = marginTrend.map(m => m.year);
    const partyYears = new Map<string, Map<number, { seats: number; avg: number }>>();
    for (const pt of partyTrend) {
      if (!partyYears.has(pt.party)) partyYears.set(pt.party, new Map());
      partyYears.get(pt.party)!.set(pt.year, { seats: pt.seatsWon, avg: pt.avgMargin });
    }
    const rows: { party: string; name: string; color: string; data: Map<number, { seats: number; avg: number }>; latestSeats: number }[] = [];
    for (const [party, yearMap] of partyYears) {
      if (yearMap.size < 2) continue;
      const p = partyMap.get(party);
      const latestSeats = yearMap.get(years[years.length - 1])?.seats || 0;
      rows.push({ party, name: p?.name || party, color: p?.color || '#6b7280', data: yearMap, latestSeats });
    }
    rows.sort((a, b) => b.latestSeats - a.latestSeats);
    return { years, rows };
  }, [partyTrend, marginTrend, partyMap]);

  if (!marginTrend || marginTrend.length <= 1) return null;

  const maxAvg = Math.max(...marginTrend.map(m => m.avgMargin), 1);

  return (
    <>
      <Section label="Margin Trend" defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {marginTrend.map(m => (
            <div key={m.year} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, width: 32, flexShrink: 0 }}>{m.year}</span>
              <div style={{ flex: 1, height: 16, background: 'var(--bg-primary)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${(m.avgMargin / maxAvg) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, width: 40, textAlign: 'right', flexShrink: 0 }}>{formatMargin(m.avgMargin)}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-secondary)' }}>
          Average winning margin across all seats
        </div>
      </Section>

      {partyTrendTable && partyTrendTable.rows.length > 0 && (
        <Section label="Per-Party Trend">
          <div style={{ overflowX: 'auto' }}>
            <table className="es-table" style={{ minWidth: partyTrendTable.years.length * 70 + 80 }}>
              <thead>
                <tr>
                  <th>Party</th>
                  {partyTrendTable.years.map(y => <th key={y} style={{ textAlign: 'center' }}>{y}</th>)}
                </tr>
              </thead>
              <tbody>
                {partyTrendTable.rows.map(r => (
                  <tr key={r.party}>
                    <td><span className="es-dot" style={{ background: r.color }} /> <span className="es-name">{r.name}</span></td>
                    {partyTrendTable.years.map(y => {
                      const d = r.data.get(y);
                      return (
                        <td key={y} style={{ textAlign: 'center', fontSize: 10 }}>
                          {d ? <><strong>{d.seats}</strong><span style={{ color: 'var(--text-secondary)' }}>/{formatMargin(d.avg)}</span></> : '\u2013'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 4, fontSize: 9, color: 'var(--text-secondary)' }}>Format: seats / avg margin</div>
        </Section>
      )}
    </>
  );
}
