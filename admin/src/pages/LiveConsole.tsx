import React, { useState } from 'react';
import { useLiveConsole } from '../hooks/useLiveConsole';
import AdminPageHeader from '../components/common/AdminPageHeader';
import ElectionPicker from '../components/ElectionPicker';
import Spinner from '../components/atoms/Spinner';
import ErrorBoundary from '../components/atoms/ErrorBoundary';
import type { LiveConstituency, LiveCandidate, LiveTab } from '../types';

/**
 * PAGE: Live Results Console (MVC: View)
 * Command center for real-time result monitoring and overrides.
 */
export default function LiveConsole() {
  const manager = useLiveConsole();
  const { loading, allConstituencies, expandedId, setExpandedId } = manager;

  return (
    <div className="lc-container" style={styles.pageRoot}>
      <ConsoleStyles />
      <AdminPageHeader 
        title="Live Results Console"
        subtitle={
          <div style={styles.statsRow}>
            TOTAL: {manager.stats.total} &middot; 
            <span style={{ color: 'var(--success)' }}> WON: {manager.stats.won}</span> &middot; 
            <span style={{ color: 'var(--accent)' }}> LEADING: {manager.stats.leading}</span> &middot; 
            PENDING: {manager.stats.pending}
          </div>
        }
        actions={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input 
              className="form-input" 
              placeholder="JUMP TO CONSTITUENCY..." 
              value={manager.searchQuery} 
              onChange={e => manager.setSearchQuery(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && manager.refresh() /* Simplified jump */}
              style={styles.searchInput} 
            />
            <button onClick={() => manager.refresh()} className="btn btn-outline" style={styles.headerBtn}>REFRESH</button>
          </div>
        }
      />

      <div style={styles.filterStrip}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', maxWidth: '1400px', margin: '0 auto' }}>
          <ElectionPicker value={manager.selectedElectionId} onChange={manager.setSelectedElectionId} />
          <div className="map-tabs" style={styles.tabsRoot}>
            {manager.tabs.map((tab, i) => (
              <button 
                key={i} 
                className={`map-tab ${manager.activeTab === i ? 'active' : ''}`} 
                onClick={() => manager.setActiveTab(i)}
                style={styles.tabBtn}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: 'var(--space-6)' }}>
        {loading && allConstituencies.length === 0 ? (
          <Spinner label="Synchronizing live streams..." />
        ) : (
          <div className="card-elevated" style={{ padding: 0 }}>
            <ErrorBoundary>
              <LiveTable 
                constituencies={manager.constituencies}
                expandedId={expandedId}
                flashIds={manager.flashIds}
                onToggleExpand={(id: string) => setExpandedId(expandedId === id ? null : id)}
                editingResultId={manager.editingResultId}
                setEditingResultId={manager.setEditingResultId}
                handleOverride={manager.handleOverride}
                saving={manager.saving}
              />
            </ErrorBoundary>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Internal Sub-Components ---

function ConsoleStyles() {
  return (
    <style>{`
      .lc-pulse { animation: lc-pulse-anim 1.5s ease-in-out; }
      @keyframes lc-pulse-anim {
        0% { box-shadow: inset 0 0 0 0 rgba(37, 99, 235, 0); }
        50% { box-shadow: inset 0 0 20px 0 rgba(37, 99, 235, 0.2); background: var(--accent-soft); }
        100% { box-shadow: inset 0 0 0 0 rgba(37, 99, 235, 0); }
      }
    `}</style>
  );
}

interface TableProps {
  constituencies: LiveConstituency[];
  expandedId: string | null;
  flashIds: Set<string>;
  onToggleExpand: (id: string) => void;
  editingResultId: string | null;
  setEditingResultId: (id: string | null) => void;
  handleOverride: (payload: any) => Promise<boolean>;
  saving: boolean;
}

function LiveTable({ 
  constituencies, expandedId, flashIds, onToggleExpand, 
  editingResultId, setEditingResultId, handleOverride, saving 
}: TableProps) {
  return (
    <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={styles.tableHeadRow}>
          <th style={styles.thCenter}>#</th>
          <th style={styles.thLeft}>Constituency</th>
          <th style={styles.thLeft}>Leader / Winner</th>
          <th style={styles.thRight}>Votes</th>
          <th style={styles.thRight}>Margin</th>
          <th style={styles.thCenter}>Status</th>
          <th style={{ width: 80 }}></th>
        </tr>
      </thead>
      <tbody>
        {constituencies.map((c) => (
          <LiveRow 
            key={c.const_id} 
            c={c} 
            isExpanded={expandedId === c.const_id}
            isFlashing={flashIds.has(c.const_id)}
            onToggle={() => onToggleExpand(c.const_id)}
            editingResultId={editingResultId}
            setEditingResultId={setEditingResultId}
            handleOverride={handleOverride}
            saving={saving}
          />
        ))}
      </tbody>
    </table>
  );
}

interface RowProps {
  c: LiveConstituency;
  isExpanded: boolean;
  isFlashing: boolean;
  onToggle: () => void;
  editingResultId: string | null;
  setEditingResultId: (id: string | null) => void;
  handleOverride: (payload: any) => Promise<boolean>;
  saving: boolean;
}

const LiveRow = React.memo(function LiveRow({ 
  c, isExpanded, isFlashing, onToggle, 
  editingResultId, setEditingResultId, handleOverride, saving 
}: RowProps) {
  const leader = c.candidates[0];
  const rowStyle = getRowStyle(c);

  return (
    <React.Fragment>
      <tr 
        className={`${isFlashing ? 'lc-pulse' : ''} row-hover`} 
        style={{ ...rowStyle, ...styles.dataRow }}
        onClick={onToggle}
      >
        <td style={styles.tdNo}>{c.const_no}</td>
        <td style={styles.td}>
          <div style={styles.constName}>{c.const_name}</div>
          <div style={styles.constType}>{c.const_type}</div>
        </td>
        <td style={styles.td}>
          {leader ? (
            <div style={styles.leaderCell}>
              <div style={{ ...styles.partyDot, background: leader.party_color || '#6b7280' }} />
              <span style={styles.leaderName}>{leader.candidate_name}</span>
              <span style={styles.partyAbbr}>{leader.party_abbr || leader.party_id}</span>
            </div>
          ) : '-'}
        </td>
        <td style={styles.tdVotes}>{leader?.votes.toLocaleString() || '-'}</td>
        <td style={{ ...styles.tdMargin, color: leader?.status === 'WON' ? 'var(--success)' : 'inherit' }}>
          {leader ? `+${leader.margin.toLocaleString()}` : '-'}
        </td>
        <td style={styles.tdCenter}>
          {leader && <StatusTag status={leader.status} />}
        </td>
        <td style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</span>
        </td>
      </tr>
      {isExpanded && (
        <ExpandedRow 
          c={c} 
          editingResultId={editingResultId}
          setEditingResultId={setEditingResultId}
          handleOverride={handleOverride}
          saving={saving}
        />
      )}
    </React.Fragment>
  );
});

interface ExpandedRowProps {
  c: LiveConstituency;
  editingResultId: string | null;
  setEditingResultId: (id: string | null) => void;
  handleOverride: (payload: any) => Promise<boolean>;
  saving: boolean;
}

const ExpandedRow = React.memo(function ExpandedRow({ c, editingResultId, setEditingResultId, handleOverride, saving }: ExpandedRowProps) {
  const [editForm, setEditForm] = useState({ votes: 0, margin: 0, status: '' });

  const startEdit = (cand: LiveCandidate) => {
    setEditingResultId(cand.result_id);
    setEditForm({ votes: cand.votes, margin: cand.margin, status: cand.status });
  };

  const onSave = async () => {
    const success = await handleOverride({
      result_id: editingResultId,
      votes: Number(editForm.votes),
      margin: Number(editForm.margin),
      status: editForm.status
    });
    if (success) setEditingResultId(null);
  };

  return (
    <tr>
      <td colSpan={7} style={styles.expandedCell}>
        <div style={{ display: 'grid', gap: 8 }}>
          {c.candidates.map((cand: LiveCandidate) => (
            <div key={cand.candidate_id} style={styles.candidateSubRow}>
              <div style={styles.candidateInfo}>
                <div style={{ ...styles.partyDotSmall, background: cand.party_color || '#6b7280' }} />
                <span style={styles.candNameSub}>{cand.candidate_name}</span>
                <span style={styles.partyAbbrSub}>{cand.party_abbr}</span>
              </div>
              
              {editingResultId === cand.result_id ? (
                <div style={styles.editFormRow}>
                  <input type="number" className="form-input" value={editForm.votes} onChange={e => setEditForm({...editForm, votes: parseInt(e.target.value)})} style={styles.editInput} />
                  <input type="number" className="form-input" value={editForm.margin} onChange={e => setEditForm({...editForm, margin: parseInt(e.target.value)})} style={styles.editInput} />
                  <select className="form-select" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})} style={styles.editInput}>
                    <option value="LEADING">LEADING</option>
                    <option value="WON">WON</option>
                    <option value="TRAILING">TRAILING</option>
                    <option value="LOST">LOST</option>
                  </select>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button disabled={saving} onClick={onSave} className="btn btn-xs btn-primary">SAVE</button>
                    <button onClick={() => setEditingResultId(null)} className="btn btn-xs btn-outline">ESC</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={styles.candVotesSub}>{cand.votes.toLocaleString()}</div>
                  <div style={styles.candMarginSub}>{cand.margin > 0 ? `+${cand.margin.toLocaleString()}` : cand.margin.toLocaleString()}</div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={styles.candStatusSub}>{cand.status}</span>
                  </div>
                  <button onClick={() => startEdit(cand)} className="btn btn-xs btn-outline" style={{ fontSize: 9 }}>OVERRIDE</button>
                </>
              )}
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
});

function StatusTag({ status }: { status: string }) {
  const style = {
    padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 900,
    background: status === 'WON' ? 'var(--success)' : status === 'LEADING' ? 'var(--accent)' : 'var(--bg-secondary)',
    color: status === 'TRAILING' ? 'var(--text-muted)' : '#fff'
  };
  return <span style={style as any}>{status}</span>;
}

// --- Helpers & Styles ---

function getRowStyle(c: LiveConstituency) {
  const leader = c.candidates[0];
  if (!leader) return {};
  if (leader.status === 'WON') return { background: 'var(--success-soft)' };
  if (leader.status === 'LEADING') {
    if (leader.margin > 0 && leader.margin < 1000) return { background: 'var(--warning-soft)' };
    return { background: 'var(--accent-soft)' };
  }
  return {};
}

const styles = {
  pageRoot: { height: '100vh', overflow: 'auto', background: 'var(--bg-secondary)' },
  statsRow: { fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' },
  searchInput: { width: 240, height: 32, fontSize: 11, fontWeight: 600 },
  headerBtn: { height: 32, fontSize: 11 },
  filterStrip: { background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: 'var(--space-2) var(--space-6)' },
  tabsRoot: { background: 'var(--bg-secondary)', padding: '2px', borderRadius: 'var(--radius-sm)' },
  tabBtn: { fontSize: '10px', fontWeight: 800, padding: '4px 12px' },
  tableHeadRow: { background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  thCenter: { padding: '12px 16px', textAlign: 'center' as const, fontSize: 10, fontWeight: 800 },
  thLeft: { padding: '12px 16px', textAlign: 'left' as const, fontSize: 10, fontWeight: 800 },
  thRight: { padding: '12px 16px', textAlign: 'right' as const, fontSize: 10, fontWeight: 800 },
  dataRow: { borderBottom: '1px solid var(--border)', cursor: 'pointer' },
  td: { padding: '12px 16px' },
  tdNo: { padding: '12px 16px', textAlign: 'center' as const, fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' },
  constName: { fontWeight: 800, fontSize: 13 },
  constType: { fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 },
  leaderCell: { display: 'flex', alignItems: 'center', gap: 8 },
  partyDot: { width: 8, height: 8, borderRadius: '50%' },
  leaderName: { fontWeight: 700, fontSize: 13 },
  partyAbbr: { fontSize: 10, color: 'var(--text-muted)', fontWeight: 800 },
  tdVotes: { padding: '12px 16px', textAlign: 'right' as const, fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 13 },
  tdMargin: { padding: '12px 16px', textAlign: 'right' as const, fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 13 },
  tdCenter: { padding: '12px 16px', textAlign: 'center' as const },
  expandedCell: { background: 'var(--bg-secondary)', padding: '12px 24px' },
  candidateSubRow: { 
    display: 'grid', gridTemplateColumns: '1fr 120px 120px 100px 120px', 
    gap: 16, alignItems: 'center', background: 'var(--bg-card)', 
    padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' 
  },
  candidateInfo: { display: 'flex', alignItems: 'center', gap: 8 },
  partyDotSmall: { width: 6, height: 6, borderRadius: '50%' },
  candNameSub: { fontWeight: 700, fontSize: 12 },
  partyAbbrSub: { fontSize: 9, color: 'var(--text-muted)', fontWeight: 800 },
  editFormRow: { display: 'contents' },
  editInput: { height: 28, fontSize: 11 },
  candVotesSub: { fontSize: 12, fontWeight: 800, textAlign: 'right' as const, fontFamily: 'var(--font-mono)' },
  candMarginSub: { fontSize: 12, fontWeight: 800, textAlign: 'right' as const, fontFamily: 'var(--font-mono)' },
  candStatusSub: { fontSize: 9, fontWeight: 900, color: 'var(--text-muted)' },
};
