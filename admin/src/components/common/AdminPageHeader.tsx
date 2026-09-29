import type { ReactNode } from 'react';

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string | ReactNode;
  breadcrumb?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  sticky?: boolean;
}

/**
 * COMMON: Admin Page Header (SOLID: SRP/DRY)
 * Unified sticky header for all administrative modules.
 */
export default function AdminPageHeader({
  title,
  subtitle,
  breadcrumb,
  onBack,
  backLabel = 'BACK',
  actions,
  badge,
  sticky = true
}: AdminPageHeaderProps) {
  return (
    <div style={{ ...styles.headerRoot, position: sticky ? 'sticky' : 'relative' }}>
      <div style={styles.headerContent}>
        <div style={styles.headerLeft}>
          {onBack && (
            <button onClick={onBack} className="btn btn-sm btn-outline" style={styles.backBtn}>
              &larr; {backLabel}
            </button>
          )}
          <div style={styles.titleStack}>
            {breadcrumb && <span style={styles.breadcrumb}>{breadcrumb}</span>}
            <div style={styles.titleRow}>
              <h1 style={styles.pageTitle}>{title}</h1>
              {badge}
            </div>
            {subtitle && <div style={styles.subtitle}>{subtitle}</div>}
          </div>
        </div>
        
        {actions && <div style={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
}

const styles = {
  headerRoot: { 
    background: 'var(--bg-primary)', 
    borderBottom: '1px solid var(--border)', 
    padding: 'var(--space-4) var(--space-6)', 
    top: 0, 
    zIndex: 100 
  },
  headerContent: { 
    maxWidth: '1400px', 
    margin: '0 auto', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    gap: 'var(--space-4)'
  },
  headerLeft: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: 'var(--space-4)',
    minWidth: 0
  },
  titleStack: { 
    display: 'flex', 
    flexDirection: 'column' as const,
    minWidth: 0
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)'
  },
  backBtn: { 
    height: 32, 
    fontSize: '10px', 
    fontWeight: 800,
    flexShrink: 0 
  },
  breadcrumb: { 
    fontSize: '9px', 
    fontWeight: 800, 
    color: 'var(--text-muted)', 
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em'
  },
  pageTitle: { 
    fontSize: 'var(--text-xl)', 
    fontWeight: 900, 
    margin: 0, 
    lineHeight: 1.2,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const
  },
  subtitle: { 
    fontSize: '11px', 
    fontWeight: 600, 
    color: 'var(--text-muted)', 
    textTransform: 'uppercase' as const, 
    letterSpacing: '0.05em',
    marginTop: 2
  },
  actions: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: 'var(--space-3)',
    flexShrink: 0
  }
};
