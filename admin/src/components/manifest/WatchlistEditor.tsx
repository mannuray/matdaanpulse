import { useState, useEffect } from 'react';
import { ManifestSection } from './ManifestSection';
import { EmptyState, AddButton, SearchableSelect, updateAt, removeAt } from './SharedControls';
import type { Watchlist, WatchlistEntry, Party, Constituency, Candidate } from '../../types';

export const WATCHLIST_PRESETS = [
  { id: 'leaders', name: 'Leaders' },
  { id: 'cabinet', name: 'Cabinet' },
  { id: 'celebrities', name: 'Celebrities' },
  { id: 'rebels', name: 'Rebels' },
  { id: 'key_battles', name: 'Key Battles' },
  { id: 'first_timers', name: 'First-Timers' },
];

export function WatchlistRow({ 
  entry, 
  eIdx, 
  onUpdate, 
  onRemove, 
  parties, 
  constituencies,
  partyMap,
  onSearchCandidates
}: {
  entry: WatchlistEntry;
  eIdx: number;
  onUpdate: (patch: Partial<WatchlistEntry>) => void;
  onRemove: () => void;
  parties: Party[];
  constituencies: Constituency[];
  partyMap: Map<string, Party>;
  onSearchCandidates: (query: string) => Promise<Candidate[]>;
}) {
  const [searchTerm, setSearchTerm] = useState(entry.name);
  const [results, setResults] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Keep state in sync with external data changes
  useEffect(() => {
    setSearchTerm(entry.name || '');
  }, [entry.name]);

  const handleSearch = async (query: string) => {
    setSearchTerm(query);
    onUpdate({ name: query });
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    try {
      const res = await onSearchCandidates(query);
      setResults(res || []);
      setShowDropdown(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (c: Candidate) => {
    onUpdate({
      name: c.name,
      party_id: c.party_id || '',
      const_id: c.const_id
    });
    setSearchTerm(c.name);
    setShowDropdown(false);
  };

  const p = partyMap.get(entry.party_id);

  return (
    <tr className={eIdx % 2 === 1 ? 'striped' : ''}>
      <td style={{ padding: '4px 6px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input 
            className="form-input mf-input-sm" 
            placeholder="Search candidate..." 
            value={searchTerm || ''}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => { if ((results || []).length > 0) setShowDropdown(true); }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          />
          {loading && <span className="spinner spinner-xs" style={{ width: 10, height: 10, borderWidth: 1 }} />}
        </div>
        {showDropdown && (results || []).length > 0 && (
          <div className="mf-dropdown" style={{ left: 6, right: 6, top: '100%', minWidth: '280px', zIndex: 1000 }}>
            {(results || []).map(r => (
              <div key={r.id} className="mf-dropdown-item" onMouseDown={() => handleSelect(r)}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 'bold' }}>{r.name}</span>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
                    <span>{r.party_id}</span>
                    <span>&middot;</span>
                    <span>{r.const_id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </td>
      <td style={{ padding: '4px 6px' }}>
        <input className="form-input mf-input-sm" placeholder="Role (e.g. CM, rebel)" value={entry.role || ''}
          onChange={e => onUpdate({ role: e.target.value || undefined })} />
      </td>
      <td style={{ padding: '4px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <SearchableSelect
            value={entry.party_id}
            options={parties}
            onSelect={val => onUpdate({ party_id: val })}
            placeholder="Party..."
            getLabel={p => p.abbreviation || p.name}
            getValue={p => p.id}
            filter={(p, q) => 
              p.name.toLowerCase().includes(q) || 
              (p.abbreviation || '').toLowerCase().includes(q) || 
              p.id.toLowerCase().includes(q)
            }
            renderItem={p => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {p.color && <span className="mf-chip-dot" style={{ background: p.color }} />}
                <span style={{ fontWeight: 600 }}>{p.abbreviation || p.id}</span>
                <span className="mf-item-sub">{p.name}</span>
              </div>
            )}
          />
          {p?.color && <span className="mf-chip-dot" style={{ background: p.color }} />}
        </div>
      </td>
      <td style={{ padding: '4px 6px' }}>
        <SearchableSelect
          value={entry.const_id}
          options={constituencies}
          onSelect={val => onUpdate({ const_id: val })}
          placeholder="Constituency..."
          getLabel={c => `${c.name} (#${c.const_no})`}
          getValue={c => c.id}
          filter={(c, q) => 
            c.name.toLowerCase().includes(q) || 
            c.id.toLowerCase().includes(q) || 
            String(c.const_no).includes(q)
          }
          renderItem={c => (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>#{c.const_no}</span>
                <span>{c.name}</span>
              </div>
            </div>
          )}
        />
      </td>
      <td style={{ padding: '4px 6px' }}>
        <button className="mf-remove-btn" onClick={onRemove} title="Remove">&times;</button>
      </td>
    </tr>
  );
}

export function WatchlistEditor({
  watchlists,
  contestingParties,
  constituencies,
  partyMap,
  onSearchCandidates,
  onUpdate
}: {
  watchlists: Watchlist[];
  contestingParties: Party[];
  constituencies: Constituency[];
  partyMap: Map<string, Party>;
  onSearchCandidates: (query: string) => Promise<Candidate[]>;
  onUpdate: (watchlists: Watchlist[]) => void;
}) {
  const items = watchlists || [];
  const unusedPresets = WATCHLIST_PRESETS.filter(p => !items.some(w => w && w.id === p.id));

  const updateWatchlist = (wIdx: number, patch: Partial<Watchlist>) => {
    onUpdate(updateAt(items, wIdx, patch));
  };

  const updateWatchlistEntry = (wIdx: number, eIdx: number, patch: Partial<WatchlistEntry>) => {
    const w = items[wIdx];
    if (w) updateWatchlist(wIdx, { entries: updateAt(w.entries || [], eIdx, patch) });
  };

  const removeWatchlistEntry = (wIdx: number, eIdx: number) => {
    const w = items[wIdx];
    if (w) updateWatchlist(wIdx, { entries: removeAt(w.entries || [], eIdx) });
  };

  const addWatchlist = (id: string, name: string) => {
    if (items.some(w => w && w.id === id)) return;
    onUpdate([...items, { id, name, entries: [] }]);
  };

  const removeWatchlist = (wIdx: number) => {
    onUpdate(removeAt(items, wIdx));
  };

  return (
    <ManifestSection title="Watchlists" description="Track key candidates on the live results dashboard" count={items.length} defaultOpen={items.length > 0}>
      {items.length === 0 && <EmptyState text="No watchlists configured." />}

      {items.map((w, wIdx) => {
        if (!w) return null;
        return (
          <div 
            key={w.id || wIdx} 
            className="mf-watchlist-card" 
            style={{ 
              marginBottom: 'var(--space-3)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'visible'
            }}
          >
            <div className="mf-watchlist-header" style={{ 
              padding: 'var(--space-1) var(--space-4)', 
              background: 'var(--bg-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <input className="form-input mf-watchlist-name" 
                style={{ 
                  fontSize: '13px', 
                  fontWeight: 'bold', 
                  background: 'transparent', 
                  border: 'none',
                  padding: '2px 4px'
                }} 
                value={w.name || ''} placeholder="Watchlist Name (e.g. VIP Seats)"
                onChange={e => updateWatchlist(wIdx, { name: e.target.value })} />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="mf-inline-hint">{(w.entries || []).length} entries</span>
                <button className="mf-remove-btn" 
                  onClick={() => removeWatchlist(wIdx)} title="Remove watchlist">&times;</button>
              </div>
            </div>

            <div className="mf-watchlist-entries" style={{ padding: 0 }}>
              <div className="mf-data-grid">
                <table className="admin-table" style={{ border: 'none', marginBottom: 0, tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-primary)' }}>
                      <th style={{ width: '35%', padding: '4px 6px' }}>Candidate</th>
                      <th style={{ width: '20%', padding: '4px 6px' }}>Role</th>
                      <th style={{ width: '20%', padding: '4px 6px' }}>Party</th>
                      <th style={{ width: '20%', padding: '4px 6px' }}>Constituency</th>
                      <th style={{ width: '5%', padding: '4px 6px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(w.entries || []).map((entry, eIdx) => (
                      <WatchlistRow 
                        key={eIdx}
                        entry={entry}
                        eIdx={eIdx}
                        onUpdate={(patch) => updateWatchlistEntry(wIdx, eIdx, patch)}
                        onRemove={() => removeWatchlistEntry(wIdx, eIdx)}
                        parties={contestingParties || []}
                        constituencies={constituencies || []}
                        partyMap={partyMap}
                        onSearchCandidates={onSearchCandidates}
                      />
                    ))}
                  </tbody>
                </table>
                {(w.entries || []).length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    No entries added to this watchlist.
                  </div>
                )}
              </div>

              <div style={{ padding: '8px 12px', background: 'var(--bg-primary)', borderTop: '1px solid var(--border)' }}>
                <AddButton label="Add Entry" onClick={() =>
                  updateWatchlist(wIdx, { entries: [...(w.entries || []), { name: '', party_id: '', const_id: '' }] })} />
              </div>
            </div>
          </div>
        );
      })}

      <div className="mf-watchlist-actions">
        {unusedPresets.length > 0 && (
          <div className="mf-preset-row" style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            {unusedPresets.map(p => (
              <button key={p.id} className="mf-preset-btn" onClick={() => addWatchlist(p.id, p.name)} style={{ fontSize: '11px', padding: '2px 8px' }}>+ {p.name}</button>
            ))}
          </div>
        )}
        <AddButton label="Custom Watchlist" onClick={() => {
          const id = `custom_${Date.now()}`;
          addWatchlist(id, '');
        }} />
      </div>
    </ManifestSection>
  );
}
