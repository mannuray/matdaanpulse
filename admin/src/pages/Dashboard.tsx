import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { useDashboard, type CardState } from '../hooks/useDashboard';
import { shortElectionName } from '../components/shell/ElectionPicker';
import { NoElection } from '../components/entity/NoElection';
import { FeedbackKindBadge } from '../components/feedback/FeedbackKindBadge';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../components/ui/cn';
import { ELECTION_PHASE, groupElections, lastUpdateSubtitle, leadingSubtitle } from '../utils/dashboard';
import { auditActor, describeAudit } from '../utils/audit';
import { firstLine } from '../utils/feedback';
import { clockIst, formatIstDate, timeAgo } from '../utils/time';
import type { Election } from '../types';

type DashboardData = ReturnType<typeof useDashboard>;

const fmt = (n: number) => n.toLocaleString('en-IN');
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
const VIEW_LINK = 'inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover';

/** PAGE: Dashboard — counting overview for editors, elections overview for viewers. Refreshes every 30 s. */
export default function Dashboard() {
  const d = useDashboard();
  const subtitle = d.canEdit && d.election
    ? `${shortElectionName(d.election.name, d.election.type, d.election.year)} · ${ELECTION_PHASE[d.election.status]}`
    : 'Elections at a glance';
  return (
    <div className="h-full overflow-y-auto bg-page font-sans text-ink">
      <div className="space-y-4 p-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>
        </header>
        {d.canEdit ? <CountingView d={d} /> : <ElectionsOverview d={d} />}
      </div>
    </div>
  );
}

function CountingView({ d }: { d: DashboardData }) {
  if (!d.electionId) {
    if (d.electionsLoading) return <p className="py-10 text-center text-sm text-muted">Loading elections…</p>;
    return <div className="rounded-card border border-line bg-card shadow-sm"><NoElection error={d.electionsError} /></div>;
  }
  return (
    <>
      <KpiRow d={d} />
      <LiveConsoleCard d={d} />
      <div className={cn('grid items-stretch gap-4', d.isSuper ? 'grid-cols-3' : 'grid-cols-2')}>
        {d.isSuper && <ActivityCard d={d} />}
        <HealthCard d={d} />
        <FeedbackCard d={d} />
      </div>
    </>
  );
}

// --- KPIs ---

function Kpi({ label, value, suffix, sub, valueClass, children }: {
  label: string; value: string; suffix?: string; sub?: string; valueClass?: string; children?: ReactNode;
}) {
  return (
    <section aria-label={label} className="rounded-card border border-line bg-card p-4 shadow-sm">
      <h2 className="text-xs font-medium text-ink-2">{label}</h2>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
        <span className={valueClass}>{value}</span>
        {suffix && <span className="text-sm font-normal text-muted">{suffix}</span>}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      {children}
    </section>
  );
}

function KpiRow({ d }: { d: DashboardData }) {
  const s = d.summary;
  if (!s) {
    if (d.live.error) {
      return (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad-text">
          {d.live.error}
          <Button size="sm" variant="outline" onClick={() => { void d.live.reload(); }}>Try again</Button>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-4 gap-4">
        {['Seats declared', 'Leading', 'Pending', 'Last update'].map((label) => <Kpi key={label} label={label} value="—" sub="Loading…" />)}
      </div>
    );
  }
  const declaredPct = s.total ? Math.round((s.declared / s.total) * 100) : 0;
  return (
    <div className="grid grid-cols-4 gap-4">
      <Kpi label="Seats declared" value={fmt(s.declared)} suffix={` / ${fmt(s.total)}`}>
        <div role="progressbar" aria-label="Seats declared" aria-valuenow={declaredPct} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle">
          <div className="h-full rounded-full bg-ok" style={{ width: `${declaredPct}%` }} />
        </div>
      </Kpi>
      <Kpi label="Leading" value={fmt(s.leading)} valueClass="text-accent" sub={leadingSubtitle(s)} />
      <Kpi label="Pending" value={fmt(s.pending)} sub="no votes yet" />
      <Kpi label="Last update" value={s.lastUpdate ? clockIst(s.lastUpdate) : '—'} sub={lastUpdateSubtitle(s, d.now)} />
    </div>
  );
}

// --- Live console ---

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[9px] font-semibold text-accent">
      {initials(name)}
    </span>
  );
}

