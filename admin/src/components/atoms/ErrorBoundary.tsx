import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

/**
 * ATOM: Error Boundary (SOLID: SRP)
 * Isolates UI failures to prevent monolithic app crashes.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>⚠️</div>
            <h3 style={styles.title}>Interface Error</h3>
            <p style={styles.message}>{this.state.error?.message || 'A data mismatch occurred.'}</p>
            <div style={styles.actions}>
              <button
                onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
                style={styles.reloadBtn}
              >
                RELOAD INTERFACE
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles = {
  container: { padding: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', background: 'var(--bg-secondary)' },
  card: { padding: '32px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', textAlign: 'center' as const, maxWidth: '400px', border: '1px solid var(--border)' },
  icon: { fontSize: '32px', marginBottom: '16px' },
  title: { fontSize: '18px', fontWeight: 800, margin: '0 0 8px' },
  message: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' },
  actions: { display: 'flex', justifyContent: 'center' },
  reloadBtn: { padding: '8px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }
};
