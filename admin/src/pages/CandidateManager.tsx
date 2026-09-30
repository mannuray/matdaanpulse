import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCandidateManager, PersonFilter } from '../hooks/useCandidateManager';
import AdminLandingCard from '../components/common/AdminLandingCard';
import AdminPageHeader from '../components/common/AdminPageHeader';
import ElectionPicker from '../components/ElectionPicker';
import Spinner from '../components/atoms/Spinner';
import type { Candidate, Constituency, Election, State } from '../types';

/**
 * PAGE: Candidate Manager (MVC: View)
 * Integrated dashboard for linking candidates to master person records.
 */
export default function CandidateManager() {
  const navigate = useNavigate();
  const manager = useCandidateManager();

  const { 
    selectedElection, setSelectedElection, selectedConst, 
    constituencies, loading, candidates 
  } = manager;

  if (!selectedElection) {
    return (
      <AdminLandingCard
        title="Candidate Management"
        subtitle="Registry Reconciliation Engine"
        description="Select an election to reconcile candidate records with the master person registry."
        icon="🗳️"
        selectedId={selectedElection}
        onSelectionChange={setSelectedElection}
      />
    );
  }

  const selectedConstObj = constituencies.find(c => c.id === selectedConst);

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <AdminPageHeader 
        title="Candidate Management"
        subtitle={selectedConstObj && (
          <span>{selectedConstObj.name} (#{selectedConstObj.const_no}) — {selectedConstObj.type}</span>
        )}
      />

      <FilterBar 
        selectedElection={selectedElection}
        setSelectedElection={setSelectedElection}
        elections={manager.elections}
        states={manager.states}
        selectedConst={selectedConst}
        setSelectedConst={manager.setSelectedConst}
        constituencies={constituencies}
        search={manager.search}
        setSearch={manager.setSearch}
        globalSearch={manager.globalSearch}
        setGlobalSearch={manager.setGlobalSearch}
        globalResults={manager.globalResults}
        personFilter={manager.personFilter}
        setPersonFilter={manager.setPersonFilter}
        selectedConstObj={selectedConstObj}
      />

      <div style={{ padding: 'var(--space-6)' }}>
        {selectedElection && selectedConst && (
          <div className="card-elevated" style={{ padding: 0 }}>
            {loading ? (
              <Spinner label="Loading candidates..." />
            ) : (
              <CandidateTable 
                candidates={candidates} 
                linkingSuggestions={manager.linkingSuggestions}
                selectedMatches={manager.selectedMatches}
                toggleMatch={manager.toggleMatch}
                handleLink={manager.handleLink}
                handleUnlink={manager.handleUnlink}
                navigate={navigate} 
              />
            )}
          </div>
        )}
        
        {selectedElection && !selectedConst && (
          <div className="card-elevated" style={styles.emptyStateBox}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📍</div>
            <h3 style={{ fontWeight: 800 }}>Select Constituency</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Please select a constituency from the filter bar above to begin linking.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Internal Sub-Components ---

interface FilterBarProps {
  selectedElection: string;
  setSelectedElection: (id: string) => void;
  elections: Election[];
  states: State[];
  selectedConst: string;
  setSelectedConst: (id: string) => void;
  constituencies: Constituency[];
  search: string;
  setSearch: (q: string) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  globalResults: Candidate[];
  personFilter: PersonFilter;
  setPersonFilter: (f: PersonFilter) => void;
  selectedConstObj?: Constituency;
}

function FilterBar({ 
  selectedElection, setSelectedElection, elections, states,
  selectedConst, setSelectedConst, constituencies,
  search, setSearch, globalSearch, setGlobalSearch, globalResults,
  personFilter, setPersonFilter, selectedConstObj
}: FilterBarProps) {
  const [showConstDropdown, setShowConstDropdown] = useState(false);

  const filteredConsts = search
    ? constituencies.filter((c: Constituency) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        String(c.const_no).includes(search),
      )
    : constituencies;

  return (
    <div style={styles.filterBarRoot}>
      <div style={styles.filterRow}>
        <ElectionPicker
          value={selectedElection}
          onChange={setSelectedElection}
          elections={elections}
          states={states}
        />

        {selectedElection && (
          <div style={styles.constPickerWrapper}>
            <input
              className="form-input"
              style={styles.constInput}
              placeholder="FIND CONSTITUENCY..."
              value={showConstDropdown ? search : (selectedConstObj ? `${selectedConstObj.const_no}. ${selectedConstObj.name}` : '')}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => { setSearch(''); setShowConstDropdown(true); }}
              onBlur={() => setTimeout(() => setShowConstDropdown(false), 200)}
            />
            {showConstDropdown && (
              <div style={styles.dropdown}>
                {filteredConsts.map((c: Constituency) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedConst(c.id); setShowConstDropdown(false); }}
                    style={{
                      ...styles.dropdownItem,
                      background: c.id === selectedConst ? 'var(--accent-soft)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: c.id === selectedConst ? 700 : 500 }}>
                      {c.const_no}. {c.name}
                    </span>
                    <span style={styles.constTypeBadge}>{c.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={styles.searchWrapper}>
          <input
            className="form-input"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="SEARCH ALL CANDIDATES..."
            style={styles.searchInput}
          />
          {globalResults.length > 0 && (
            <div style={styles.dropdown}>
              {globalResults.map((c: Candidate) => (
                <button 
                  key={c.id} 
                  onClick={() => {
                    setGlobalSearch('');
                    setSelectedElection(c.election_id);
                    setSelectedConst(c.const_id);
                  }} 
                  className="row-hover" 
                  style={styles.searchResultItem}
                >
                  <div style={{ fontWeight: 700, fontSize: '12px' }}>{c.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                    {c.party_id || 'IND'} — {c.election_id.split('_').pop()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedElection && selectedConst && (
        <div style={styles.tabRow}>
          {(['all', 'linked', 'unlinked'] as PersonFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setPersonFilter(f)}
              style={{
                ...styles.tabBtn,
                background: personFilter === f ? 'var(--bg-card)' : 'transparent',
                color: personFilter === f ? 'var(--accent)' : 'var(--text-muted)',
                boxShadow: personFilter === f ? 'var(--shadow-sm)' : 'none'
              }}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface TableProps {
  candidates: Candidate[];
  linkingSuggestions: Map<string, { candidate: Candidate; matches: Candidate[] }>;
  selectedMatches: Map<string, Set<string>>;
  toggleMatch: (candidateId: string, matchId: string) => void;
  handleLink: (candidateId: string, matches: Candidate[]) => void;
  handleUnlink: (candidateId: string) => void;
  navigate: (path: string) => void;
}

function CandidateTable({ 
  candidates, linkingSuggestions, selectedMatches, 
  toggleMatch, handleLink, handleUnlink, navigate 
}: TableProps) {
  return (
    <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={styles.tableHeadRow}>
          <th style={styles.thLeft}>Candidate</th>
          <th style={styles.thLeft}>Affiliation</th>
          <th style={styles.thLeft}>Metadata</th>
          <th style={styles.thCenter}>Linked</th>
          <th style={styles.thRight}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {candidates.map((c) => (
          <CandidateRow 
            key={c.id} 
            c={c} 
            suggestion={linkingSuggestions.get(c.id)}
            selectedMatches={selectedMatches.get(c.id)}
            toggleMatch={toggleMatch}
            handleLink={handleLink}
            handleUnlink={handleUnlink}
            navigate={navigate} 
          />
        ))}
      </tbody>
    </table>
  );
}

interface RowProps {
  c: Candidate;
  suggestion?: { candidate: Candidate; matches: Candidate[] };
  selectedMatches?: Set<string>;
  toggleMatch: (candidateId: string, matchId: string) => void;
  handleLink: (candidateId: string, matches: Candidate[]) => void;
  handleUnlink: (candidateId: string) => void;
  navigate: (path: string) => void;
}

function CandidateRow({ 
  c, suggestion, selectedMatches, toggleMatch, handleLink, handleUnlink, navigate 
}: RowProps) {
  const m = (c.metadata || {}) as any;

  return (
    <React.Fragment>
      <tr className="row-hover" style={styles.dataRow}>
        <td style={styles.td}>
          <div style={{ fontWeight: 700, fontSize: '13px' }}>{c.name}</div>
          {c.is_incumbent && <span style={styles.incumbentBadge}>Incumbent</span>}
        </td>
        <td style={styles.td}>
          <div style={styles.affiliationCell}>
            <span style={{ ...styles.partyDot, background: (c as any).party?.color || '#cbd5e1' }} />
            {c.party_id || 'IND'}
          </div>
        </td>
        <td style={styles.td}>
          <div style={styles.metadataCell}>
            <span>Age: <strong>{m.age || '-'}</strong></span>
            <span>Cases: <strong style={{ color: m.criminal_cases > 0 ? 'var(--danger)' : 'inherit' }}>{m.criminal_cases || 0}</strong></span>
          </div>
        </td>
        <td style={styles.tdCenter}>
          {c.person_id ? (
            <span title={c.person_id} style={{ color: 'var(--success)', fontWeight: 800, fontSize: '14px' }}>✓</span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>×</span>
          )}
        </td>
        <td style={styles.tdRight}>
          <div style={styles.actionCell}>
            <button onClick={() => navigate(`/candidates/${c.id}`)} className="btn btn-sm btn-outline" style={styles.actionBtn}>VIEW</button>
            {c.person_id ? (
              <button onClick={() => handleUnlink(c.id)} className="btn btn-sm" style={{ color: 'var(--danger)', ...styles.actionBtn }}>UNLINK</button>
            ) : (
              <button onClick={() => navigate(`/persons?q=${encodeURIComponent(c.name)}`)} className="btn btn-sm" style={{ color: 'var(--accent)', ...styles.actionBtn }}>FIND</button>
            )}
          </div>
        </td>
      </tr>
      {suggestion && (
        <SuggestionRow 
          candidateId={c.id} 
          suggestion={suggestion} 
          selectedMatches={selectedMatches}
          toggleMatch={toggleMatch}
          handleLink={handleLink}
        />
      )}
    </React.Fragment>
  );
}

interface SuggestionProps {
  candidateId: string;
  suggestion: { candidate: Candidate; matches: Candidate[] };
  selectedMatches?: Set<string>;
  toggleMatch: (candidateId: string, matchId: string) => void;
  handleLink: (candidateId: string, matches: Candidate[]) => void;
}

function SuggestionRow({ candidateId, suggestion, selectedMatches, toggleMatch, handleLink }: SuggestionProps) {
  return (
    <tr>
      <td colSpan={5} style={{ padding: '4px 16px' }}>
        <div style={styles.suggestionBox}>
          <span style={styles.suggestionLabel}>SUGGESTIONS:</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, flex: 1 }}>
            {suggestion.matches.map((m: Candidate) => (
              <label key={m.id} style={styles.suggestionMatchLabel}>
                <input 
                  type="checkbox" 
                  checked={selectedMatches?.has(m.id) || false} 
                  onChange={() => toggleMatch(candidateId, m.id)} 
                />
                <span style={{ fontWeight: 600 }}>{m.election_id.split('_').pop()}</span>
              </label>
            ))}
          </div>
          <button 
            onClick={() => handleLink(candidateId, suggestion.matches)} 
            className="btn btn-primary" 
            style={styles.linkBtn}
          >
            LINK SELECTED
          </button>
        </div>
      </td>
    </tr>
  );
}

// --- Styles ---

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '40px' },
  headerRoot: { 
    background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', 
    padding: 'var(--space-4) var(--space-6)', position: 'sticky' as const, top: 0, zIndex: 100 
  },
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' },
  title: { fontSize: 'var(--text-xl)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' },
  subtitle: { fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  filterBarRoot: { background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '0 var(--space-6) var(--space-4) var(--space-6)' },
  filterRow: { display: 'flex', gap: '12px', alignItems: 'center' },
  constPickerWrapper: { position: 'relative' as const, width: 240 },
  constInput: { height: '32px', width: '100%', fontSize: '11px', fontWeight: 600 },
  dropdown: {
    position: 'absolute' as const, top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 110,
    background: 'var(--bg-card)', border: '1px solid var(--border)', 
    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', 
    maxHeight: 320, overflowY: 'auto' as const, padding: '4px'
  },
  dropdownItem: {
    width: '100%', textAlign: 'left' as const, padding: '8px 12px', border: 'none',
    cursor: 'pointer', borderRadius: 'var(--radius-sm)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  constTypeBadge: { fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)' },
  searchWrapper: { position: 'relative' as const, width: 300, marginLeft: 'auto' },
  searchInput: { width: '100%', height: '32px', fontSize: '11px', fontWeight: 600 },
  searchResultItem: { 
    display: 'flex', flexDirection: 'column' as const, width: '100%', 
    textAlign: 'left' as const, padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer' 
  },
  tabRow: { display: 'flex', gap: '4px', marginTop: 'var(--space-4)', background: 'var(--bg-secondary)', padding: '2px', borderRadius: 'var(--radius-sm)', width: 'fit-content' },
  tabBtn: {
    padding: '4px 12px', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '10px', fontWeight: 800,
    cursor: 'pointer', textTransform: 'uppercase' as const, letterSpacing: '0.02em',
  },
  tableHeadRow: { background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  thLeft: { padding: '12px 16px', textAlign: 'left' as const, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' as const, color: 'var(--text-muted)' },
  thCenter: { padding: '12px 16px', textAlign: 'center' as const, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' as const, color: 'var(--text-muted)' },
  thRight: { padding: '12px 16px', textAlign: 'right' as const, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' as const, color: 'var(--text-muted)' },
  dataRow: { borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'default' },
  td: { padding: '10px 16px' },
  tdCenter: { padding: '10px 16px', textAlign: 'center' as const },
  tdRight: { padding: '10px 16px', textAlign: 'right' as const },
  incumbentBadge: { fontSize: '8px', fontWeight: 900, color: 'var(--warning-text)', background: 'var(--warning-soft)', padding: '1px 4px', borderRadius: '2px', textTransform: 'uppercase' as const },
  affiliationCell: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', fontWeight: 600 },
  partyDot: { width: 8, height: 8, borderRadius: '50%' },
  metadataCell: { display: 'flex', gap: 8, fontSize: '11px', color: 'var(--text-secondary)' },
  actionCell: { display: 'flex', gap: 4, justifyContent: 'flex-end' },
  actionBtn: { fontSize: '10px', padding: '2px 8px' },
  suggestionBox: { background: 'var(--bg-secondary)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 16 },
  suggestionLabel: { fontSize: '10px', fontWeight: 900, color: 'var(--accent)' },
  suggestionMatchLabel: { display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px', cursor: 'pointer' },
  linkBtn: { height: '24px', fontSize: '9px', fontWeight: 800 },
  emptyStateBox: { padding: '80px 40px', textAlign: 'center' as const },
};
