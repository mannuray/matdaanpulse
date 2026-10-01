/** Loading indicator: a spinning ring, with `label` underneath (also its accessible name; "Loading" without one). */
export default function Spinner({ size = 32, label }: { size?: number; label?: string }) {
  const ring = Math.max(2, Math.round(size / 10));
  return (
    <div role="status" aria-label={label ? undefined : 'Loading'} className="flex flex-col items-center justify-center gap-3">
      <span
        aria-hidden
        className="animate-spin rounded-full border-solid border-line-strong border-t-accent"
        style={{ width: size, height: size, borderWidth: ring }}
      />
      {label && <span className="text-sm font-medium text-ink-2">{label}</span>}
    </div>
  );
}
