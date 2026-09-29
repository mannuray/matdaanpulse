import { useMemo } from 'react';
import type { Region, AllianceDef , TFunc } from './types';
import { Section, formatMargin } from './utils';
import { displayStateName, stateFromConstId } from '../../../utils/regionMatching';

interface StatesSectionProps {
  regions: Region[];
  alliances: AllianceDef[];
  electionType: 'LS' | 'VS';
  t: TFunc;
}

export default function StatesSection({ regions, alliances, electionType, t }: StatesSectionProps) {
  const stateStats = useMemo(() => {
    if (electionType === 'VS') return [];
    const partyToAlliance = new Map<string, { name: string; color: string }>();
    for (const a of alliances) {
      for (const pid of a.parties) {
        partyToAlliance.set(pid, { name: a.name, color: a.color });
      }
    }
    const stateMap = new Map<string, { code: string; seats: number; marginSum: number; partySeats: Map<string, { name: string; color: string; count: number }> }>();
    for (const r of regions) {
      if (r.margin == null || !r.party) continue;
      // LS ids are mostly bare names (AGRA, AHMEDABAD_EAST): use the region's resolved
      // state, falling back to a known state-code prefix (BR_AURANGABAD).
      const code = r.state || stateFromConstId(r.id);
      if (!code) continue;
      if (!stateMap.has(code)) {
        stateMap.set(code, { code, seats: 0, marginSum: 0, partySeats: new Map() });
      }
      const st = stateMap.get(code)!;
      st.seats++;
      st.marginSum += r.margin;
      const al = partyToAlliance.get(r.party);
      const key = al ? al.name : r.party;
      const color = al ? al.color : (r.partyColor || '#6b7280');
      if (!st.partySeats.has(key)) {
        st.partySeats.set(key, { name: key, color, count: 0 });
      }
      st.partySeats.get(key)!.count++;
    }
    return Array.from(stateMap.values())
      .map(st => {
        let dominant = { name: '', color: '#6b7280', count: 0 };
        for (const ps of st.partySeats.values()) {
          if (ps.count > dominant.count) dominant = ps;
        }
        return {
          code: st.code,
          name: displayStateName(st.code),
          seats: st.seats,
          avgMargin: Math.round(st.marginSum / st.seats),
          dominant,
          dominantPct: Math.round((dominant.count / st.seats) * 100),
        };
      })
      .sort((a, b) => b.seats - a.seats);
  }, [regions, alliances, electionType]);

  const sweepStates = useMemo(() => {
    return stateStats.filter(s => s.dominantPct >= 80);
  }, [stateStats]);

  const competitiveStates = useMemo(() => {
    return [...stateStats].sort((a, b) => a.avgMargin - b.avgMargin).slice(0, 5);
  }, [stateStats]);

  return (
    <>
      <Section label={`${t('state_leaderboard', 'State Leaderboard')} (Top 10)`} defaultOpen>
        <div className="es-state-list">
          {stateStats.slice(0, 10).map(s => (
            <div key={s.code} className="es-state-row">
              <span className="es-state-name">{s.name}</span>
              <div className="es-state-bar-bg">
                <div className="es-state-bar-fill" style={{ width: `${(s.seats / stateStats[0].seats) * 100}%`, background: s.dominant.color }} />
              </div>
              <span className="es-state-seats">{s.dominant.name} {s.seats}</span>
            </div>
          ))}
        </div>
      </Section>

      {sweepStates.length > 0 && (
        <Section label={`${t('sweep_states', 'Sweep States')} (>=80%)`} count={sweepStates.length}>
          <table className="es-table">
            <tbody>
              {sweepStates.map(s => (
                <tr key={s.code}>
                  <td><span className="es-dot" style={{ background: s.dominant.color }} /></td>
                  <td className="es-name">{s.name}</td>
                  <td style={{ textAlign: 'center' }}>{s.dominant.name}</td>
                  <td className="es-margin">{s.dominantPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {competitiveStates.length > 0 && (
        <Section label={t('competitive_states', 'Most Competitive States')} count={competitiveStates.length}>
          <table className="es-table">
            <tbody>
              {competitiveStates.map((s, i) => (
                <tr key={s.code}>
                  <td className="es-rank">{i + 1}</td>
                  <td className="es-name">{s.name}</td>
                  <td className="es-margin">{formatMargin(s.avgMargin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </>
  );
}
