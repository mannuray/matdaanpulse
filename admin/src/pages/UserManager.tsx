import React, { useState } from 'react';
import { useUserManager } from '../hooks/useUserManager';
import AdminPageHeader from '../components/common/AdminPageHeader';
import Spinner from '../components/atoms/Spinner';
import ErrorBoundary from '../components/atoms/ErrorBoundary';
import type { User } from '../types';

/**
 * PAGE: User Management (MVC: View)
 * Integrated control panel for administrative access and tiers.
 */
export default function UserManager() {
  const manager = useUserManager();
  const { 
    items: users, loading, search, handleSearch, saving, 
    handleCreate, handleUpdateRole, handleDelete 
  } = manager;

  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'VIEWER' });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await handleCreate(form);
    if (res) {
      setShowForm(false);
      setForm({ email: '', password: '', name: '', role: 'VIEWER' });
    }
  };

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <AdminPageHeader 
        title="User Management"
        subtitle="Control administrative access and permission tiers"
        actions={
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary" style={styles.addBtn}>
            {showForm ? 'CLOSE FORM' : '+ REGISTER NEW USER'}
          </button>
        }
      />

      <ErrorBoundary>
        <div style={styles.searchBarRoot}>
          <div style={styles.searchBox}>
            <input 
              className="form-input" 
              placeholder="SEARCH USERS BY NAME OR EMAIL..." 
              value={search} 
              onChange={e => handleSearch(e.target.value)} 
              style={styles.searchInput} 
            />
          </div>
        </div>
      </ErrorBoundary>

      <div style={{ padding: 'var(--space-6)' }}>
        {showForm && (
          <ErrorBoundary>
            <UserForm 
              form={form} 
              setForm={setForm} 
              saving={saving} 
              onCancel={() => setShowForm(false)} 
              onSubmit={onSubmit} 
            />
          </ErrorBoundary>
        )}

        {loading && users.length === 0 ? (
          <Spinner label="Scanning user directory..." />
        ) : (
          <ErrorBoundary>
            <div className="card-elevated" style={{ padding: 0 }}>
              <UserTable 
                users={users} 
                onUpdateRole={handleUpdateRole} 
                onDeleteRequest={setConfirmDelete} 
              />
            </div>
          </ErrorBoundary>
        )}
      </div>

      {confirmDelete && (
        <DeleteDialog 
          onConfirm={() => { handleDelete(confirmDelete); setConfirmDelete(null); }} 
          onCancel={() => setConfirmDelete(null)} 
        />
      )}
    </div>
  );
}

// --- Internal Sub-Components ---

function UserForm({ form, setForm, saving, onCancel, onSubmit }: any) {
  return (
    <div className="card-elevated" style={styles.formCard}>
      <div style={styles.formHeader}>
        <h3 style={styles.formTitle}>NEW ADMINISTRATOR REGISTRATION</h3>
      </div>
      <form onSubmit={onSubmit} style={{ padding: '24px' }}>
        <div className="form-grid form-grid-2">
          <div className="form-group">
            <label className="form-label" style={styles.labelSmall}>FULL NAME *</label>
            <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required style={styles.inputHeight} />
          </div>
          <div className="form-group">
            <label className="form-label" style={styles.labelSmall}>EMAIL ADDRESS *</label>
            <input type="email" className="form-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required style={styles.inputHeight} />
          </div>
          <div className="form-group">
            <label className="form-label" style={styles.labelSmall}>TEMPORARY PASSWORD *</label>
            <input type="password" className="form-input" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={8} style={styles.inputHeight} />
          </div>
          <div className="form-group">
            <label className="form-label" style={styles.labelSmall}>PERMISSION ROLE</label>
            <select className="form-select" value={form.role} onChange={e => setForm({...form, role: e.target.value})} style={styles.inputHeight}>
              <option value="VIEWER">Viewer (Read Only)</option>
              <option value="EDITOR">Editor (Can Update Results)</option>
              <option value="SUPER_ADMIN">Super Admin (Full Access)</option>
            </select>
          </div>
        </div>
        <div className="form-actions" style={styles.formActions}>
          <button type="submit" disabled={saving} className="btn btn-primary" style={styles.submitBtn}>
            {saving ? 'REGISTERING...' : 'REGISTER USER'}
          </button>
          <button type="button" onClick={onCancel} className="btn btn-outline" style={styles.inputHeight}>CANCEL</button>
        </div>
      </form>
    </div>
  );
}

