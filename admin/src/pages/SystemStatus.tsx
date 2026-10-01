import { useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSystemStatus } from '../hooks/useSystemStatus';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { cn } from '../components/ui/cn';
import { clockIst } from '../utils/time';
import type { SystemStatus as Status } from '../services/status.service';

function formatUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}
const pct = (r: number | null) => (r === null ? 'n/a' : `${Math.round(r * 100)}%`);
const num = (n: number) => n.toLocaleString('en-IN');

/** PAGE: System status — in-memory counters since the last backend restart. Polls every 10 s (useSystemStatus). */
export default function SystemStatus() {
  const { status, error, refresh } = useSystemStatus();
  // Only a click shows "Refreshing…": the 10 s background polls must not make the button flicker.
  const [manual, setManual] = useState(false);
  const onRefresh = async () => {
    setManual(true);
    try { await refresh(); } finally { setManual(false); }
  };
  return <SystemStatusView status={status} error={error} loading={manual} onRefresh={() => { void onRefresh(); }} />;
}

export function SystemStatusView({ status, error, loading, onRefresh }: {
  status: Status | null; error: string | null; loading: boolean; onRefresh: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto bg-page font-sans text-ink">
      <div className="space-y-4 p-6">
        <PageHeader
          title="System status"
          subtitle="Counters are kept in memory and reset when the backend restarts"
          actions={
            <Button variant="primary" disabled={loading} onClick={onRefresh}>
              <RefreshCw size={14} aria-hidden className={cn(loading && 'animate-spin')} />
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          }
        />
        {error && (status ? (
          <div role="alert" className="rounded-card border border-warn/40 bg-warn-soft px-4 py-2.5 text-sm text-warn-text">
            Could not refresh: {error}. Showing data from {clockIst(status.generatedAt)} (IST).
          </div>
        ) : (
          <div role="alert" className="rounded-card border border-bad/30 bg-bad-soft px-4 py-2.5 text-sm text-bad-text">
            Could not load status: {error}
          </div>
        ))}
        {!status && !error && <p className="text-sm text-muted">Loading…</p>}
        {status && <Cards s={status} />}
        <p className="text-xs text-muted">
          Since restart{status ? ` (${new Date(status.process.startedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })})` : ''}. Auto-refreshes every 10 s while this tab is visible.
        </p>
      </div>
    </div>
  );
}

function Cards({ s }: { s: Status }) {
  const { http, cache, redis, live, db, process: p } = s;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
      <Card title="Uptime and version">
        <Row k="Uptime" v={formatUptime(p.uptimeSeconds)} />
        <Row k="Version" v={`${p.appVersion}${p.gitSha ? ` (${p.gitSha})` : ''}`} />
        <Row k="Node" v={p.nodeVersion} />
        <Row k="Memory" v={`${p.memory.rssMb} MB rss / ${p.memory.heapUsedMb} MB heap`} />
      </Card>
      <Card title="Traffic">
        <Row k="Total requests" v={num(http.total)} />
        <Row k="Last 5 min" v={`${http.last5m.requestsPerMin}/min, 5xx ${http.last5m.errors5xxPerMin}/min`} />
        <Row k="Last 60 min" v={`${http.last60m.requestsPerMin}/min, 5xx ${http.last60m.errors5xxPerMin}/min`} />
        <Row k="2xx / 3xx" v={`${num(http.byClass['2xx'])} / ${num(http.byClass['3xx'])}`} />
        <Row k="4xx" v={num(http.byClass['4xx'])} />
        <Row k="5xx" v={num(http.byClass['5xx'])} bad={http.byClass['5xx'] > 0} />
        <Row k="429 throttled" v={num(http.throttled429)} />
        <Row k="Origin shield 403" v={num(http.shieldRejected403 ?? 0)} />
      </Card>
      <Card title="Cache">
        <Row k="Hit rate" v={pct(cache.hitRate)} />
        <Row k="Hits / misses" v={`${num(cache.hits)} / ${num(cache.misses)}`} />
        <Row k="Redis fallbacks" v={num(cache.fallbacks)} bad={cache.fallbacks > 0} />
      </Card>
      <Card title="Redis">
        <Row k="Publisher" v={redis.pubReady ? 'ready' : 'down'} bad={!redis.pubReady} />
        <Row k="Subscriber" v={redis.subReady ? 'ready' : 'down'} bad={!redis.subReady} />
        <Row k="Publishes" v={num(redis.publishes)} />
        <Row k="Publish errors" v={num(redis.publishErrors)} bad={redis.publishErrors > 0} />
      </Card>
      <Card title="Live">
        <Row k="SSE connections" v={num(live.sseConnections)} />
        <Row k="Events published" v={num(live.eventsPublished)} />
        <Row k="Overrides applied" v={num(live.overridesApplied)} />
        <Row k="Overrides / min (5 min)" v={String(live.overridesPerMin)} />
        <Row k="Last override" v={live.lastOverrideAt ? new Date(live.lastOverrideAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'none yet'} />
      </Card>
      <Card title="Database">
        <Row k="SELECT 1" v={db.ok ? `${db.latencyMs} ms` : 'failed'} bad={!db.ok} />
        <Row k="Pool connection limit" v={db.pool.connectionLimit === null ? 'default' : String(db.pool.connectionLimit)} />
      </Card>
      <Card title="Slowest routes" note="p95 of the last ≤200 requests within 60 min" className="col-span-full">
        <table aria-label="Slowest routes" className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-2">
              <th scope="col" className="py-2 pr-3 font-medium">Route</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">p95</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">Samples</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-t border-line">
            {http.slowestRoutes.map((r) => (
              <tr key={r.route}>
                <td className="py-2 pr-3 font-mono text-xs text-ink">{r.route}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink">{r.p95Ms} ms</td>
                <td className="py-2 pl-3 text-right tabular-nums text-ink-2">{r.samples}</td>
              </tr>
            ))}
            {http.slowestRoutes.length === 0 && (
              <tr><td colSpan={3} className="py-4 text-center text-xs text-muted">No traffic recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Card({ title, note, className, children }: { title: string; note?: string; className?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={cn('rounded-card border border-line bg-card p-4 shadow-sm', className)}>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      <div className="mt-3 space-y-1">{children}</div>
    </section>
  );
}

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 text-sm">
      <span className="text-ink-2">{k}</span>
      <span className={cn('font-semibold tabular-nums', bad ? 'text-bad-text' : 'text-ink')}>{v}</span>
    </div>
  );
}
