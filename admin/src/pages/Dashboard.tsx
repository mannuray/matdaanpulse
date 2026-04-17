import { useNavigate } from 'react-router-dom';
import { useDashboardManager } from '../hooks/useDashboardManager';
import type { Election } from '../types';

interface Stat {
  label: string;
  value: number;
  color: string;
  sub: string;
}

/**
 * PAGE: System Dashboard (MVC: View)
 * High-level overview of system health and active events.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { loading, stats, liveElections, upcomingElections, error } = useDashboardManager();

  if (loading) {
    return (
      <div style={styles.loadingOverlay}>
        <span className="spinner" /> Loading dashboard...
      </div>
    );
  }

  if (error) {
    return <div style={styles.errorText}>Error: {error}</div>;
  }

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <DashboardHeader />
      
      <div className="stat-grid" style={styles.statGrid}>
        {stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </div>

      <div style={styles.mainGrid}>
        <LiveControlPanel 
          liveElections={liveElections} 
          onManifestClick={() => navigate('/manifests')} 
          onOverrideClick={() => navigate('/overrides')} 
        />
        
        <ScheduledEvents 
          upcomingElections={upcomingElections} 
          onViewAll={() => navigate('/elections')} 
        />
      </div>
    </div>
  );
}

// --- Internal Sub-Components ---

function DashboardHeader() {
  return (
    <div className="page-header" style={styles.headerRoot}>
      <h1 className="page-title" style={styles.title}>System Dashboard</h1>
      <p style={styles.subtitle}>
        Real-time overview of election status and administrative data.
      </p>
    </div>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: stat.color }}>
      <div className="stat-label">{stat.label}</div>
      <div className="stat-value">{stat.value}</div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 4 }}>{stat.sub}</div>
    </div>
  );
}

interface PanelProps {
  liveElections: Election[];
  onManifestClick: () => void;
  onOverrideClick: () => void;
}

function LiveControlPanel({ liveElections, onManifestClick, onOverrideClick }: PanelProps) {
  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h3 style={styles.cardTitle}>Live Control Panel</h3>
        {liveElections.length > 0 && <span className="badge badge-live">LIVE</span>}
      </div>
      <div className="admin-card-body" style={styles.cardBodyFlush}>
        {liveElections.length > 0 ? liveElections.map((e) => (
          <div key={e.id} style={styles.eventRow}>
            <div>
              <div style={styles.eventName}>{e.name}</div>
              <div style={styles.eventSub}>{e.type} &middot; {e.year}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={styles.rowBtn} onClick={onManifestClick}>Manifest</button>
              <button className="btn btn-primary" style={styles.rowBtn} onClick={onOverrideClick}>Override</button>
            </div>
          </div>
        )) : (
          <div style={styles.emptyState}>No elections are currently live.</div>
        )}
      </div>
    </div>
  );
}

function ScheduledEvents({ upcomingElections, onViewAll }: { upcomingElections: Election[], onViewAll: () => void }) {
  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h3 style={styles.cardTitle}>Scheduled Events</h3>
        <button className="btn btn-sm btn-primary" style={styles.rowBtn} onClick={onViewAll}>View All</button>
      </div>
      <div className="admin-card-body" style={styles.cardBodyFlush}>
        {upcomingElections.length > 0 ? upcomingElections.map((e) => (
          <div key={e.id} style={styles.eventRow}>
            <div>
              <div style={styles.eventName}>{e.name}</div>
              <div style={styles.eventSub}>
                {e.type} &middot; {e.year}
                {e.tentative_next_date && (
                  <span style={styles.dateBadge}>
                    &bull; {new Date(e.tentative_next_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <span className="badge badge-upcoming" style={styles.upcomingBadge}>UPCOMING</span>
          </div>
        )) : (
          <div style={styles.emptyState}>No upcoming elections scheduled.</div>
        )}
      </div>
    </div>
  );
}

// --- Styles ---

const styles = {
  pageRoot: { paddingBottom: 'var(--space-6)' },
  loadingOverlay: { 
    display: 'flex', alignItems: 'center', justifyContent: 'center', 
    height: '100%', color: 'var(--text-secondary)' 
  },
  errorText: { padding: 'var(--space-10)', textAlign: 'center' as const, color: 'var(--danger)' },
  headerRoot: { marginBottom: 'var(--space-6)' },
  title: { fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)' },
  subtitle: { fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '2px' },
  statGrid: { marginBottom: 'var(--space-6)' },
  mainGrid: { 
    display: 'grid', gridTemplateColumns: '1fr 1fr', 
    gap: 'var(--space-6)', alignItems: 'start' 
  },
  cardTitle: { 
    fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', 
    textTransform: 'uppercase' as const, letterSpacing: '0.05em' 
  },
  cardBodyFlush: { padding: 0 },
  eventRow: { 
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
    padding: '12px 20px', borderBottom: '1px solid var(--border)' 
  },
  eventName: { fontWeight: 'var(--weight-bold)', fontSize: '14px' },
  eventSub: { 
    fontSize: '11px', color: 'var(--text-muted)', 
    fontWeight: 'var(--weight-medium)', textTransform: 'uppercase' as const, marginTop: 2 
  },
  rowBtn: { padding: '4px 12px', fontSize: '11px' },
  emptyState: { padding: '40px', textAlign: 'center' as const, color: 'var(--text-muted)', fontSize: '13px' },
  dateBadge: { marginLeft: 8, color: 'var(--warning-text)' },
  upcomingBadge: { fontSize: '9px' },
};
