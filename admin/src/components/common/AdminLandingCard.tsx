import React from 'react';
import ElectionPicker from '../ElectionPicker';

interface AdminLandingCardProps {
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  selectedId: string;
  onSelectionChange: (id: string) => void;
  statusText?: string;
}

/**
 * COMMON: Premium Landing Card (SOLID: SRP)
 * Standardized "Select Election" entry point for all Admin modules.
 */
export default function AdminLandingCard({
  title,
  subtitle,
  description,
  icon,
  selectedId,
  onSelectionChange,
  statusText = 'Ready for configuration'
}: AdminLandingCardProps) {
  return (
    <div style={styles.container}>
      <div style={styles.glow} />
      <div className="fade-in" style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.pageTitle}>{title}</h1>
          <p style={styles.pageSubtitle}>{subtitle}</p>
        </div>
        
        <div className="card-elevated" style={styles.card}>
          <div style={styles.iconWrapper}>
            <div style={styles.iconInner}>{icon}</div>
          </div>
          
          <h2 style={styles.cardTitle}>Election Selection</h2>
          <p style={styles.cardDesc}>{description}</p>
          
          <div style={styles.pickerWrapper}>
            <div style={styles.pickerLabel}>TARGET ELECTION</div>
            <div className="vertical-picker">
              <ElectionPicker value={selectedId} onChange={onSelectionChange} />
            </div>
          </div>

          <div style={styles.statusRow}>
            <span style={styles.statusDot} />
            {statusText}
          </div>
        </div>
      </div>
      
      <style>{`
        .vertical-picker > div {
          flex-direction: column !important;
          align-items: stretch !important;
          width: 100%;
        }
        .vertical-picker select {
          width: 100% !important;
          min-width: 100% !important;
        }
        .vertical-picker .map-tabs {
          width: 100%;
          justify-content: center;
        }
        .vertical-picker .map-tab {
          flex: 1;
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: { 
    minHeight: 'calc(100vh - 100px)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
    background: 'radial-gradient(circle at 50% 50%, #f8fafc 0%, #e2e8f0 100%)', 
    position: 'relative' as const, overflow: 'hidden', padding: '40px 20px'
  },
  glow: { 
    position: 'absolute' as const, width: '800px', height: '800px', 
    background: 'var(--accent)', opacity: 0.03, filter: 'blur(120px)', borderRadius: '50%' 
  },
  content: { 
    width: '100%', maxWidth: '520px', position: 'relative' as const, zIndex: 1, 
    textAlign: 'center' as const 
  },
  header: { marginBottom: 'var(--space-8)' },
  pageTitle: { fontSize: '32px', fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 6px', color: 'var(--text-primary)' },
  pageSubtitle: { fontSize: '12px', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' as const, letterSpacing: '0.15em' },
  card: { 
    padding: '56px 48px', background: '#fff', border: '1px solid var(--border)', 
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    borderRadius: '32px', position: 'relative' as const, overflow: 'hidden'
  },
  iconWrapper: { 
    width: '72px', height: '72px', background: 'var(--bg-secondary)', 
    borderRadius: '24px', margin: '0 auto 32px', display: 'flex', 
    alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
  },
  iconInner: { fontSize: '32px' },
  cardTitle: { fontSize: '20px', fontWeight: 800, margin: '0 0 12px', color: 'var(--text-primary)' },
  cardDesc: { fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 40, maxWidth: '360px', margin: '0 auto 40px' },
  pickerWrapper: { 
    background: 'var(--bg-secondary)', padding: '24px', borderRadius: '20px', 
    border: '1px solid var(--border)', textAlign: 'left' as const 
  },
  pickerLabel: { fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.1em' },
  statusRow: { marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  statusDot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 12px var(--success)' },
};
