import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';

interface Props {
  children: ReactNode;
  /** What Reload does; defaults to reloading the page (a seam for tests — jsdom cannot reload). */
  onReload?: () => void;
  /** Top-level boundary: fill the viewport so the card is centred (the root has no height). */
  fullScreen?: boolean;
}
interface State { hasError: boolean; error: Error | null }

/** Isolates a UI failure to the subtree it wraps, with a Reload button. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  private reload = () => {
    if (this.props.onReload) this.props.onReload();
    else window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className={`flex ${this.props.fullScreen ? 'min-h-screen' : 'h-full'} items-center justify-center bg-page p-10 font-sans`}>
        <div role="alert" className="max-w-sm rounded-panel border border-line bg-card p-8 text-center shadow-sm">
          <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-bad-soft text-bad-text">
            <AlertTriangle size={18} aria-hidden />
          </span>
          <h2 className="text-base font-semibold text-ink">Something went wrong</h2>
          <p className="mt-2 text-sm text-ink-2">{this.state.error?.message || 'This part of the page stopped working.'}</p>
          <Button variant="primary" className="mt-6" onClick={this.reload}>Reload</Button>
        </div>
      </div>
    );
  }
}
