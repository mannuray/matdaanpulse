import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; message: string; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="empty-state">
          <h3>Something went wrong</h3>
          <p>{this.state.message}</p>
          <button
            onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload(); }}
            style={{ marginTop: 12, padding: '8px 20px', background: 'var(--accent)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 14 }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
