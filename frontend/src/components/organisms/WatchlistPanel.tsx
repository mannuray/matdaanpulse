import { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../atoms/StatusBadge';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { Watchlist, ManifestLeader, ManifestCabinet, ResultRow } from '../../types';

interface WatchlistItem {
  const_id: string;
  label: string;
}

interface WatchlistPanelProps {
  electionId: string;
  watchlists?: Watchlist[];
  /** @deprecated Use watchlists instead */
  leaders?: ManifestLeader[];
  /** @deprecated Use watchlists instead */
  cabinet?: ManifestCabinet[];
  resultMap: Map<string, ResultRow>;
  partyColorMap: Map<string, string>;
  allConstituencies: string[];
  onConstituencyClick: (id: string) => void;
}

interface RowProps {
  constId: string;
  name: string;
  partyId: string;
  subtitle?: string;
  removable?: boolean;
  result?: ResultRow;
  partyColor: string;
  onClick: (id: string) => void;
  onRemove?: (id: string) => void;
}

const WatchlistRow = memo(function WatchlistRow({
  constId, name, partyId, subtitle, removable, result, partyColor, onClick, onRemove
}: RowProps) {
  const leaderWon = !partyId || partyId === result?.party_id;
  const displayStatus = leaderWon ? result?.status : 'LOST';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) 12px',
        borderBottom: '1px solid var(--border)', cursor: 'pointer',
        fontSize: 'var(--text-xs)', borderLeft: `3px solid ${partyColor}`,
        background: 'var(--bg-primary)', transition: 'background 0.2s'
      }}
      onClick={() => onClick(constId)}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-primary)')}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <div style={{ fontWeight: 'var(--weight-bold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)', fontSize: '12px' }}>
          {name}
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 'var(--weight-medium)', letterSpacing: '0.02em' }}>
          {subtitle || constId.replace(/_/g, ' ')}
        </div>
      </div>
      {result ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
          <StatusBadge status={displayStatus || 'TRAILING'} />
          <span style={{ fontSize: '10px', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums', width: 45, textAlign: 'right', color: 'var(--text-primary)' }}>
            {result.margin > 0 ? `${leaderWon ? '+' : '-'}${result.margin.toLocaleString()}` : '—'}
          </span>
        </div>
      ) : (
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 'var(--weight-medium)', textTransform: 'uppercase' }}>No Data</span>
      )}
      {removable && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(constId); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px',
            color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1,
          }}
          title="Remove"
        >
          ×
        </button>
      )}
    </div>
  );
});

const WatchlistPanel = memo(function WatchlistPanel({
  electionId, watchlists: rawWatchlists, leaders, cabinet, resultMap, partyColorMap, allConstituencies, onConstituencyClick,
}: WatchlistPanelProps) {
  const { t } = useTranslation();
  const [activeIdx, setActiveIdx] = useState(0);
  const [userWatchlist, setUserWatchlist] = useLocalStorage<WatchlistItem[]>(`watchlist_${electionId}`, []);
  const [search, setSearch] = useState('');

  const tabs = useMemo(() => {
    const result: { id: string; name: string; entries: { name: string; party_id: string; const_id: string; role?: string }[]; editable?: boolean }[] = [];
    if (rawWatchlists && rawWatchlists.length > 0) {
      for (const w of rawWatchlists) {
        if (w.entries.length > 0) result.push({ id: w.id, name: w.name, entries: w.entries });
      }
    } else {
      if (leaders && leaders.length > 0) {
        result.push({ id: 'leaders', name: t('leaders', 'Leaders'), entries: leaders.map(l => ({ name: l.name, party_id: l.party_id, const_id: l.const_id })) });
      }
      if (cabinet && cabinet.length > 0) {
        result.push({ id: 'cabinet', name: t('cabinet', 'Cabinet'), entries: cabinet.map(c => ({ name: c.name, party_id: c.party_id, const_id: c.const_id, role: c.role })) });
      }
    }
    result.push({ id: 'custom', name: t('watchlist', 'Watchlist'), entries: userWatchlist.map(w => ({ name: w.label, party_id: '', const_id: w.const_id })), editable: true });
    return result;
  }, [rawWatchlists, leaders, cabinet, userWatchlist, t]);

  const safeIdx = activeIdx < tabs.length ? activeIdx : 0;
  const activeTab = tabs[safeIdx];

  const addToWatchlist = (constId: string) => {
    setUserWatchlist((prev) => {
      if (prev.some((w) => w.const_id === constId)) return prev;
      return [...prev, { const_id: constId, label: constId.replace(/_/g, ' ') }];
    });
    setSearch('');
  };

  const removeFromWatchlist = (constId: string) => {
    setUserWatchlist((prev) => prev.filter((w) => w.const_id !== constId));
  };

  const filteredSearch = search.trim()
    ? allConstituencies
        .filter((c) => c.toLowerCase().includes(search.toLowerCase().replace(/\s+/g, '_')))
        .filter((c) => !userWatchlist.some((w) => w.const_id === c))
        .slice(0, 8)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 'var(--space-2) 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
        <div className="map-tabs" style={{ width: '100%' }}>
          {tabs.map((tab, i) => (
            <button key={tab.id} onClick={() => setActiveIdx(i)} className={`map-tab ${safeIdx === i ? 'active' : ''}`} style={{ flex: 1, fontSize: '10px' }}>
              {tab.name}
              {tab.entries.length > 0 && <span style={{ marginLeft: 4, opacity: 0.8 }}>{tab.entries.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {!activeTab?.editable && activeTab?.entries.map((entry) => {
          const subtitle = [entry.role, entry.party_id, entry.const_id.replace(/_/g, ' ')].filter(Boolean).join(' · ');
          const result = resultMap.get(entry.const_id);
          const color = partyColorMap.get(entry.party_id || result?.party_id || '') || '#6b7280';
          return (
            <WatchlistRow
              key={`${entry.const_id}-${entry.name}`}
              constId={entry.const_id}
              name={entry.name}
              partyId={entry.party_id}
              subtitle={subtitle}
              result={result}
              partyColor={color}
              onClick={onConstituencyClick}
            />
          );
        })}

        {activeTab?.editable && (
          <>
            <div style={{ padding: 'var(--space-2) 12px', borderBottom: '1px solid var(--border)', position: 'relative', background: 'var(--bg-secondary)' }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setSearch(''); }}
                placeholder="Search constituency to track..."
                style={{ width: '100%', padding: '6px 10px', fontSize: '11px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-primary)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }}
              />
              {filteredSearch.length > 0 && (
                <div style={{ position: 'absolute', left: 12, right: 12, top: 'calc(100% + 4px)', zIndex: 100, background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
                  {filteredSearch.map((c) => (
                    <div key={c} onClick={() => addToWatchlist(c)} style={{ padding: '8px 12px', fontSize: '11px', cursor: 'pointer', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      {c.replace(/_/g, ' ')}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {userWatchlist.length === 0 && (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}>
                Add constituencies to track your favorite seats
              </div>
            )}

            {userWatchlist.map((w) => {
              const result = resultMap.get(w.const_id);
              const color = partyColorMap.get(result?.party_id || '') || '#6b7280';
              return (
                <WatchlistRow
                  key={w.const_id}
                  constId={w.const_id}
                  name={w.label}
                  partyId=""
                  result={result}
                  partyColor={color}
                  onClick={onConstituencyClick}
                  onRemove={removeFromWatchlist}
                  removable
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
});

export default WatchlistPanel;