function LiveConsoleCard({ d }: { d: DashboardData }) {
  const pct = d.summary?.reportingPct ?? 0;
  const { locks } = d;
  let editing: ReactNode;
  if (locks.data && !locks.data.available) editing = <span>Seat locking unavailable</span>;
  else if (locks.data) {
    editing = (
      <>
        <span>Seats being edited now: {d.editing.length}</span>
        {d.editing.map((e) => (
          <span key={e.constId} className="inline-flex items-center gap-1.5 rounded-control border border-line bg-subtle px-2 py-0.5 text-ink">
            <Avatar name={e.userName} />
            <span>{e.userName} · {e.seat}</span>
          </span>
        ))}
      </>
    );
  } else if (locks.error) editing = <span className="text-bad-text">Could not load seat locks</span>;
  else editing = <span>Checking seat locks…</span>;

  return (
    <section aria-label="Live console" className="flex items-center justify-between gap-6 rounded-card border border-line bg-card px-4 py-3.5 shadow-sm">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-ink">Live console</h2>
          <span className="text-xs text-ink-2">Counting progress · {pct}% of seats reporting</span>
          <div role="progressbar" aria-label="Counting progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-48 overflow-hidden rounded-full bg-subtle">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
          <Lock size={13} aria-hidden className="text-muted" />
          {editing}
        </div>
      </div>
      <Link to="/overrides" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control bg-accent px-4 text-sm font-medium text-white shadow-sm hover:bg-accent-hover">
        Open live console <ArrowRight size={14} aria-hidden />
      </Link>
    </section>
  );
}

// --- Cards ---

function Card({ title, badge, footer, className, children }: { title: string; badge?: ReactNode; footer?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={cn('flex flex-col rounded-card border border-line bg-card p-4 shadow-sm', className)}>
      <header className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {badge}
      </header>
      {/* Content starts at the top; the "View …" link stays pinned to the bottom (NOTES.md). */}
      <div className="flex-1">{children}</div>
      {footer && <div className="mt-4 border-t border-line pt-3">{footer}</div>}
    </section>
  );
}

/** A card's own loading / error / data states. A failed refresh keeps the earlier data. */
function CardBody<T>({ state, children }: { state: CardState<T>; children: (data: T) => ReactNode }) {
  if (state.data !== null) {
    return (
      <>
        {children(state.data)}
        {state.error && <p className="mt-2 text-[11px] text-muted">Last refresh failed — showing earlier data.</p>}
      </>
    );
  }
  if (state.error) {
    return (
      <div role="alert" className="space-y-2 py-4 text-center">
        <p className="text-xs text-bad-text">{state.error}</p>
        <Button size="sm" variant="outline" onClick={() => { void state.reload(); }}>Try again</Button>
      </div>
    );
  }
  return <p className="py-6 text-center text-xs text-muted">Loading…</p>;
}

function ActivityCard({ d }: { d: DashboardData }) {
  return (
    <Card title="Recent activity" className="min-h-64" footer={<Link to="/logs" className={VIEW_LINK}>View audit log <ArrowRight size={12} aria-hidden /></Link>}>
      <CardBody state={d.activity}>
        {(logs) => (logs.length === 0 ? <p className="py-6 text-center text-xs text-muted">No activity yet.</p> : (
          <ul className="list-none divide-y divide-line">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-2.5 py-2 text-sm">
                <Avatar name={auditActor(l)} />
                <span className="min-w-0 flex-1 truncate text-ink">{describeAudit(l, d.lookup)}</span>
                <time dateTime={l.timestamp} className="shrink-0 text-[11px] text-muted">{timeAgo(l.timestamp, d.now)}</time>
              </li>
            ))}
          </ul>
        ))}
      </CardBody>
    </Card>
  );
}

