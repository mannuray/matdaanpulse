import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react';

/** Live height of an element (ResizeObserver). Views use it to decide how many rows fit. */
export function useElementHeight<T extends HTMLElement>(): [RefCallback<T>, number] {
  const [height, setHeight] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    if (!el) return;
    setHeight(el.clientHeight);
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    observer.current.observe(el);
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
  return [ref, height];
}
