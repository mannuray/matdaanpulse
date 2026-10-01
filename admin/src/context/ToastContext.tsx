import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react';
import { describeError } from '../utils/api-error';
import { cn } from '../components/ui/cn';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  /** Error toast built from a caught error; lists backend field errors. */
  toastError: (err: unknown, fallback: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/** How long a toast stays: multi-line messages (field-error lists) get longer to be read. */
export const toastDuration = (message: string) => (message.includes('\n') ? 8000 : 4000);

const LOOK: Record<ToastType, { box: string; Icon: LucideIcon }> = {
  success: { box: 'border-ok/30 bg-ok-soft text-ok-text', Icon: CheckCircle2 },
  error: { box: 'border-bad/30 bg-bad-soft text-bad-text', Icon: XCircle },
  info: { box: 'border-accent/30 bg-accent-soft text-accent', Icon: Info },
};

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    timers.current.set(id, setTimeout(() => dismiss(id), toastDuration(message)));
  }, [dismiss]);

  const toastError = useCallback((err: unknown, fallback: string) => toast(describeError(err, fallback), 'error'), [toast]);

  useEffect(() => {
    const pending = timers.current;
    return () => { pending.forEach(clearTimeout); pending.clear(); };
  }, []);

  const value = useMemo(() => ({ toast, toastError }), [toast, toastError]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2 font-sans">
          {toasts.map((t) => {
            const { box, Icon } = LOOK[t.type];
            const isError = t.type === 'error';
            return (
              <div
                key={t.id}
                role={isError ? 'alert' : 'status'}
                aria-live={isError ? 'assertive' : 'polite'}
                className={cn('pointer-events-auto flex items-start gap-2.5 rounded-card border px-3.5 py-3 text-sm shadow-md', box)}
              >
                <Icon size={16} aria-hidden className="mt-0.5 shrink-0" />
                <p className="min-w-0 flex-1 whitespace-pre-line break-words">{t.message}</p>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 rounded-control p-0.5 opacity-70 hover:opacity-100"
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