function HealthCard({ d }: { d: DashboardData }) {
  const h = d.health.data;
  return (
    <Card
      title="System health"
      className="min-h-64"
      badge={h ? <Badge tone={h.ok ? 'ok' : 'bad'}>{h.ok ? 'All OK' : 'Degraded'}</Badge> : undefined}
      footer={d.isSuper ? <Link to="/status" className={VIEW_LINK}>Open system status <ArrowRight size={12} aria-hidden /></Link> : undefined}
    >
      <CardBody state={d.health}>
        {(health) => (
          <ul className="list-none space-y-2">
            {health.rows.map((r) => (
              <li key={r.label} className="flex items-center gap-2.5 rounded-control border border-line px-3 py-2 text-sm">
                <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', r.ok ? 'bg-ok' : 'bg-bad')} />
                <span className="font-medium text-ink">{r.label}</span>
                <span className="ml-auto text-xs text-muted">{r.detail}</span>
                <span className={cn('text-xs font-semibold tabular-nums', r.ok ? 'text-ink' : 'text-bad-text')}>{r.value}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function FeedbackCard({ d }: { d: DashboardData }) {
  const f = d.feedback.data;
  return (
    <Card
      title="Feedback"
      className="min-h-64"
      badge={f && f.count > 0 ? <Badge tone="accent">{fmt(f.count)} new</Badge> : undefined}
      footer={<Link to="/feedback" className={VIEW_LINK}>View all feedback <ArrowRight size={12} aria-hidden /></Link>}
    >
      <CardBody state={d.feedback}>
        {(fb) => (fb.items.length === 0 ? <p className="py-6 text-center text-xs text-muted">No new feedback.</p> : (
          <ul className="list-none space-y-2">
            {fb.items.map((item) => (
              <li key={item.id} className="space-y-1.5 rounded-control border border-line bg-page px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <FeedbackKindBadge kind={item.kind} />
                  <time dateTime={item.createdAt} className="ml-auto text-[11px] text-muted">{timeAgo(item.createdAt, d.now)}</time>
                </div>
                <p className="text-sm text-ink">{firstLine(item.message)}</p>
                {/* Plain text on purpose: the path is user input and must never become a link. */}
                {item.page && <p className="truncate font-mono text-[11px] text-muted">{item.page}</p>}
              </li>
            ))}
          </ul>
        ))}
      </CardBody>
    </Card>
  );
}

// --- VIEWER ---

function ElectionsOverview({ d }: { d: DashboardData }) {
  if (d.electionsLoading) return <p className="py-10 text-center text-sm text-muted">Loading elections…</p>;
  // A failed refresh keeps the list already shown; only a list that never loaded becomes an error.
  if (d.electionsError && d.elections.length === 0) {
    return (
      <div className="rounded-card border border-line bg-card shadow-sm">
        <EmptyState
          title="Could not load elections"
          description="Check the connection and try again."
          action={<Button variant="outline" size="sm" onClick={() => { void d.reloadElections(); }}>Try again</Button>}
        />
      </div>
    );
  }
  const g = groupElections(d.elections);
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Live" value={fmt(g.live.length)} valueClass="text-ok-text" sub="counting now" />
        <Kpi label="Upcoming" value={fmt(g.upcoming.length)} sub="scheduled" />
        <Kpi label="Finalized" value={fmt(g.finalized.length)} sub="final results" />
      </div>
      <div className="grid grid-cols-3 items-start gap-4">
        <ElectionList title="Live now" elections={g.live} empty="No election is counting right now." />
        <ElectionList title="Upcoming elections" elections={g.upcoming} empty="Nothing scheduled." showDate />
        <ElectionList title="Finalized elections" elections={g.finalized} empty="No finalized elections yet." />
      </div>
      {d.electionsError && <p className="text-[11px] text-muted">Last refresh failed — showing earlier data.</p>}
    </>
  );
}

function ElectionList({ title, elections, empty, showDate }: { title: string; elections: Election[]; empty: string; showDate?: boolean }) {
  return (
    <Card title={title}>
      {elections.length === 0 ? <p className="py-4 text-center text-xs text-muted">{empty}</p> : (
        <ul className="list-none divide-y divide-line">
          {elections.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate text-ink">{e.name}</span>
              <span className="shrink-0 text-xs text-muted">
                {showDate && e.tentative_next_date ? formatIstDate(e.tentative_next_date) : `${e.type} · ${e.year}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
