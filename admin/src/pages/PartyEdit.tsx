import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePartyEdit } from '../hooks/usePartyEdit';
import AdminPageHeader from '../components/common/AdminPageHeader';
import Spinner from '../components/atoms/Spinner';
import ErrorBoundary from '../components/atoms/ErrorBoundary';

/**
 * PAGE: Party Editor (MVC: View)
 * Integrated workspace for managing party identity, branding, and assets.
 */
export default function PartyEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const editor = usePartyEdit(id);
  const { party, loading, form } = editor;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await editor.handleSave();
    if (res) navigate(`/parties/${id}`);
  };

  if (loading) return <Spinner label="Accessing party registry..." />;
  if (!party) return <div style={{ padding: 40, textAlign: 'center' }}>Party not found.</div>;

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <ErrorBoundary>
        <AdminPageHeader 
          title={party.name}
          breadcrumb="Party Registry Editor"
          onBack={() => navigate(`/parties/${party.id}`)}
          actions={
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={editor.runEnrichment} disabled={editor.enriching} className="btn btn-outline" style={styles.actionBtn}>
                {editor.enriching ? 'AI ENRICHING...' : 'AI ENRICH ASSETS'}
              </button>
              <button onClick={onSubmit} disabled={editor.saving} className="btn btn-primary" style={styles.saveBtn}>
                {editor.saving ? 'SAVING...' : 'SAVE PARTY DATA'}
              </button>
            </div>
          }
        />
      </ErrorBoundary>

      <div style={styles.mainContainer}>
        <ErrorBoundary>
          <HeroSection form={form} partyId={party.id} fallbackName={party.name} />
        </ErrorBoundary>

        <div style={styles.contentGrid}>
          {/* Main Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <ErrorBoundary>
              <ProfileForm form={form} setForm={editor.setForm} />
            </ErrorBoundary>
            
            <ErrorBoundary>
              <div className="card-elevated" style={styles.cardPadding}>
                <h3 className="card-title-tiny">Narrative Profile</h3>
                <div className="form-group">
                  <label className="form-label" style={styles.labelSmall}>MASTER DESCRIPTION</label>
                  <textarea 
                    className="form-input" 
                    value={form.description} 
                    onChange={e => editor.setForm({...form, description: e.target.value})} 
                    rows={6} 
                    style={styles.descriptionTextarea} 
                  />
                </div>
              </div>
            </ErrorBoundary>
          </div>

          {/* Assets Sidebar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <ErrorBoundary>
              <SymbolCard
                label="Primary Brand Logo"
                url={form.symbol_url}
                onChangeUrl={(url: string) => editor.setForm({ ...form, symbol_url: url })}
                onRemove={() => editor.setForm({ ...form, symbol_url: '' })}
              />
            </ErrorBoundary>

            <ErrorBoundary>
              <SymbolCard
                label="ECI Election Symbol"
                url={form.eci_symbol_url}
                onChangeUrl={(url: string) => editor.setForm({ ...form, eci_symbol_url: url })}
                onRemove={() => editor.setForm({ ...form, eci_symbol_url: '' })}
              />
            </ErrorBoundary>
          </aside>
        </div>
      </div>
    </div>
  );
}

// --- Internal Sub-Components ---

interface HeroProps {
  form: any;
  partyId: string;
  fallbackName: string;
}

function HeroSection({ form, partyId, fallbackName }: HeroProps) {
  return (
    <div className="card-elevated" style={styles.heroCard}>
      <div style={{ ...styles.heroGlow, background: `linear-gradient(135deg, ${form.color}22 0%, rgba(0,0,0,0) 100%)` }} />
      <div style={styles.heroInner}>
        <div style={styles.heroSymbolBox}>
          {(form.symbol_url || form.eci_symbol_url) ? (
            <img src={form.symbol_url || form.eci_symbol_url} style={styles.heroSymbolImg} alt="" />
          ) : (
            <span style={{ fontWeight: 800, fontSize: 32, color: form.color }}>{form.abbreviation || partyId.slice(0, 2)}</span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={styles.heroName}>{form.name || fallbackName}</h2>
          <div style={styles.heroLinks}>
            {form.website && (
              <a href={form.website} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={styles.heroLinkBtn}>🌐 WEBSITE</a>
            )}
            {form.wikipedia_url && (
              <a href={form.wikipedia_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={styles.heroLinkBtn}>📖 WIKIPEDIA</a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FormProps {
  form: any;
  setForm: (f: any) => void;
}

function ProfileForm({ form, setForm }: FormProps) {
  const updateForm = (patch: any) => setForm({ ...form, ...patch });

  return (
    <div className="card-elevated" style={styles.cardPadding}>
      <h3 className="card-title-tiny">Organizational Profile</h3>
      <div style={styles.formGrid}>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>OFFICIAL NAME *</label>
          <input className="form-input" value={form.name} onChange={e => updateForm({ name: e.target.value })} required style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>ABBREVIATION</label>
          <input className="form-input" value={form.abbreviation} onChange={e => updateForm({ abbreviation: e.target.value.toUpperCase() })} style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>BRAND COLOR</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="color" className="form-input" value={form.color} onChange={e => updateForm({ color: e.target.value })} style={styles.colorInput} />
            <input className="form-input" value={form.color} onChange={e => updateForm({ color: e.target.value })} style={{ flex: 1, fontFamily: 'var(--font-mono)' }} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>CURRENT LEADER</label>
          <input className="form-input" value={form.leader_name} onChange={e => updateForm({ leader_name: e.target.value })} style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>FOUNDED YEAR</label>
          <input className="form-input" type="number" value={form.founded_year} onChange={e => updateForm({ founded_year: e.target.value })} style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>HEADQUARTERS</label>
          <input className="form-input" value={form.headquarters} onChange={e => updateForm({ headquarters: e.target.value })} style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>WEBSITE URL</label>
          <input className="form-input" value={form.website} onChange={e => updateForm({ website: e.target.value })} placeholder="https://..." style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>WIKIPEDIA URL</label>
          <input className="form-input" value={form.wikipedia_url} onChange={e => updateForm({ wikipedia_url: e.target.value })} placeholder="https://en.wikipedia.org/wiki/..." style={styles.inputHeight} />
        </div>
      </div>
    </div>
  );
}

interface SymbolProps {
  label: string;
  url: string;
  onChangeUrl: (u: string) => void;
  onRemove: () => void;
}

function SymbolCard({ label, url, onChangeUrl, onRemove }: SymbolProps) {
  const [showUrlInput, setShowUrlInput] = useState(false);
  return (
    <div className="card-elevated" style={styles.symbolCard}>
      <div className="card-title-tiny" style={{ marginBottom: 0 }}>{label}</div>
      <div style={styles.symbolPreview}>
        {url ? (
          <img src={url} style={styles.symbolImg} alt="" />
        ) : (
          <div style={styles.noAssetPlaceholder}>NO ASSET<br/>ASSIGNED</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, width: '100%' }}>
        <button type="button" className="btn btn-sm btn-outline" style={{ flex: 1, height: 32, fontSize: '10px' }} onClick={() => setShowUrlInput(!showUrlInput)}>
          {url ? 'CHANGE URL' : 'SET ASSET URL'}
        </button>
        {url && (
          <button type="button" className="btn btn-sm btn-outline" style={styles.removeBtn} onClick={onRemove}>🗑️</button>
        )}
      </div>
      {showUrlInput && (
        <div style={{ width: '100%', marginTop: 4 }}>
          <input
            className="form-input"
            value={url}
            onChange={(e) => onChangeUrl(e.target.value)}
            placeholder="https://..."
            style={styles.urlInput}
            autoFocus
            onBlur={() => { if (url) setShowUrlInput(false); }}
          />
        </div>
      )}
    </div>
  );
}

// --- Styles ---

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '80px' },
  actionBtn: { height: 34, fontSize: '11px', fontWeight: 700 },
  saveBtn: { height: 34, padding: '0 24px', fontSize: '11px', fontWeight: 800 },
  mainContainer: { maxWidth: '1400px', margin: 'var(--space-6) auto 0', padding: '0 var(--space-6)' },
  heroCard: { marginBottom: 32, padding: 0, border: 'none', background: 'var(--bg-sidebar)', overflow: 'hidden' as const, boxShadow: 'var(--shadow-lg)', position: 'relative' as const },
  heroGlow: { padding: '32px 40px', display: 'flex', alignItems: 'center', gap: 32 },
  heroInner: { padding: '32px 40px', display: 'flex', alignItems: 'center', gap: 32, position: 'relative' as const, zIndex: 1 },
  heroSymbolBox: { width: 100, height: 100, borderRadius: 'var(--radius-lg)', background: '#fff', border: '4px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 12, boxShadow: 'var(--shadow-md)' },
  heroSymbolImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' as const },
  heroName: { fontSize: 32, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' },
  heroLinks: { display: 'flex', gap: 12, marginTop: 16 },
  heroLinkBtn: { background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700 },
  contentGrid: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--space-6)', alignItems: 'start' },
  cardPadding: { padding: 'var(--space-6)' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' },
  labelSmall: { fontSize: '9px' },
  inputHeight: { height: 36 },
  colorInput: { width: 44, height: 36, padding: 2 },
  descriptionTextarea: { lineHeight: 1.7, padding: 16, width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' },
  symbolCard: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 12, width: '100%', padding: 20, background: 'var(--bg-card)' },
  symbolPreview: { width: 140, height: 140, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' },
  symbolImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' as const },
  noAssetPlaceholder: { color: 'var(--text-muted)', fontSize: 11, textAlign: 'center' as const, fontWeight: 700 },
  removeBtn: { color: 'var(--danger)', borderColor: 'var(--danger-soft)', height: 32 },
  urlInput: { width: '100%', fontSize: 11, height: 34, fontFamily: 'var(--font-mono)' },
};
