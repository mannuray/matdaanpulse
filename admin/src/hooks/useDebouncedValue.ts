import { useEffect, useState } from 'react';

/** `value`, once it has stopped changing for `ms`. The first value is returned at once. */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (Object.is(value, debounced)) return undefined;
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
    // `debounced` is read only to skip a no-op timer; re-running on it would restart the wait.
  }, [value, ms]); // eslint-disable-line react-hooks/exhaustive-deps
  return debounced;
}
