import { useState } from 'react';
import { cn } from './cn';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** `size` in px, or 'fill' to take the container's size (set it with className). */
export function Avatar({ name, photo, size = 40, className }: { name: string; photo: string | null; size?: number | 'fill'; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const style = size === 'fill' ? undefined : { width: size, height: size };
  if (photo && failed !== photo) {
    return <img src={photo} alt={name} style={style} loading="lazy" onError={() => setFailed(photo)} className={cn('shrink-0 rounded-full object-cover', className)} />;
  }
  return <span aria-hidden style={style} className={cn('grid shrink-0 place-items-center rounded-full border border-line bg-tile-raised text-xs font-bold text-muted', className)}>{initials(name)}</span>;
}
