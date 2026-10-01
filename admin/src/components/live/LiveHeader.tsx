export function LiveHeader({ electionName, reportingPct }: { electionName: string; reportingPct: number }) {
  return (
    <div className="flex items-end justify-between gap-6 px-6 pt-5 pb-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Live console</h1>
        <p className="mt-0.5 text-sm text-ink-2">{electionName} · auto-refreshing</p>
      </div>
      <div className="flex items-center gap-3 text-xs text-ink-2">
        <span>Counting progress · <span className="font-medium text-ink">{reportingPct}% of seats reporting</span></span>
        <div className="h-1.5 w-36 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={reportingPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${reportingPct}%` }} />
        </div>
      </div>
    </div>
  );
}
