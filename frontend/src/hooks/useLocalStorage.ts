import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Syncs state with localStorage. Supports dynamic keys — when the key changes,
 * the stored value is re-read from localStorage.
 */
export function useLocalStorage<T>(key: string | null, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (!key) return initialValue;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const keyRef = useRef(key);
  const initialRef = useRef(initialValue);

  // Re-read when key changes
  useEffect(() => {
    if (key === keyRef.current) return;
    keyRef.current = key;
    if (!key) { setStoredValue(initialRef.current); return; }
    try {
      const raw = localStorage.getItem(key);
      setStoredValue(raw ? JSON.parse(raw) : initialRef.current);
    } catch {
      setStoredValue(initialRef.current);
    }
  }, [key]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue((prev) => {
      const next = value instanceof Function ? value(prev) : value;
      if (keyRef.current) localStorage.setItem(keyRef.current, JSON.stringify(next));
      return next;
    });
  }, []);

  return [storedValue, setValue];
}
