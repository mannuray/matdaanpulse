import { useEffect, useState } from 'react';
import type { ToastMessage } from '../../types';

interface LiveToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

function formatMargin(m: number): string {
  if (m >= 100000) return `${(m / 100000).toFixed(1)}L`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)}K`;
  return String(m);
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), 4500);
    const removeTimer = setTimeout(onDismiss, 5000);
    return () => {
      clearTimeout(timer);
      clearTimeout(removeTimer);
    };
  }, [onDismiss]);

  return (
    <div className={`live-toast-item ${exiting ? 'live-toast-exit' : ''}`}>
      <span className="live-toast-dot" style={{ background: toast.color }} />
      <span className="live-toast-text">
        <strong>{toast.party}</strong> wins {toast.constName.replace(/_/g, ' ')} +{formatMargin(toast.margin)}
      </span>
    </div>
  );
}

export default function LiveToast({ toasts, onDismiss }: LiveToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="live-toast-container">
      {toasts.slice(-5).map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}
