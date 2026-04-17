import { useState, useMemo } from 'react';
import type { Region, AllianceDef, StandingsData, ResultRow, TFunc } from './types';
import { LS_BUCKETS, VS_BUCKETS, formatMargin, Section } from './utils';

interface DisparityRow {
  name: string;
  color: string;
  seatPct: number;
  votePct: number;
  disparity: number;
  parties?: DisparityRow[];
}

interface OverviewSectionProps {
  regions: Region[];
  electionType: 'LS' | 'VS';
  alliances: AllianceDef[];
  standings?: StandingsData;
  constCandidates?: Map<string, ResultRow[]>;
  margins: number[];
  onRegionClick?: (id: string) => void;
  t: TFunc;
}

export default function OverviewSection({ regions, electionType, alliances, standings, constCandidates, margins, t }: OverviewSectionProps) {
  const buckets = electionType === 'VS' ? VS_BUCKETS : LS_BUCKETS;

  const histogram = useMemo(() => {
    const counts = buckets.map(() => 0);
    for (const m of margins) {
      for (let i = 0; i < buckets.length; i++) {
        if (m < buckets[i].max || i === buckets.length - 1) {
          counts[i]++;
          break;
        }
      }
    }
    return counts;
  }, [margins, buckets]);

  const maxBucket = Math.max(...histogram, 1);

  const sorted = useMemo(() =>
    regions
      .filter(r => r.margin != null)
      .sort((a, b) => a.margin! - b.margin!),
    [regions]
  );

  const closest = sorted.slice(0, 10);
  const biggest = useMemo(() => [...sorted].reverse().slice(0, 5), [sorted]);

  const reservedStats = useMemo(() => {
    const map = new Map<string, { name: string; color: string; sc: number; st: number }>();
    for (const r of regions) {
      if (r.type !== 'SC' && r.type !== 'ST') continue;
      const pid = r.party || 'IND';
      if (!map.has(pid)) {
        map.set(pid, { name: pid, color: r.partyColor || '#6b7280', sc: 0, st: 0 });
      }
      const entry = map.get(pid)!;
      if (r.type === 'SC') entry.sc++;
      else entry.st++;
    }
    return Array.from(map.values())
      .sort((a, b) => (b.sc + b.st) - (a.sc + a.st));
  }, [regions]);

  return (
    <>
      <Section label={t('margin_distribution', 'Margin Distribution')} defaultOpen>
        <div className="es-histogram-v">
          {buckets.map((b, i) => (
            <div key={b.label} className="es-histogram-col">
              <span className="es-histogram-count">{histogram[i]}</span>
              <div className="es-histogram-bar-bg-v">
                <div
                  className="es-histogram-bar-v"
                  style={{ height: `${(histogram[i] / maxBucket) * 100}%` }}
                />
              </div>
              <span className="es-histogram-label-v">{b.label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section label={t('closest_battles', 'Closest Battles')} count={closest.length}>
        <table className="es-table">
          <tbody>
            {closest.map((r, i) => (
              <tr key={r.id}>
                <td className="es-rank">{i + 1}</td>
                <td><span className="es-dot" style={{ background: r.partyColor || '#6b7280' }} /></td>
                <td className="es-name">{r.name.replace(/_/g, ' ')}</td>
                <td className="es-margin">{formatMargin(r.margin!)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section label={t('biggest_mandates', 'Biggest Mandates')} count={biggest.length}>
        <table className="es-table">
          <tbody>
            {biggest.map((r, i) => (
              <tr key={r.id}>
                <td className="es-rank">{i + 1}</td>
                <td><span className="es-dot" style={{ background: r.partyColor || '#6b7280' }} /></td>
                <td className="es-name">{r.name.replace(/_/g, ' ')}</td>
                <td className="es-margin">{formatMargin(r.margin!)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {reservedStats.length > 0 && (
        <Section label={t('reserved_seats', 'Reserved Seats (SC/ST)')}>
          <table className="es-table">
            <thead>
              <tr>
                <th></th>
                <th>{t('party', 'Party')}</th>
                <th>SC</th>
                <th>ST</th>
                <th>{t('total', 'Total')}</th>
              </tr>
            </thead>
            <tbody>
              {reservedStats.map(p => (
                <tr key={p.name}>
                  <td><span className="es-dot" style={{ background: p.color }} /></td>
                  <td className="es-name">{p.name}</td>
                  <td style={{ textAlign: 'center' }}>{p.sc || '–'}</td>
                  <td style={{ textAlign: 'center' }}>{p.st || '–'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{p.sc + p.st}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <VoteShareDisparitySection regions={regions} standings={standings} t={t} />
      <WastedVotesSection constCandidates={constCandidates} alliances={alliances} t={t} />
    </>
  );
}

// ─── Vote Share vs Seats Disparity ────────────────────────────────────────────

function VoteShareDisparitySection({ regions, standings, t }: { regions: Region[]; standings?: StandingsData; t: TFunc }) {
  const [expandedAlliance, setExpandedAlliance] = useState<string | null>(null);
  const [disparityByParty, setDisparityByParty] = useState(false);

  const disparityData = useMemo((): DisparityRow[] | null => {
    if (!standings || standings.groups.length === 0) return null;
    const totalSeats = regions.filter(r => r.margin != null).length;
    if (totalSeats === 0) return null;
    const partySeatCount = new Map<string, number>();
    for (const r of regions) { if (r.margin != null && r.party) partySeatCount.set(r.party, (partySeatCount.get(r.party) || 0) + 1); }
    const rows: DisparityRow[] = [];
    for (const g of standings.groups) {
      let seats = 0;
      const partyRows: DisparityRow[] = [];
      for (const p of g.parties) {
        const pSeats = partySeatCount.get(p.id) || 0; seats += pSeats;
        const pVotePct = p.votePct || 0;
        if (pSeats > 0 || pVotePct > 0) { const pSeatPct = (pSeats / totalSeats) * 100; partyRows.push({ name: p.name, color: p.color, seatPct: pSeatPct, votePct: pVotePct, disparity: pSeatPct - pVotePct }); }
      }
      partyRows.sort((a, b) => b.seatPct - a.seatPct);
      const seatPct = (seats / totalSeats) * 100;
      rows.push({ name: g.name, color: g.color, seatPct, votePct: g.votePct, disparity: seatPct - g.votePct, parties: partyRows.length > 1 ? partyRows : undefined });
    }
    const groupPartyIds = new Set(standings.groups.flatMap(g => g.parties.map(p => p.id)));
    let othersSeats = 0;
    for (const r of regions) { if (r.margin != null && r.party && !groupPartyIds.has(r.party)) othersSeats++; }
    const othersVotePct = standings.independents.reduce((s, p) => s + (p.votePct || 0), 0);
    if (othersSeats > 0 || othersVotePct > 0) { const pct = (othersSeats / totalSeats) * 100; rows.push({ name: 'Others', color: '#6b7280', seatPct: pct, votePct: othersVotePct, disparity: pct - othersVotePct }); }
    return rows.sort((a, b) => b.seatPct - a.seatPct);
  }, [standings, regions]);

  const disparityPartyData = useMemo((): DisparityRow[] | null => {
    if (!standings || standings.groups.length === 0) return null;
    const totalSeats = regions.filter(r => r.margin != null).length;
    if (totalSeats === 0) return null;
    const partySeatCount = new Map<string, number>();
    for (const r of regions) { if (r.margin != null && r.party) partySeatCount.set(r.party, (partySeatCount.get(r.party) || 0) + 1); }
    const rows: DisparityRow[] = [];
    const allParties = [...standings.groups.flatMap(g => g.parties), ...standings.independents];
    for (const p of allParties) {
      const pSeats = partySeatCount.get(p.id) || 0; const pVotePct = p.votePct || 0;
      if (pSeats > 0 || pVotePct >= 1) { const pSeatPct = (pSeats / totalSeats) * 100; rows.push({ name: p.name, color: p.color, seatPct: pSeatPct, votePct: pVotePct, disparity: pSeatPct - pVotePct }); }
    }
    return rows.sort((a, b) => b.votePct - a.votePct).slice(0, 10);
  }, [standings, regions]);

  if (!disparityData || disparityData.length === 0) return null;

  const isPartyView = disparityByParty && disparityPartyData;
  const expanded = !isPartyView && expandedAlliance ? disparityData.find(d => d.name === expandedAlliance) : null;
  const displayData = isPartyView ? disparityPartyData! : (expanded?.parties || disparityData);
  const maxPct = Math.max(...displayData.flatMap(d => [d.votePct, d.seatPct]), 1);

  return (
    <Section label={t('vote_share_vs_seats', 'Vote Share vs Seats')} defaultOpen>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
        {expanded ? (
          <button onClick={() => setExpandedAlliance(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '9px', fontWeight: 'var(--weight-bold)', color: 'var(--accent)', padding: 0, display: 'flex', alignItems: 'center', gap: 3, textTransform: 'uppercase' }}>
            <span>&#9666; BACK</span>
          </button>
        ) : <span />}
        {disparityPartyData && !expanded && (
          <div className="map-tabs" style={{ padding: '1px' }}>
            <button onClick={() => setDisparityByParty(false)} className={`map-tab ${!isPartyView ? 'active' : ''}`} style={{ fontSize: '8px', padding: '2px 8px' }}>ALLIANCES</button>
            <button onClick={() => setDisparityByParty(true)} className={`map-tab ${isPartyView ? 'active' : ''}`} style={{ fontSize: '8px', padding: '2px 8px' }}>PARTIES</button>
          </div>
        )}
      </div>
      <div style={displayData.length > 5 ? { overflowX: 'auto', marginRight: -4, paddingBottom: 'var(--space-2)' } : { paddingBottom: 'var(--space-2)' }}>
        <div className="es-histogram-v" style={displayData.length > 5 ? { minWidth: displayData.length * 52 } : undefined}>
          {displayData.map(d => (
            <div key={d.name} className="es-histogram-col" onClick={() => { if (!isPartyView && !expandedAlliance && d.parties) setExpandedAlliance(d.name); }} style={!isPartyView && !expandedAlliance && d.parties ? { cursor: 'pointer' } : undefined}>
              <span className="es-histogram-count" style={{ fontSize: 9, fontWeight: 600, color: d.disparity > 0 ? 'var(--success)' : d.disparity < 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                {d.disparity > 0 ? '+' : ''}{d.disparity.toFixed(1)}
              </span>
              <div className="es-histogram-bar-bg-v">
                <div className="es-histogram-bar-group">
                  <div className="es-histogram-bar-grouped" style={{ height: `${(d.votePct / maxPct) * 100}%`, background: d.color, opacity: 0.4 }} title={`Vote: ${d.votePct.toFixed(1)}%`}>
                    <span className="es-histogram-bar-count">{d.votePct.toFixed(1)}</span>
                  </div>
                  <div className="es-histogram-bar-grouped" style={{ height: `${(d.seatPct / maxPct) * 100}%`, background: d.color }} title={`Seats: ${d.seatPct.toFixed(1)}%`}>
                    <span className="es-histogram-bar-count">{d.seatPct.toFixed(1)}</span>
                  </div>
                </div>
              </div>
              <span className="es-histogram-label-v">{d.name}{!isPartyView && !expandedAlliance && d.parties && <span style={{ fontSize: 8, opacity: 0.5 }}> &#9656;</span>}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="es-histogram-legend">
        <span className="es-histogram-legend-item"><span className="es-dot" style={{ background: 'var(--text-secondary)', opacity: 0.4 }} />Vote %</span>
        <span className="es-histogram-legend-item"><span className="es-dot" style={{ background: 'var(--text-secondary)' }} />Seat %</span>
      </div>
    </Section>
  );
}

// ─── Wasted Votes ─────────────────────────────────────────────────────────────

function WastedVotesSection({ constCandidates, alliances, t }: { constCandidates?: Map<string, ResultRow[]>; alliances: AllianceDef[]; t: TFunc }) {
  const wastedData = useMemo(() => {
    if (!constCandidates || constCandidates.size === 0 || alliances.length === 0) return null;
    const partyToAllianceId = new Map<string, string>();
    const allianceInfo = new Map<string, { name: string; color: string }>();
    for (const a of alliances) { allianceInfo.set(a.id, { name: a.name, color: a.color }); for (const pid of a.parties) partyToAllianceId.set(pid, a.id); }
    const totalVotes = new Map<string, number>();
    const wastedVotes = new Map<string, number>();
    for (const [, cands] of constCandidates) {
      if (cands.length === 0) continue;
      const winnerAlliance = partyToAllianceId.get(cands[0].party_id);
      for (const c of cands) {
        const alId = partyToAllianceId.get(c.party_id); if (!alId) continue;
        totalVotes.set(alId, (totalVotes.get(alId) || 0) + c.votes);
        if (alId !== winnerAlliance) wastedVotes.set(alId, (wastedVotes.get(alId) || 0) + c.votes);
      }
    }
    const rows: { name: string; color: string; total: number; wasted: number; wastedPct: number }[] = [];
    for (const [alId, total] of totalVotes) { const info = allianceInfo.get(alId); if (!info || total === 0) continue; const wasted = wastedVotes.get(alId) || 0; rows.push({ name: info.name, color: info.color, total, wasted, wastedPct: (wasted / total) * 100 }); }
    rows.sort((a, b) => b.wastedPct - a.wastedPct);
    let efficiencyGap: { name: string; gap: number } | null = null;
    if (rows.length >= 2) { const byTotal = [...rows].sort((a, b) => b.total - a.total); const diff = byTotal[0].wastedPct - byTotal[1].wastedPct; efficiencyGap = { name: diff < 0 ? byTotal[0].name : byTotal[1].name, gap: Math.abs(diff) }; }
    return { rows, efficiencyGap };
  }, [constCandidates, alliances]);

  if (!wastedData || wastedData.rows.length === 0) return null;

  return (
    <Section label={t('wasted_votes', 'Wasted Votes')}>
      <table className="es-table">
        <thead><tr><th></th><th>{t('alliance', 'Alliance')}</th><th style={{ textAlign: 'right' }}>{t('total', 'Total')}</th><th style={{ textAlign: 'right' }}>{t('wasted', 'Wasted')}</th><th style={{ textAlign: 'right' }}>%</th></tr></thead>
        <tbody>
          {wastedData.rows.map(r => (
            <tr key={r.name}>
              <td><span className="es-dot" style={{ background: r.color }} /></td>
              <td className="es-name">{r.name}</td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(r.total / 100000).toFixed(1)}L</td>
              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(r.wasted / 100000).toFixed(1)}L</td>
              <td style={{ textAlign: 'right', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{r.wastedPct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {wastedData.efficiencyGap && (
        <div style={{ marginTop: 'var(--space-2)', fontSize: '10px', color: 'var(--text-secondary)', padding: 'var(--space-2)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
          Efficiency Gap: <strong style={{ color: 'var(--text-primary)' }}>{wastedData.efficiencyGap.name}</strong> has <span style={{ color: 'var(--success)', fontWeight: 'var(--weight-bold)' }}>+{wastedData.efficiencyGap.gap.toFixed(1)} pp</span> advantage
        </div>
      )}
    </Section>
  );
}
