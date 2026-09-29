import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePartyManager } from '../hooks/usePartyManager';
import Spinner from '../components/atoms/Spinner';

export default function PartyManager() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const canWrite = hasRole('SUPER_ADMIN', 'EDITOR');

  const manager = usePartyManager();
  const { 
    items: parties, loading, search, handleSearch, filters, updateFilters,
    page, totalPages, loadPage, navigateWithScroll, states,
    saving, handleCreate
  } = manager;

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', color: '#3b82f6', abbreviation: '' });

  const onSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await handleCreate({
      ...form,
      abbreviation: form.abbreviation || undefined
    });
    if (success) {
      setShowCreate(false);
      setForm({ id: '', name: '', color: '#3b82f6', abbreviation: '' });
    }
  };

  return (
    <div className="fade-in" style={{ background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '60px' }}>
      {/* 1. Controller Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: 'var(--space-4) var(--space-6)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Political Parties</h1>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Manage master registry and brand identifiers
            </div>
          </div>
          {canWrite && (
            <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary" style={{ height: 34, padding: '0 20px', fontSize: '11px', fontWeight: 800 }}>
              {showCreate ? 'CLOSE FORM' : '+ CREATE NEW PARTY'}
            </button>
          )}
        </div>

        {/* Dense Filter Bar */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', gap: '8px', background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <input 
              className="form-input" 
              placeholder="SEARCH BY NAME OR ID..." 
              value={search} 
              onChange={e => handleSearch(e.target.value)} 
              style={{ flex: 1, height: 28, background: 'transparent', border: 'none', fontSize: '11px', fontWeight: 600 }} 
            />
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '4px 0' }} />
            <select className="form-select" value={filters.stateId} onChange={e => updateFilters({ stateId: e.target.value ? Number(e.target.value) : '' })} style={{ width: 160, height: 28, background: 'transparent', border: 'none', fontSize: '11px', fontWeight: 700 }}>
              <option value="">ALL STATES</option>
              {states.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
            </select>
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '4px 0' }} />
            <select className="form-select" value={filters.symbol} onChange={e => updateFilters({ symbol: e.target.value as any })} style={{ width: 160, height: 28, background: 'transparent', border: 'none', fontSize: '11px', fontWeight: 700 }}>
              <option value="all">ALL SYMBOLS</option>
              <option value="has_logo">HAS LOGO</option>
              <option value="missing">MISSING IMAGE</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ padding: 'var(--space-6)' }}>
        {/* Inline Creation Form */}
        {showCreate && (
          <div className="card-elevated" style={{ marginBottom: 'var(--space-6)', borderLeft: '4px solid var(--accent)' }}>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 900, margin: 0 }}>NEW PARTY REGISTRATION</h3>
            </div>
            <form onSubmit={onSubmitCreate} style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px 80px auto', gap: 16, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '9px' }}>ID *</label>
                  <input className="form-input" value={form.id} onChange={e => setForm({...form, id: e.target.value.toUpperCase()})} required style={{ height: 34 }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '9px' }}>FULL NAME *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required style={{ height: 34 }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '9px' }}>ABBR</label>
                  <input className="form-input" value={form.abbreviation} onChange={e => setForm({...form, abbreviation: e.target.value.toUpperCase()})} style={{ height: 34 }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '9px' }}>COLOR</label>
                  <input type="color" className="form-input" value={form.color} onChange={e => setForm({...form, color: e.target.value})} style={{ height: 34, padding: 2 }} />
                </div>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ height: 34, padding: '0 24px', fontSize: '11px', fontWeight: 800 }}>
                  {saving ? 'SAVING...' : 'REGISTER'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading && parties.length === 0 ? (
          <Spinner label="Loading party registry..." />
        ) : (
          <div className="card-elevated" style={{ padding: 0 }}>
            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Identifier</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Official Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Symbol</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {parties.map((p) => (
                  <tr key={p.id} className="row-hover" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: p.color || 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: '10px' }}>
                          {p.abbreviation || p.id.slice(0, 3)}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '13px' }}>{p.id}</div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>{p.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{p.candidate_count || 0} candidates recorded</div>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      {p.symbol_url ? (
                        <img src={p.symbol_url} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                      ) : (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800 }}>MISSING</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <button onClick={() => navigateWithScroll(() => navigate(`/parties/${p.id}`))} className="btn btn-sm btn-outline" style={{ fontSize: '10px', padding: '2px 12px' }}>VIEW PROFILE</button>
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
