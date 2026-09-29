import type { ManifestData } from '../types';
/**
 * PURE UTILITIES (SOLID: SRP)
 * Stateless functions for manifest data manipulation.
 */

export function updateAt<T>(arr: T[], idx: number, patch: Partial<T>): T[] {
  return arr.map((item, i) => (i === idx ? { ...item, ...patch } : item));
}

export function removeAt<T>(arr: T[], idx: number): T[] {
  return arr.filter((_, i) => i !== idx);
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/**
 * Resolves the published manifest body. `manifest_url` holds either inline JSON
 * or a URL to fetch. Returns null when nothing is published or it can't be read.
 */
export async function resolvePublishedManifest(
  manifestUrl: string | null | undefined,
): Promise<ManifestData | null> {
  if (!manifestUrl) return null;
  try {
    if (manifestUrl.trimStart().startsWith('{')) return JSON.parse(manifestUrl);
    const response = await fetch(manifestUrl);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
