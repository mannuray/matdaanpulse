import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConstituencyManager } from '../hooks/useConstituencyManager';
import AdminLandingCard from '../components/common/AdminLandingCard';
import AdminPageHeader from '../components/common/AdminPageHeader';
import ElectionPicker from '../components/ElectionPicker';
import Spinner from '../components/atoms/Spinner';
import type { Constituency, Election, State } from '../types';

/**
 * PAGE: Constituency Manager (MVC: View)
 * Central hub for geographical metadata and classification tags.
 */
export default function ConstituencyManager() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canWrite = hasRole('SUPER_ADMIN', 'EDITOR');
  const manager = useConstituencyManager();

  const { 
    selectedElection, setSelectedElection, loading, 
    constituencies, computing, computeAnalysis
  } = manager;

  if (!selectedElection) {
    return (
      <AdminLandingCard
        title="Constituency Manager"
        subtitle="Geographical Intelligence Hub"
        description="Select an election to manage its constituencies, demographic metadata, and classification tags."
        icon="📍"
        selectedId={selectedElection}
        onSelectionChange={setSelectedElection}
      />
    );
  }

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <AdminPageHeader 
        title="Constituency Management"
        subtitle="Administrative metadata and strategic profiling"
        actions={canWrite && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className="btn btn-outline" 
              onClick={computeAnalysis} 
              disabled={computing}
              style={styles.computeBtn}
            >
              {computing ? 'COMPUTING...' : 'COMPUTE ALL ANALYSIS'}
            </button>
          </div>
        )}
      />

      <FilterBar 
        selectedElection={selectedElection}
        setSelectedElection={setSelectedElection}
        elections={manager.elections}
        states={manager.states}
        search={manager.search}
        setSearch={manager.setSearch}
        districtFilter={manager.districtFilter}
        setDistrictFilter={manager.setDistrictFilter}
        tagFilter={manager.tagFilter}
        setTagFilter={manager.setTagFilter}
        allDistricts={manager.allDistricts}
        allTags={manager.allTags}
        selection={manager.selection}
        bulkAddTag={manager.bulkAddTag}
      />

      <div style={{ padding: 'var(--space-6)' }}>
        <div className="card-elevated" style={{ padding: 0 }}>
          {loading ? (
            <Spinner label="Mapping geographic hierarchy..." />
          ) : (
            <ConstituencyTable 
              constituencies={constituencies} 
              selection={manager.selection}
              navigate={navigate} 
            />
          )}
        </div>
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
  search: string;
  setSearch: (s: string) => void;
  districtFilter: string;
  setDistrictFilter: (d: string) => void;
  tagFilter: string;
  setTagFilter: (t: string) => void;
  allDistricts: string[];
  allTags: string[];
  selection: any;
  bulkAddTag: (tag: string) => void;
}

