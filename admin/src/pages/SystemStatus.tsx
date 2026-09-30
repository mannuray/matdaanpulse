import type { ReactNode } from 'react';
import AdminPageHeader from '../components/common/AdminPageHeader';
import { useSystemStatus } from '../hooks/useSystemStatus';
import type { SystemStatus as Status } from '../services/status.service';

function formatUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}
const pct = (r: number | null) => (r === null ? 'n/a' : `${Math.round(r * 100)}%`);
const num = (n: number) => n.toLocaleString('en-IN');

/** PAGE: System status — in-memory counters since the last backend restart. */
export default function SystemStatus() {
  const { status, error, loading, refresh } = useSystemStatus();
  return <SystemStatusView status={status} error={error} loading={loading} onRefresh={refresh} />;
}

export function SystemStatusView({ status, error, loading, onRefresh }: {
  status: Status | null; error: string | null; loading: boolean; onRefresh: () => void;
}) {
  return (
    <div className="fade-in" style={styles.page}>
      <AdminPageHeader
        title="System status"
        subtitle="Counters are kept in memory and reset when the backend restarts"
        actions={<button onClick={onRefresh} disabled={loading} className="btn btn-primary" style={styles.btn}>{loading ? 'REFRESHING' : 'REFRESH'}</button>}
      />
      <div style={{ padding: 'var(--space-6)' }}>
        {error && <div role="alert" style={styles.error}>Could not load status: {error}</div>}
        {!status && !error && <div style={styles.muted}>Loading...</div>}
        {status && <Cards s={status} />}
        <p style={{ ...styles.muted, marginTop: 16 }}>
          Since restart{status ? ` (${new Date(status.process.startedAt).toLocaleString('en-IN')})` : ''}. Auto-refreshes every 10 s while this tab is visible.
        </p>
      </div>
    </div>
  );
}

function Cards({ s }: { s: Status }) {
  const { http, cache, redis, live, db, process: p } = s;
  return (
    <div style={styles.grid}>
      <Card title="Uptime & version">
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
        <Row k="Last override" v={live.lastOverrideAt ? new Date(live.lastOverrideAt).toLocaleString('en-IN') : 'none yet'} />
      </Card>
      <Card title="Database">
        <Row k="SELECT 1" v={db.ok ? `${db.latencyMs} ms` : 'failed'} bad={!db.ok} />
        <Row k="Pool connection limit" v={db.pool.connectionLimit === null ? 'default' : String(db.pool.connectionLimit)} />
      </Card>
      <div style={{ gridColumn: '1 / -1' }}>
        <Card title="Slowest routes (p95 of the last ≤200 requests within 60 min)">
          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={styles.th}>Route</th><th style={styles.thR}>p95</th><th style={styles.thR}>Samples</th></tr></thead>
            <tbody>
              {http.slowestRoutes.map((r) => (
                <tr key={r.route} style={styles.tr}>
                  <td style={styles.mono}>{r.route}</td>
                  <td style={styles.tdR}>{r.p95Ms} ms</td>
                  <td style={styles.tdR}>{r.samples}</td>
                </tr>
              ))}
              {http.slowestRoutes.length === 0 && <tr><td colSpan={3} style={styles.muted}>No traffic recorded yet.</td></tr>}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card-elevated" style={{ padding: 16 }} aria-label={title}>
      <h3 style={styles.cardTitle}>{title}</h3>
      {children}
    </section>
  );
}

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div style={styles.row}>
      <span style={styles.muted}>{k}</span>
      <span style={{ fontWeight: 700, color: bad ? 'var(--danger-text)' : 'var(--text-primary)' }}>{v}</span>
    </div>
  );
}

const styles = {
  page: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: 40 },
  btn: { padding: '6px 16px', fontSize: 11, fontWeight: 700, borderRadius: 'var(--radius-sm)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 },
  cardTitle: { margin: '0 0 10px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: 'var(--text-muted)' },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontSize: 13 },
  muted: { color: 'var(--text-muted)', fontSize: 12 },
  error: { background: 'var(--danger-soft)', color: 'var(--danger-text)', padding: 12, borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13 },
  th: { padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' as const, color: 'var(--text-muted)' },
  thR: { padding: '8px 12px', textAlign: 'right' as const, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' as const, color: 'var(--text-muted)' },
  tr: { borderTop: '1px solid var(--border)' },
  mono: { padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12 },
  tdR: { padding: '8px 12px', textAlign: 'right' as const, fontSize: 12 },
};
