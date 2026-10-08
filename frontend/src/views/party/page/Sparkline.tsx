/** Seats won across a state's elections (oldest → newest), in the party colour. */
export function Sparkline({ values, color, width = 80, height = 24 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return <span className="inline-block" style={{ width, height }} aria-hidden />;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 2 - (v / max) * (height - 4)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden data-sparkline>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
