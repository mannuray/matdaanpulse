import type { ReactNode } from 'react';
import type { Election, ManifestData, Party } from '../../../types';

interface ManifestSummaryProps {
  manifest: ManifestData;
  partyMap: Map<string, Party>;
  electionMap: Map<string, Election>;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-card p-4">
      <h3 className="mb-3 text-xs font-medium text-muted">{title}</h3>
      {children}
    </section>
  );
}

const None = ({ text }: { text: string }) => <p className="text-xs text-muted">{text}</p>;
const dot = (color?: string | null) => <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color || 'var(--color-line-strong)' }} aria-hidden />;

/** Read-only overview of a manifest (the old ManifestDetail), every section open — the panel's default tab. */
export function ManifestSummary({ manifest, partyMap, electionMap }: ManifestSummaryProps) {
  const stats: [string, number][] = [
    ['Alliances', manifest.alliances?.length ?? 0],
    ['Watchlists', manifest.watchlists?.length ?? 0],
    ['Tracked', manifest.tracked?.length ?? 0],
    ['Milestones', manifest.milestones?.length ?? 0],
  ];
  const geo = manifest.geo ?? {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {stats.map(([label, n]) => (
          <div key={label} className="rounded-card border border-line bg-card px-4 py-3">
            <div className="text-xs text-muted">{label}</div>
            <div className="text-2xl font-semibold tabular-nums text-ink">{n}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 items-start gap-4">
        <div className="space-y-4">
          <Card title="Alliances">
            {(manifest.alliances ?? []).length === 0 && <None text="No alliances configured." />}
            <ul className="space-y-2">
              {(manifest.alliances ?? []).map((a) => (
                <li key={a.id} className="rounded-control border-l-4 bg-subtle px-3 py-2" style={{ borderLeftColor: a.color }}>
                  <div className="text-sm font-medium text-ink">{a.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {a.parties.map((pid) => (
                      <span key={pid} className="inline-flex items-center gap-1 rounded-control border border-line bg-card px-1.5 py-0.5 text-[11px] text-ink-2">
                        {dot(partyMap.get(pid)?.color)}{pid}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Vote splits">
            {(manifest.vote_splits ?? []).length === 0 && <None text="No vote splits configured." />}
            <ul className="space-y-1.5">
              {(manifest.vote_splits ?? []).map((v, i) => (
                <li key={i} className="flex items-center gap-2 rounded-control bg-subtle px-3 py-1.5 text-sm">
                  <span className="font-medium text-bad-text">{v.spoiler}</span>
                  <span className="text-xs text-muted">hurts</span>
                  <span className="font-medium text-ink">{v.hurts}</span>
                  <span className="ml-auto rounded-control bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">{v.label}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Comparison history">
            {(manifest.history ?? []).length === 0 && <None text="No earlier elections configured for comparison." />}
            <ul className="space-y-1.5">
              {(manifest.history ?? []).map((hid, i) => {
                const el = electionMap.get(hid);
                return (
                  <li key={hid} className="flex items-center justify-between gap-3 rounded-control bg-subtle px-3 py-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-10 font-mono text-xs text-muted">{manifest.history_years?.[i] ?? el?.year ?? '–'}</span>
                      <span className="text-sm text-ink">{el?.name ?? hid}</span>
                    </div>
                    {i === 0 && <span className="text-[11px] text-accent">Baseline</span>}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Watchlists">
            {(manifest.watchlists ?? []).length === 0 && <None text="No watchlists defined." />}
            <div className="space-y-3">
              {(manifest.watchlists ?? []).map((w) => (
                <div key={w.id}>
                  <div className="mb-1 text-xs font-medium text-accent">{w.name}</div>
                  <ul className="space-y-1">
                    {w.entries.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5">{dot(partyMap.get(e.party_id)?.color)}</span>
                        <div>
                          <div className="font-medium text-ink">{e.name}</div>
                          <div className="text-[11px] text-muted">{e.role ? `${e.role} · ` : ''}{e.party_id} · {e.const_id}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Map">
            {geo.map_url && (
              <img
                src={geo.map_url.replace('.json', '.svg')}
                alt="Map preview"
                className="mb-3 h-40 w-full rounded-control bg-sidebar object-contain p-3"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-xs text-muted">Data source</dt><dd className="truncate text-ink">{geo.map_url || 'Default'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-xs text-muted">Centre</dt><dd className="text-ink">{geo.center ? `${geo.center[0]}, ${geo.center[1]}` : 'Auto'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-xs text-muted">Zoom</dt><dd className="text-ink">{geo.zoom ?? 'Auto'}</dd></div>
            </dl>
          </Card>

          <Card title="Milestones">
            {(manifest.milestones ?? []).length === 0 && <None text="No milestones." />}
            <ul className="space-y-1">
              {(manifest.milestones ?? []).map((ms, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="text-ink">{ms.label}</span>
                  <span className="font-semibold tabular-nums text-accent">{ms.value}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
