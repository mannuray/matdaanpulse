import { useState, useMemo, memo } from 'react';
import PartyIcon from '../atoms/PartyIcon';
import type { StandingsData, AllianceGroup, PartyStanding } from '../../types';
import { LS_BUCKETS, VS_BUCKETS } from './summary/utils';

interface AddableItem {
  id: string;
  name: string;
  color: string;
  type: 'alliance' | 'party';
}

interface RegionInfo {
  id: string;
  party?: string;
  margin?: number;
}

const BUCKET_OPACITIES = [0.15, 0.35, 0.55, 0.75, 1.0];

interface AllianceTallyProps {
  standings: StandingsData;
  totalSeats: number;
  majorityMark: number;
  addableItems: AddableItem[];
  manifestIds: Set<string>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  showAddDropdown: boolean;
  onToggleAdd: () => void;
  regions?: RegionInfo[];
  electionType?: 'LS' | 'VS';
}

const PartyRow = memo(function PartyRow({ party, onRemove, showLead }: { party: PartyStanding; onRemove?: () => void; showLead: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '4px 12px 4px 32px',
      fontSize: 'var(--text-xs)', borderBottom: '1px solid var(--border)',
      position: 'relative'
    }}>
      <div style={{ position: 'absolute', left: '18px', top: 0, bottom: 0, width: '1px', background: 'var(--border)' }} />
      <div style={{ position: 'absolute', left: '18px', top: '14px', width: '8px', height: '1px', background: 'var(--border)' }} />
      
      <PartyIcon color={party.color} size={8} partyId={party.id} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'var(--weight-medium)', color: 'var(--text-secondary)' }}>
        {party.name}
      </span>
      <span style={{ fontWeight: 'var(--weight-bold)', width: 32, flexShrink: 0, textAlign: 'right', fontSize: '11px', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{party.won}</span>
      {showLead && (
        <span style={{ width: 32, flexShrink: 0, textAlign: 'right', color: 'var(--accent)', fontSize: '10px', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums' }}>
          {party.leading > 0 ? `+${party.leading}` : ''}
        </span>
      )}
      <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: 40, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {party.votePct != null ? `${party.votePct}%` : ''}
      </span>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1 }}
        >×</button>
      )}
    </div>
  );
});

