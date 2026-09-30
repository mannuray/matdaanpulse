import { describeError } from '../utils/api-error';
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  toast: (message: string, type?: Toast['type']) => void;
  /** Error toast built from a caught error; lists backend field errors. */
  toastError: (err: unknown, fallback: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, message.includes('\n') ? 8000 : 4000);
  }, []);

  const toastError = useCallback((err: unknown, fallback: string) => toast(describeError(err, fallback), 'error'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, toastError }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} style={{ whiteSpace: 'pre-line' }}>
            <span>{t.type === 'success' ? '\u2713' : t.type === 'error' ? '\u2717' : '\u24D8'}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
