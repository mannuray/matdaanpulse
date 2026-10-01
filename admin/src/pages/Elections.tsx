import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';
import { useShellStatus } from '../context/ShellStatusContext';
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
import type { Election, State } from '../types';

const columns = (states: State[]): Column<Election>[] => [
  {
    key: 'name',
    header: 'Election',
    cell: (e) => <div><div className="font-medium text-ink">{e.name}</div><div className="text-[11px] text-muted">{e.year}</div></div>,
  },
  { key: 'type', header: 'Type', className: 'text-ink-2', cell: (e) => electionTypeLabel(e.type) },
  { key: 'state', header: 'State', className: 'text-ink-2', cell: (e) => (e.state_id == null ? 'National' : states.find((s) => s.id === e.state_id)?.name ?? '–') },
  { key: 'status', header: 'Status', cell: (e) => <ElectionStatusBadge status={e.status} /> },
];

/** PAGE: Elections — table + create/edit panel at /elections/:id (create at /elections/new). */
export default function Elections() {
  const { hasRole } = useAuth();
  const canFinalize = hasRole('SUPER_ADMIN');
  const ctx = useElection();
  const { editorDirty } = useShellStatus();
  const route = useEntityRoute('/elections', editorDirty);
  const m = useElectionManager({ onChanged: ctx.reload });
  const [confirm, setConfirm] = useState<'live' | 'finalize' | null>(null);

  // Resolve the open record from the full list: the table's (remembered) filters may hide it.
  const target = route.id && !route.isNew ? ctx.elections.find((e) => e.id === route.id) ?? null : null;
  useEffect(() => {
    if (route.isNew) m.startCreate();
    else if (target) m.startEdit(target);
    // Only when the open record changes — not when its object is refreshed by a reload.
  }, [route.id, target?.id]);

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
            columns={columns(m.states)}
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
        panel={route.id ? (
          <ElectionPanel
            key={route.id}
            mode={route.isNew ? 'new' : 'edit'}
            election={target}
            manager={m}
            loadingElections={ctx.loading}
            loadFailed={!!ctx.error}
            onRetry={() => { void ctx.reload(); }}
            canFinalize={canFinalize}
            onClose={() => route.close()}
            onSave={save}
            onGoLive={() => setConfirm('live')}
            onFinalize={() => setConfirm('finalize')}
          />
        ) : null}
      />
      <ConfirmDialog
        open={confirm === 'live'}
        tone="primary"
        title="Go live?"
        description="Viewers will see this election as live, and the Live Console will accept results for it."
        confirmLabel="Go live"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { setConfirm(null); if (target) void m.goLive(target.id); }}
      />
      {canFinalize && (
        <ConfirmDialog
          open={confirm === 'finalize'}
          title="Finalize election?"
          description="This will archive live data, disable scraping and manual overrides. This action cannot be undone."
          confirmLabel="Yes, finalize"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); if (target) void m.handleFinalize(target.id); }}
        />
      )}
    </>
  );
}