function FilterBar({ 
  selectedElection, setSelectedElection, elections, states,
  search, setSearch, districtFilter, setDistrictFilter, tagFilter, setTagFilter,
  allDistricts, allTags, selection, bulkAddTag
}: FilterBarProps) {
  return (
    <div style={styles.filterBarRoot}>
      <div style={styles.filterRow}>
        <ElectionPicker
          value={selectedElection}
          onChange={setSelectedElection}
          elections={elections}
          states={states}
        />

        <input 
          className="form-input" 
          placeholder="SEARCH NAME/NO..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          style={styles.searchInput} 
        />

        <select 
          className="form-select" 
          value={districtFilter} 
          onChange={e => setDistrictFilter(e.target.value)} 
          style={styles.filterSelect}
        >
          <option value="">ALL DISTRICTS</option>
          {allDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <select 
          className="form-select" 
          value={tagFilter} 
          onChange={e => setTagFilter(e.target.value)} 
          style={styles.filterSelect}
        >
          <option value="">ALL TAGS</option>
          {allTags.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>

        {selection.selectedIds.size > 0 && (
          <div style={styles.bulkActions}>
            <span style={styles.selectionCount}>{selection.selectedIds.size} SELECTED</span>
            <select 
              className="form-select" 
              onChange={e => bulkAddTag(e.target.value)} 
              value="" 
              style={styles.bulkSelect}
            >
              <option value="">BULK TAG...</option>
              <option value="yadav_dominated">YADAV DOMINATED</option>
              <option value="bhumihar_dominated">BHUMIHAR DOMINATED</option>
              <option value="kurmi_belt">KURMI BELT</option>
              <option value="urban">URBAN</option>
              <option value="rural">RURAL</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

interface TableProps {
  constituencies: Constituency[];
  selection: any;
  navigate: (path: string) => void;
}

function ConstituencyTable({ constituencies, selection, navigate }: TableProps) {
  return (
    <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={styles.tableHeadRow}>
          <th style={styles.thCheck}>
            <input 
              type="checkbox" 
              checked={selection.isAllSelected} 
              onChange={selection.selectAll} 
            />
          </th>
          <th style={styles.thLeft}>#</th>
          <th style={styles.thLeft}>Constituency</th>
          <th style={styles.thLeft}>District / Region</th>
          <th style={styles.thLeft}>Tags</th>
          <th style={styles.thRight}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {constituencies.map((c) => {
          const cTags = (c.metadata?.tags as string[]) || [];
          return (
            <tr key={c.id} className="row-hover" style={styles.dataRow}>
              <td style={styles.tdCheck}>
                <input 
                  type="checkbox" 
                  checked={selection.selectedIds.has(c.id)} 
                  onChange={() => selection.toggle(c.id)} 
                />
              </td>
              <td style={styles.tdNo}>{c.const_no}</td>
              <td style={styles.td}>
                <div style={{ fontWeight: 800, fontSize: '13px' }}>{c.name}</div>
                <div style={styles.constType}>{c.type}</div>
              </td>
              <td style={styles.td}>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>{c.district?.name || '-'}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>{c.region?.name || '-'}</div>
              </td>
              <td style={styles.td}>
                <div style={styles.tagList}>
                  {cTags.slice(0, 3).map(tag => (
                    <span key={tag} className="badge badge-neutral" style={styles.tagBadge}>{tag.replace(/_/g, ' ')}</span>
                  ))}
                  {cTags.length > 3 && <span style={styles.tagMore}>+{cTags.length - 3}</span>}
                </div>
              </td>
              <td style={styles.tdRight}>
                <button onClick={() => navigate(`/constituencies/${c.id}`)} className="btn btn-sm btn-outline" style={styles.actionBtn}>VIEW</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// --- Styles ---

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '100px' },
  computeBtn: { padding: '6px 16px', fontSize: '11px', fontWeight: 700, borderRadius: 'var(--radius-sm)' },
  filterBarRoot: { background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '0 var(--space-6) var(--space-4) var(--space-6)' },
  filterRow: { display: 'flex', gap: '12px', alignItems: 'center' },
  searchInput: { width: 200, height: 32, fontSize: '11px', fontWeight: 600 },
  filterSelect: { width: 160, height: 32, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const },
  bulkActions: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--accent-soft)', padding: '2px 12px', borderRadius: 20, border: '1px solid var(--accent-soft)' },
  selectionCount: { fontSize: '10px', fontWeight: 900, color: 'var(--accent)' },
  bulkSelect: { background: 'none', border: 'none', fontSize: '10px', fontWeight: 800, color: 'var(--accent)', cursor: 'pointer' },
  tableHeadRow: { background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  thCheck: { width: 40, padding: '12px 16px', textAlign: 'center' as const },
  thLeft: { padding: '12px 16px', textAlign: 'left' as const, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' as const, color: 'var(--text-muted)' },
  thRight: { padding: '12px 16px', textAlign: 'right' as const, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' as const, color: 'var(--text-muted)' },
  dataRow: { borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' },
  tdCheck: { padding: '10px 16px', textAlign: 'center' as const },
  tdNo: { padding: '10px 16px', fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' },
  td: { padding: '10px 16px' },
  tdRight: { padding: '10px 16px', textAlign: 'right' as const },
  constType: { fontSize: '9px', color: 'var(--text-muted)', fontWeight: 800 },
  tagList: { display: 'flex', gap: 4, alignItems: 'center' },
  tagBadge: { fontSize: '8px', padding: '2px 6px' },
  tagMore: { fontSize: '8px', color: 'var(--text-muted)', fontWeight: 700 },
  actionBtn: { fontSize: '10px', padding: '2px 8px' },
};
