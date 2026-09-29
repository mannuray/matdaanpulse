import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_TOASTS } from '../../utils/liveUpdates';
import type { ToastMessage } from '../../types';

interface LiveToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const TOAST_VISIBLE_MS = 5000;
const TOAST_EXIT_MS = 500;

function formatMargin(m: number): string {
  if (m >= 100000) return `${(m / 100000).toFixed(1)}L`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)}K`;
  return String(m);
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const { t } = useTranslation();
  const [exiting, setExiting] = useState(false);
  // Keep timers stable across parent re-renders (onDismiss identity may change).
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), TOAST_VISIBLE_MS - TOAST_EXIT_MS);
    const removeTimer = setTimeout(() => onDismissRef.current(toast.id), TOAST_VISIBLE_MS);
    return () => {
      clearTimeout(timer);
      clearTimeout(removeTimer);
    };
  }, [toast.id]);

  const key = toast.kind === 'lead' ? 'toast_leads' : 'toast_wins';
  return (
    <div className={`live-toast-item ${exiting ? 'live-toast-exit' : ''}`} role="status">
      <span className="live-toast-dot" style={{ background: toast.color }} />
      <span className="live-toast-text">
        <strong>{toast.party}</strong>{' '}
        {t(key, { constituency: toast.constName })}
        {toast.margin > 0 && ` +${formatMargin(toast.margin)}`}
      </span>
    </div>
  );
}

export default function LiveToast({ toasts, onDismiss }: LiveToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="live-toast-container" aria-live="polite">
      {toasts.slice(-MAX_TOASTS).map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