const AllianceRow = memo(function AllianceRow({
  group, manifestIds, onRemove, expanded, onToggle, majorityMark, totalSeatsInHouse, showLead
}: {
  group: AllianceGroup; manifestIds: Set<string>; onRemove: (id: string) => void;
  expanded: boolean; onToggle: () => void; majorityMark: number; totalSeatsInHouse: number; showLead: boolean;
}) {
  const isManifest = manifestIds.has(group.id);
  const currentSeats = group.won + group.leading;
  const progress = Math.min((currentSeats / totalSeatsInHouse) * 100, 100);
  const majorityPos = (majorityMark / totalSeatsInHouse) * 100;
  const hasMajority = currentSeats >= majorityMark;

  return (
    <div style={{ borderBottom: '1px solid var(--border)', position: 'relative' }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-2) 12px',
          cursor: 'pointer', borderLeft: `4px solid ${group.color}`,
          background: expanded ? 'var(--bg-secondary)' : 'transparent',
          transition: 'background 0.2s', paddingBottom: '8px'
        }}
      >
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: 12, textAlign: 'center' }}>
          {expanded ? '▾' : '▸'}
        </span>
        <span style={{ flex: 1, fontWeight: 'var(--weight-bold)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
          {group.name}
        </span>
        <span style={{ fontWeight: 'var(--weight-bold)', fontSize: '14px', width: 32, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{group.won}</span>
        {showLead && (
          <span style={{ width: 32, flexShrink: 0, textAlign: 'right', color: 'var(--accent)', fontSize: '11px', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums' }}>
            {group.leading > 0 ? `+${group.leading}` : ''}
          </span>
        )}
        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', width: 40, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {group.votePct}%
        </span>
        {!isManifest && (
          <button
            aria-label={`Remove ${group.name}`}
            onClick={(e) => { e.stopPropagation(); onRemove(group.id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1 }}
          >×</button>
        )}
      </div>
      
      <div style={{ position: 'absolute', bottom: 0, left: '4px', right: 0, height: '2px', background: 'rgba(0,0,0,0.03)', overflow: 'visible' }}>
        <div style={{ height: '100%', background: group.color, width: `${progress}%`, transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }} />
        <div style={{ 
          position: 'absolute', left: `${majorityPos}%`, top: '-3px', width: '4px', height: '4px', 
          borderRadius: '50%', background: hasMajority ? group.color : 'var(--border-strong)',
          boxShadow: hasMajority ? `0 0 4px ${group.color}` : 'none',
          zIndex: 2, transform: 'translateX(-50%)', border: '1px solid #fff'
        }} />
      </div>

      {expanded && (
        <div style={{ background: 'var(--bg-primary)' }}>
          {group.parties.map((p) => (
            <PartyRow
              key={p.id}
              party={p}
              onRemove={!p.isManifest && !manifestIds.has(group.id) ? () => onRemove(p.id) : undefined}
              showLead={showLead}
            />
          ))}
        </div>
      )}
    </div>
  );
});

const AllianceTally = memo(function AllianceTally({
  standings, totalSeats, majorityMark, addableItems, manifestIds, onAdd, onRemove,
  showAddDropdown, onToggleAdd, regions, electionType,
}: AllianceTallyProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showOthers, setShowOthers] = useState(false);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const { winningIndependents, otherIndependents } = useMemo(() => {
    const winning: PartyStanding[] = [];
    const other: PartyStanding[] = [];
    standings.independents.forEach(p => {
      if (p.won > 0 || p.leading > 0) winning.push(p); else other.push(p);
    });
    return { winningIndependents: winning, otherIndependents: other };
  }, [standings.independents]);

  const partyToAlliance = useMemo(() => {
    const map = new Map<string, string>();
    standings.groups.forEach(g => g.parties.forEach(p => map.set(p.id, g.id)));
    return map;
  }, [standings.groups]);

  const buckets = electionType === 'VS' ? VS_BUCKETS : LS_BUCKETS;

  const vulnSegments = useMemo(() => {
    if (!regions || regions.length === 0) return null;
    const countsMap = new Map<string, number[]>();
    for (const r of regions) {
      if (!r.party || r.margin == null) continue;
      const key = partyToAlliance.get(r.party) || r.party;
      if (!countsMap.has(key)) countsMap.set(key, new Array(buckets.length).fill(0));
      const arr = countsMap.get(key)!;
      for (let i = 0; i < buckets.length; i++) {
        if (r.margin < buckets[i].max) { arr[i]++; break; }
      }
    }
    const items = [
      ...standings.groups.map(g => ({ id: g.id, color: g.color, seats: g.won + g.leading })),
      ...standings.independents.map(p => ({ id: p.id, color: p.color, seats: p.won + p.leading })),
    ];
    return items.map(item => {
      const bc = countsMap.get(item.id) || new Array(buckets.length).fill(0);
      return {
        color: item.color,
        width: totalSeats > 0 ? (item.seats / totalSeats) * 100 : 0,
        subs: bc.map((count, i) => ({ flex: count, opacity: BUCKET_OPACITIES[i] })),
      };
    });
  }, [regions, standings.groups, standings.independents, partyToAlliance, buckets, totalSeats]);

  const segments = useMemo(() => {
    const allItems = [
      ...standings.groups.map(g => ({ color: g.color, seats: g.won + g.leading })),
      ...standings.independents.map(p => ({ color: p.color, seats: p.won + p.leading })),
    ];
    return allItems.map(item => ({
      color: item.color,
      width: totalSeats > 0 ? (item.seats / totalSeats) * 100 : 0,
    }));
  }, [standings.groups, standings.independents, totalSeats]);

  const hasData = standings.groups.length > 0 || standings.independents.length > 0;
  const hasLeads = useMemo(() => {
    return standings.groups.some(g => g.leading > 0) || standings.independents.some(p => p.leading > 0);
  }, [standings]);

  return (
    <div>
      {hasData && (
        <div style={{ padding: 'var(--space-2) 12px var(--space-3)', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
            {standings.groups.slice(0, 2).map((g, i) => (
              <div key={g.id} style={{ textAlign: i === 0 ? 'left' : 'right' }}>
                <div style={{ fontSize: '9px', fontWeight: 'var(--weight-bold)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>{g.name}</div>
                <div style={{ fontSize: '24px', fontWeight: 'var(--weight-bold)', color: g.color, lineHeight: 1 }}>{g.won + g.leading}</div>
              </div>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              {vulnSegments ? vulnSegments.map((seg, i) => (
                <div key={i} style={{ width: `${seg.width}%`, display: 'flex', transition: 'width 0.5s ease' }}>
                  {seg.subs.map((sub, j) => sub.flex > 0 ? (
                    <div key={j} style={{ flex: sub.flex, background: seg.color, opacity: sub.opacity }} />
                  ) : null)}
                </div>
              )) : segments.map((seg, i) => (
                <div key={i} style={{ width: `${seg.width}%`, background: seg.color, transition: 'width 0.5s ease' }} />
              ))}
            </div>
            <div style={{ position: 'absolute', left: `${totalSeats > 0 ? (majorityMark / totalSeats) * 100 : 50}%`, top: '-2px', width: '2px', height: '12px', background: 'var(--danger)', zIndex: 5 }}>
              <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '8px', fontWeight: 'var(--weight-bold)', color: 'var(--danger)' }}>{majorityMark}</div>
            </div>
          </div>
        </div>
      )}

      {hasData && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-2) 12px', fontSize: '9px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 10 }}>
          <span style={{ width: 12 }} />
          <span style={{ flex: 1 }}>PARTY / ALLIANCE</span>
          <span style={{ width: 32, textAlign: 'right' }}>WON</span>
          {hasLeads && <span style={{ width: 32, textAlign: 'right' }}>LEAD</span>}
          <span style={{ width: 40, textAlign: 'right' }}>VOTE%</span>
        </div>
      )}

      {showAddDropdown && (
        <div style={{ padding: '4px 10px 6px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {addableItems.map(item => (
              <button key={item.id} onClick={() => { onAdd(item.id); onToggleAdd(); }} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                <PartyIcon color={item.color} size={8} partyId={item.id} />
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {standings.groups.map(g => (
        <AllianceRow key={g.id} group={g} manifestIds={manifestIds} onRemove={onRemove} expanded={expandedGroups.has(g.id)} onToggle={() => toggleGroup(g.id)} majorityMark={majorityMark} totalSeatsInHouse={totalSeats} showLead={hasLeads} />
      ))}

      {winningIndependents.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-2) 12px', borderBottom: '1px solid var(--border)', borderLeft: `4px solid ${p.color}` }}>
          <PartyIcon color={p.color} size={10} partyId={p.id} />
          <span style={{ flex: 1, fontWeight: 'var(--weight-bold)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          <span style={{ fontWeight: 'var(--weight-bold)', fontSize: '13px', width: 32, flexShrink: 0, textAlign: 'right' }}>{p.won}</span>
          {hasLeads && <span style={{ width: 32, flexShrink: 0, textAlign: 'right', color: 'var(--accent)', fontSize: '10px', fontWeight: 'var(--weight-bold)' }}>{p.leading > 0 ? `+${p.leading}` : ''}</span>}
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', width: 40, flexShrink: 0, textAlign: 'right' }}>{p.votePct != null ? `${p.votePct}%` : ''}</span>
          {!p.isManifest && <button onClick={() => onRemove(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: 'var(--text-muted)' }}>×</button>}
        </div>
      ))}

      {otherIndependents.length > 0 && (
        <>
          <div role="button" tabIndex={0} onClick={() => setShowOthers(!showOthers)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-2) 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: showOthers ? 'var(--bg-secondary)' : 'transparent', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '10px', width: 12, textAlign: 'center' }}>{showOthers ? '▾' : '▸'}</span>
            <span style={{ flex: 1, fontWeight: 'var(--weight-medium)', fontSize: '12px' }}>Other Parties ({otherIndependents.length})</span>
            <span style={{ fontWeight: 'var(--weight-bold)', fontSize: '13px', width: 32, textAlign: 'right' }}>0</span>
            {hasLeads && <span style={{ width: 32 }} />}
            <span style={{ width: 40 }} />
          </div>
          {showOthers && (
            <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
              {otherIndependents.map(p => <PartyRow key={p.id} party={p} onRemove={!p.isManifest ? () => onRemove(p.id) : undefined} showLead={hasLeads} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default AllianceTally;

export function AllianceTallyBadge({ majorityMark, totalSeats, declaredSeats, showAdd, onToggleAdd }: { majorityMark: number; totalSeats: number; declaredSeats?: number; showAdd: boolean; onToggleAdd: () => void; }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Majority: {majorityMark}</span>
      <button onClick={(e) => { e.stopPropagation(); onToggleAdd(); }} style={{ fontSize: 12, padding: '1px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: showAdd ? 'var(--bg-secondary)' : 'transparent' }}>+</button>
    </div>
  );
}
