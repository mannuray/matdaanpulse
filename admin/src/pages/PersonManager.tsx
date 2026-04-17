import { useNavigate } from 'react-router-dom';
import { getPersons } from '../services/person.api';
import { useResourceList } from '../hooks/useResourceList';
import Spinner from '../components/atoms/Spinner';
import type { PersonWithStats } from '../types';

/**
 * PAGE: Person Manager (MVC: View)
 */
export default function PersonManager() {
  const navigate = useNavigate();

  const list = useResourceList<{}>({
    key: 'persons',
    initialFilters: {},
    onLoad: async (page, search) => {
      const res = await getPersons(page, 50, search || undefined);
      return {
        data: res.data || [],
        total: res.pagination?.total || 0
      };
    }
  });

  const { 
    items: persons, loading, search, handleSearch, page, totalPages, loadPage, navigateWithScroll 
  } = list;

  return (
    <div className="fade-in" style={{ background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '60px' }}>
      {/* 1. Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: 'var(--space-4) var(--space-6)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Master Registry</h1>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Person master records across all election cycles
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <input 
            className="form-input" 
            placeholder="SEARCH REGISTRY BY NAME..." 
            value={search} 
            onChange={e => handleSearch(e.target.value)} 
            style={{ width: '100%', height: 28, background: 'transparent', border: 'none', fontSize: '11px', fontWeight: 600 }} 
          />
        </div>
      </div>

      <div style={{ padding: 'var(--space-6)' }}>
        {loading && persons.length === 0 ? (
          <Spinner label="Scanning master registry..." />
        ) : (
          <div className="card-elevated" style={{ padding: 0 }}>
            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Person</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Details</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Activity</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {persons.map((p: PersonWithStats) => (
                  <tr key={p.id} className="row-hover" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {p.photo_url ? <img src={p.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontWeight: 800, fontSize: '12px' }}>{p.name.charAt(0)}</span>}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '13px' }}>{p.name}</div>
                          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{p.id.split('-')[0]}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>{p.education || 'No education data'}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>{p.gender === 'M' ? 'MALE' : p.gender === 'F' ? 'FEMALE' : 'NOT SPECIFIED'}</div>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '10px', fontWeight: 800 }}>
                        {p.candidate_count} CONTESTS
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <button onClick={() => navigateWithScroll(() => navigate(`/persons/${p.id}`))} className="btn btn-sm btn-outline" style={{ fontSize: '10px', padding: '2px 12px' }}>VIEW PROFILE</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Pagination */}
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>PAGE {page} OF {totalPages}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button disabled={page === 1} onClick={() => loadPage(page - 1)} className="btn btn-xs btn-outline">PREV</button>
                <button disabled={page === totalPages} onClick={() => loadPage(page + 1)} className="btn btn-xs btn-outline">NEXT</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
