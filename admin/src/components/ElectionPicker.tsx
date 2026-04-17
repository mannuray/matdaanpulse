import { useState, useMemo, useEffect } from 'react';
import type { Election, State } from '../types';
import { getElections } from '../services/election.service';
import { getStates } from '../services/geo.service';

interface ElectionPickerProps {
  value: string;
  onChange: (electionId: string) => void;
  /** @deprecated Pass nothing — ElectionPicker fetches its own data now */
  elections?: Election[];
  /** @deprecated Pass nothing — ElectionPicker fetches its own data now */
  states?: State[];
  liveFirst?: boolean;
}

export default function ElectionPicker({ value, onChange, elections: electionsProp, states: statesProp, liveFirst }: ElectionPickerProps) {
  const [selfElections, setSelfElections] = useState<Election[]>([]);
  const [selfStates, setSelfStates] = useState<State[]>([]);

  // Fetch our own data if props not supplied
  useEffect(() => {
    if (!electionsProp) getElections().then(setSelfElections).catch(() => {});
    if (!statesProp) getStates().then(setSelfStates).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const elections = electionsProp ?? selfElections;
  const states = statesProp ?? selfStates;

  const [electionType, setElectionType] = useState<'LS' | 'VS'>('LS');
  const [selectedStateId, setSelectedStateId] = useState<number | null>(null);

  // Auto-sync: when value changes externally, derive type/state from the election object
  useEffect(() => {
    if (!value) return;
    const el = elections.find((e) => e.id === value);
    if (!el) return;
    if (el.type !== electionType) setElectionType(el.type as 'LS' | 'VS');
    if (el.type === 'VS' && el.state_id != null && el.state_id !== selectedStateId) {
      setSelectedStateId(el.state_id);
    }
  }, [value, elections]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smart default: when elections load and nothing is selected, pick the type with the most recent election
  // Also auto-select the state if only one state has VS elections
  useEffect(() => {
    if (value || elections.length === 0) return;
    const ls = elections.filter((e) => e.type === 'LS');
    const vs = elections.filter((e) => e.type === 'VS');
    if (vs.length > 0 && (ls.length === 0 || Math.max(...vs.map((e) => e.year)) > Math.max(...ls.map((e) => e.year)))) {
      setElectionType('VS');
      // Auto-select state if only one state has VS elections
      const stateIds = new Set(vs.map((e) => e.state_id).filter((id): id is number => id != null));
      if (stateIds.size === 1) {
        setSelectedStateId([...stateIds][0]);
      }
    }
  }, [elections]); // eslint-disable-line react-hooks/exhaustive-deps

  // VS elections grouped by state
  const vsElectionsByState = useMemo(() => {
    const map = new Map<number, Election[]>();
    elections.filter((e) => e.type === 'VS').forEach((e) => {
      if (e.state_id != null) {
        const list = map.get(e.state_id) || [];
        list.push(e);
        map.set(e.state_id, list);
      }
    });
    return map;
  }, [elections]);

  // Elections visible in the dropdown
  const visibleElections = useMemo(() => {
    let list: Election[];
    if (electionType === 'LS') {
      list = elections.filter((e) => e.type === 'LS');
    } else if (selectedStateId == null) {
      return [];
    } else {
      list = (vsElectionsByState.get(selectedStateId) || []).slice();
    }
    list.sort((a, b) => b.year - a.year);
    if (liveFirst) {
      list.sort((a, b) => {
        const aLive = a.status === 'Live' ? 0 : 1;
        const bLive = b.status === 'Live' ? 0 : 1;
        return aLive - bLive || b.year - a.year;
      });
    }
    return list;
  }, [electionType, elections, selectedStateId, vsElectionsByState, liveFirst]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      {/* LS / VS toggle - Modern Pill Style */}
      <div className="map-tabs" style={{ background: 'var(--bg-secondary)', padding: '2px' }}>
        {(['LS', 'VS'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              if (electionType === t) return;
              setElectionType(t);
              onChange('');
              setSelectedStateId(null);
            }}
            className={`map-tab ${electionType === t ? 'active' : ''}`}
            style={{ fontSize: 'var(--text-sm)', padding: '0 20px', height: '34px' }}
          >
            {t === 'LS' ? 'Lok Sabha' : 'Vidhan Sabha'}
          </button>
        ))}
      </div>

      {/* State dropdown (VS only) */}
      {electionType === 'VS' && (
        <select
          className="form-input"
          value={selectedStateId ?? ''}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null;
            setSelectedStateId(id);
            onChange('');
          }}
          style={{ minWidth: 160, width: 'auto', height: '34px' }}
        >
          <option value="">Select State...</option>
          {states
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s) => {
              const count = vsElectionsByState.get(s.id)?.length || 0;
              return (
                <option key={s.id} value={s.id} disabled={count === 0}>
                  {s.name} ({count})
                </option>
              );
            })}
        </select>
      )}

      {/* Election dropdown */}
      {(electionType === 'LS' || selectedStateId != null) && (
        <select
          className="form-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ minWidth: 220, width: 'auto', height: '34px' }}
        >
          <option value="">Select Election...</option>
          {visibleElections.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.year}){liveFirst && e.status === 'Live' ? ' — Live' : ''}
              {liveFirst && e.status !== 'Live' ? ` — ${e.status}` : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