function UserTable({ users, onUpdateRole, onDeleteRequest }: any) {
  return (
    <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={styles.tableHeadRow}>
          <th style={styles.thLeft}>Administrator</th>
          <th style={styles.thLeft}>Security Tier</th>
          <th style={styles.thLeft}>Created At</th>
          <th style={styles.thRight}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u: User) => (
          <tr key={u.id} className="row-hover" style={styles.dataRow}>
            <td style={styles.td}>
              <div style={{ fontWeight: 800, fontSize: '13px' }}>{u.name}</div>
              <div style={styles.emailSub}>{u.email}</div>
            </td>
            <td style={styles.td}>
              <select
                value={u.role}
                onChange={(e) => onUpdateRole(u.id, e.target.value)}
                className="form-select"
                style={styles.roleSelect}
              >
                <option value="VIEWER">VIEWER</option>
                <option value="EDITOR">EDITOR</option>
                <option value="SUPER_ADMIN">SUPER ADMIN</option>
              </select>
            </td>
            <td style={styles.tdTime}>
              {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '-'}
            </td>
            <td style={styles.tdRight}>
              <button 
                onClick={() => onDeleteRequest(u.id)} 
                className="btn btn-sm btn-outline" 
                style={styles.revokeBtn}
              >
                REVOKE ACCESS
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DeleteDialog({ onConfirm, onCancel }: any) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog card-elevated" onClick={(e) => e.stopPropagation()} style={styles.dialogRoot}>
        <h3 style={styles.dialogTitle}>Revoke User Access?</h3>
        <p style={styles.dialogText}>This user will be immediately logged out and permanently blocked from the admin panel.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onConfirm} className="btn btn-danger" style={{ fontWeight: 800 }}>YES, REVOKE</button>
          <button onClick={onCancel} className="btn btn-outline">CANCEL</button>
        </div>
      </div>
    </div>
  );
}

// --- Styles ---

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '60px' },
  addBtn: { height: 34, padding: '0 20px', fontSize: '11px', fontWeight: 800 },
  searchBarRoot: { background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '0 var(--space-6) var(--space-4) var(--space-6)' },
  searchBox: { background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
  searchInput: { width: '100%', height: 28, background: 'transparent', border: 'none', fontSize: '11px', fontWeight: 600 },
  formCard: { marginBottom: 'var(--space-6)', borderLeft: '4px solid var(--accent)' },
  formHeader: { padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' },
  formTitle: { fontSize: '12px', fontWeight: 900, margin: 0 },
  labelSmall: { fontSize: '9px' },
  inputHeight: { height: 34 },
  formActions: { marginTop: 'var(--space-4)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' },
  submitBtn: { padding: '0 24px', height: 34, fontSize: '11px', fontWeight: 800 },
  tableHeadRow: { background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  thLeft: { padding: '12px 16px', textAlign: 'left' as const, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' as const, color: 'var(--text-muted)' },
  thRight: { padding: '12px 16px', textAlign: 'right' as const, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' as const, color: 'var(--text-muted)' },
  dataRow: { borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' },
  td: { padding: '12px 16px' },
  tdRight: { padding: '12px 16px', textAlign: 'right' as const },
  emailSub: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 },
  roleSelect: { height: 28, fontSize: '10px', fontWeight: 800, width: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--border)' },
  tdTime: { padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' },
  revokeBtn: { color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '10px', fontWeight: 800 },
  dialogRoot: { maxWidth: 400, padding: '24px' },
  dialogTitle: { fontSize: 'var(--text-lg)', fontWeight: 800, margin: '0 0 12px' },
  dialogText: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 },
};
