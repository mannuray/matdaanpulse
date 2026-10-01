import { useMemo, useState } from 'react';
import { useElection } from '../context/ElectionContext';
import { useShellStatus } from '../context/ShellStatusContext';
import { useEntityRoute } from '../hooks/useEntityRoute';
import { EntityPage } from '../components/entity/EntityPage';
import { NoElection } from '../components/entity/NoElection';
import { ElectionStatusBadge, electionTypeLabel } from '../components/entity/elections/ElectionPanel';
import { ManifestPanel } from '../components/entity/manifests/ManifestPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { ChipGroup, SearchInput, Toolbar } from '../components/ui/Toolbar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import type { Election } from '../types';

type TypeFilter = '' | 'LS' | 'VS';

const COLUMNS: Column<Election>[] = [
  { key: 'name', header: 'Election', cell: (e) => <span className="font-medium text-ink">{e.name}</span> },
  { key: 'type', header: 'Type', className: 'text-ink-2', cell: (e) => electionTypeLabel(e.type) },
  { key: 'year', header: 'Year', className: 'tabular-nums text-ink-2', cell: (e) => e.year },
  { key: 'status', header: 'Status', cell: (e) => <ElectionStatusBadge status={e.status} /> },
  { key: 'manifest', header: 'Manifest', cell: (e) => (e.manifest_url ? <Badge tone="ok">Published</Badge> : <Badge tone="muted">Not published</Badge>) },
];

/** PAGE: Manifests — one per election; the full-width manifest panel opens at /manifests/:electionId. */
export default function Manifests() {
  const { elections, loading, error, reload } = useElection();
  const { editorDirty } = useShellStatus();
  const route = useEntityRoute('/manifests', editorDirty);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TypeFilter>('');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return elections.filter((e) => (!type || e.type === type) && (!q || e.name.toLowerCase().includes(q)));
  }, [elections, search, type]);
  const open = route.id ? elections.find((e) => e.id === route.id) ?? null : null;

  return (
    <EntityPage
      header={<PageHeader title="Manifests" count={elections.length} subtitle="One per election: what the public results page shows" />}
      toolbar={
        <Toolbar>
          <SearchInput label="Search elections" placeholder="Search by name…" value={search} onChange={setSearch} />
          <ChipGroup<TypeFilter>
            label="Type"
            value={type}
            onChange={setType}
            options={[{ value: '', label: 'All' }, { value: 'LS', label: 'Lok Sabha' }, { value: 'VS', label: 'Vidhan Sabha' }]}
          />
        </Toolbar>
      }
      table={
        <DataTable
          label="Manifests"
          columns={COLUMNS}
          rows={rows}
          rowKey={(e) => e.id}
          selectedKey={route.id}
          onRowClick={(e) => route.open(e.id)}
          loading={loading}
          empty={error || elections.length === 0
            ? <NoElection error={error} />
            : <EmptyState title="No elections match" description="Try a different search or type." />}
        />
      }
      panel={route.id ? (
        <ManifestPanel key={route.id} electionId={route.id} election={open} onClose={() => route.close()} onPublished={() => { void reload(); }} />
      ) : null}
    />
  );
}
