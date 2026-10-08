import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';
import { useUnsavedEdits } from '../context/UnsavedEditsContext';
import { useElectionManager } from '../hooks/useElectionManager';
import { NEW_ID, useEntityRoute } from '../hooks/useEntityRoute';
import { EntityPage } from '../components/entity/EntityPage';
import { ElectionPanel, ElectionStatusBadge, electionTypeLabel } from '../components/entity/elections/ElectionPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { ChipGroup, SearchInput, Toolbar } from '../components/ui/Toolbar';
import { Select } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatIstDate } from '../utils/time';
import { lifecycleActions, type LifecycleKind } from '../utils/lifecycle';
import type { Election, State } from '../types';

type Lifecycle = { kind: LifecycleKind; election: Election };

interface RowActions {
  currentId: string;
  role: string | undefined;
  onEdit: (e: Election) => void;
  onLifecycle: (l: Lifecycle) => void;
  onMakeCurrent: (e: Election) => void;
  onManifest: (e: Election) => void;
  onLiveConsole: (e: Election) => void;
}

const MENU_ITEM = 'cursor-pointer rounded-control px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-subtle';

function ActionsCell({ e, a }: { e: Election; a: RowActions }) {
  return (
    <div className="flex items-center justify-end gap-2">
      {lifecycleActions(e, a.role).map((l) => (
        <Button key={l.kind} size="sm" variant="outline" onClick={() => a.onLifecycle({ kind: l.kind, election: e })}>{l.label}</Button>
      ))}
      <Menu.Root>
        <Menu.Trigger aria-label={`More actions for ${e.name}`} className="rounded-control p-1.5 text-muted hover:bg-subtle hover:text-ink">
          <MoreHorizontal size={16} aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content align="end" sideOffset={4} className="z-50 min-w-44 rounded-card border border-line bg-card p-1 shadow-lg">
            <Menu.Item className={MENU_ITEM} onSelect={() => a.onEdit(e)}>Edit</Menu.Item>
            <Menu.Item className={MENU_ITEM} onSelect={() => a.onManifest(e)}>Open manifest</Menu.Item>
            {e.status === 'Live' && <Menu.Item className={MENU_ITEM} onSelect={() => a.onLiveConsole(e)}>Open live console</Menu.Item>}
            {e.id !== a.currentId && <Menu.Item className={MENU_ITEM} onSelect={() => a.onMakeCurrent(e)}>Make current</Menu.Item>}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

const columns = (states: State[], a: RowActions): Column<Election>[] => [
  {
    key: 'name',
    header: 'Election',
    cell: (e) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-ink">{e.name}</span>
        {e.id === a.currentId && <Badge tone="accent">Current</Badge>}
      </div>
    ),
  },
  { key: 'year', header: 'Year', className: 'tabular-nums text-ink-2', cell: (e) => e.year },
  { key: 'type', header: 'Type', className: 'text-ink-2', cell: (e) => electionTypeLabel(e.type) },
  { key: 'state', header: 'State', className: 'text-ink-2', cell: (e) => (e.state_id == null ? 'National' : states.find((s) => s.id === e.state_id)?.name ?? '–') },
  { key: 'status', header: 'Status', cell: (e) => <ElectionStatusBadge status={e.status} /> },
  {
    key: 'next',
    header: 'Result date',
    className: 'tabular-nums text-ink-2',
    cell: (e) => (e.tentative_next_date ? formatIstDate(e.tentative_next_date) : <span className="text-muted">–</span>),
  },
  {
    key: 'manifest',
    header: 'Manifest',
    cell: (e) => (e.manifest_url ? <Badge tone="ok">Published</Badge> : <span className="text-xs text-muted">Not published</span>),
  },
  { key: 'actions', header: <span className="sr-only">Actions</span>, className: 'text-right', cell: (e) => <ActionsCell e={e} a={a} /> },
];

/** PAGE: Elections — full-width table with row actions; create/edit in a dialog at /elections/:id (create at /elections/new). */
export default function Elections() {
  const { user, hasRole } = useAuth();
  const canFinalize = hasRole('SUPER_ADMIN');
  const ctx = useElection();
  const { editorDirty } = useUnsavedEdits();
  const route = useEntityRoute('/elections', editorDirty);
  const m = useElectionManager({ onChanged: ctx.reload });
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<Lifecycle | null>(null);

  // Resolve the open record from the full list: the table's (remembered) filters may hide it.
  const target = route.id && !route.isNew ? ctx.elections.find((e) => e.id === route.id) ?? null : null;
  useEffect(() => {
    if (route.isNew) m.startCreate();
    else if (target) m.startEdit(target);
    // Only when the open record changes — not when its object is refreshed by a reload.
  }, [route.id, target?.id]);

  // ElectionContext reads ?election= only on first load, so switch first (as CommandPalette and
  // RecordLink do); the navigation then carries the same election. No dirty check: the edit dialog
  // is modal and closed whenever this menu is reachable.
  const openForElection = (e: Election, path: string) => {
    if (e.id !== ctx.electionId) ctx.setElectionId(e.id);
    navigate(`${path}?election=${encodeURIComponent(e.id)}`);
  };

  const actions: RowActions = {
    currentId: ctx.electionId,
    role: user?.role,
    onEdit: (e) => route.open(e.id),
    onLifecycle: setConfirm,
    onMakeCurrent: (e) => ctx.setElectionId(e.id),
    onManifest: (e) => openForElection(e, `/manifests/${e.id}`),
    onLiveConsole: (e) => openForElection(e, '/overrides'),
  };

  const save = async () => {
    const id = await m.handleSave();
    if (id && route.isNew) route.open(id, { force: true });
  };

  return (
    <>
      <EntityPage
        header={
          <PageHeader
            title="Elections"
            count={m.total}
            subtitle="Lok Sabha and Vidhan Sabha cycles"
            actions={<Button variant="primary" onClick={() => route.open(NEW_ID)}><Plus size={16} aria-hidden />New election</Button>}
          />
        }
        toolbar={
          <Toolbar>
            <SearchInput label="Search elections" placeholder="Search by name…" value={m.search} onChange={m.handleSearch} />
            <ChipGroup
              label="Type"
              value={m.filters.type}
              onChange={(type) => m.updateFilters({ type, stateId: null })}
              options={[{ value: '', label: 'All' }, { value: 'LS', label: 'Lok Sabha' }, { value: 'VS', label: 'Vidhan Sabha' }]}
            />
            <Select aria-label="Status" className="w-40" value={m.filters.status} onChange={(e) => m.updateFilters({ status: e.target.value })}>
              <option value="">All statuses</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Live">Live</option>
              <option value="Finalized">Finalized</option>
            </Select>
          </Toolbar>
        }
        table={
          <DataTable
            label="Elections"
            columns={columns(m.states, actions)}
            rows={m.items as Election[]}
            rowKey={(e) => e.id}
            selectedKey={route.id}
            onRowClick={(e) => route.open(e.id)}
            loading={m.loading}
            empty={m.error
              ? <EmptyState title="Could not load elections" description={m.error} />
              : <EmptyState title="No elections match" description="Try a different search or filter, or create one." />}
          />
        }
      />
      {route.id && (
          <ElectionPanel
            key={route.id}
            mode={route.isNew ? 'new' : 'edit'}
            election={target}
            manager={m}
            loadingElections={ctx.loading}
            loadFailed={!!ctx.error}
            onRetry={() => { void ctx.reload(); }}
            role={user?.role}
            onClose={() => route.close()}
            onSave={save}
            onLifecycle={(kind) => { if (target) setConfirm({ kind, election: target }); }}
          />
      )}
      <ConfirmDialog
        open={confirm?.kind === 'live'}
        tone="primary"
        title="Go live?"
        description="Viewers will see this election as live, and the Live Console will accept results for it."
        confirmLabel="Go live"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { const c = confirm; setConfirm(null); if (c) void m.goLive(c.election.id); }}
      />
      {canFinalize && (
        <ConfirmDialog
          open={confirm?.kind === 'finalize'}
          title="Finalize election?"
          description="This will archive live data, disable scraping and manual overrides. This action cannot be undone."
          confirmLabel="Yes, finalize"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const c = confirm; setConfirm(null); if (c) void m.handleFinalize(c.election.id); }}
        />
      )}
      {canFinalize && (
        <ConfirmDialog
          open={confirm?.kind === 'reopen'}
          title="Reopen election?"
          description={`Reopen ${confirm?.election.name ?? 'this election'}? It becomes Live again: the feed and admin corrections can change results until you finalize it again.`}
          confirmLabel="Reopen"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { const c = confirm; setConfirm(null); if (c) void m.handleReopen(c.election.id); }}
        />
      )}
    </>
  );
}
