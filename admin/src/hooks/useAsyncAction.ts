import { useState, useCallback } from 'react';
import { useToast } from '../context/ToastContext';

interface ActionOptions {
  onSuccess?: () => void;
  successMsg?: string;
  errorMsg?: string;
}

/**
 * HOOK: useAsyncAction (SOLID: SRP)
 * Standardizes async operation handling with automatic loading states and toast notifications.
 */
export function useAsyncAction() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(async (
    promise: Promise<any>,
    options?: ActionOptions
  ) => {
    setLoading(true);
    setError(null);
    try {
      const result = await promise;
      if (options?.successMsg) {
        toast(options.successMsg);
      }
      options?.onSuccess?.();
      return { success: true, data: result };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      toast(options?.errorMsg || e.message, 'error');
      return { success: false, error: e };
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { run, loading, error };
}
