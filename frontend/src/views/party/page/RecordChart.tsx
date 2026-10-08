/** Seats won (bars) and vote share (line) per election, oldest → newest, in the party colour. */
export function RecordChart({ points, color }: { points: { year: number; won: number; share: number }[]; color: string }) {
  if (points.length < 2) return null;
  const W = 560, H = 120, pad = 18, bw = Math.min(36, (W - pad * 2) / points.length - 8);
  const maxWon = Math.max(...points.map(p => p.won), 1), maxShare = Math.max(...points.map(p => p.share), 1);
  const x = (i: number) => pad + (i + 0.5) * ((W - pad * 2) / points.length);
  const line = points.map((p, i) => `${x(i)},${H - pad - (p.share / maxShare) * (H - pad * 2)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mb-3 h-32 w-full" role="img" aria-label="seats and vote share" data-record-chart>
      {points.map((p, i) => {
        const h = (p.won / maxWon) * (H - pad * 2);
        return <g key={p.year}><rect x={x(i) - bw / 2} y={H - pad - h} width={bw} height={h} rx={2} fill={color} opacity={0.8} />
          <text x={x(i)} y={H - 4} textAnchor="middle" className="fill-muted text-[10px]">{p.year}</text></g>;
      })}
      <polyline points={line} fill="none" stroke="var(--color-ink)" strokeWidth={1.5} />
    </svg>
  );
}
