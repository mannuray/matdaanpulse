import type { PersonPageVM } from '../../viewmodels/pages/usePersonPageVM';

const W = 320, H = 120, PAD = 18;

/** Grouped bars per affidavit year: assets and liabilities. */
export function AffidavitChart({ points, label }: { points: PersonPageVM['affidavit']; label: string }) {
  const max = Math.max(1, ...points.flatMap(p => [p.assets ?? 0, p.liabilities ?? 0]));
  const slot = (W - PAD * 2) / Math.max(points.length, 1);
  const bw = Math.min(14, slot / 3);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {points.map((p, i) => {
        const x = PAD + i * slot + slot / 2;
        return (
          <g key={`${p.year}-${i}`}>
            {p.assets != null && <rect x={x - bw - 1} y={y(p.assets)} width={bw} height={H - PAD - y(p.assets)} className="fill-accent" />}
            {p.liabilities != null && <rect x={x + 1} y={y(p.liabilities)} width={bw} height={H - PAD - y(p.liabilities)} className="fill-live" />}
            <text x={x} y={H - 4} textAnchor="middle" className="fill-muted text-[9px]">{p.year}</text>
          </g>
        );
      })}
    </svg>
  );
}
