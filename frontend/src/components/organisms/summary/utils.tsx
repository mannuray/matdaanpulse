import { useState } from 'react';

export const LS_BUCKETS = [
  { label: '< 5K', max: 5000 },
  { label: '5–25K', max: 25000 },
  { label: '25–75K', max: 75000 },
  { label: '75–200K', max: 200000 },
  { label: '200K+', max: Infinity },
];

export const VS_BUCKETS = [
  { label: '< 1K', max: 1000 },
  { label: '1–5K', max: 5000 },
  { label: '5–15K', max: 15000 },
  { label: '15–50K', max: 50000 },
  { label: '50K+', max: Infinity },
];

export function formatMargin(m: number): string {
  if (m >= 100000) return `${(m / 100000).toFixed(1)}L`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)}K`;
  return String(m);
}

export function Section({ label, count, defaultOpen = false, children }: { label: string; count?: number; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 'var(--space-2)' }}>
      <button className="es-section-toggle" onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: '10px', opacity: 0.6, width: '12px', display: 'inline-block' }}>{open ? '▼' : '▶'}</span>
        <span>{label}</span>
        {count != null && <span style={{ marginLeft: 'var(--space-1)', opacity: 0.5, fontSize: '10px' }}>{count}</span>}
      </button>
      {open && <div className="fade-in">{children}</div>}
    </div>
  );
}
