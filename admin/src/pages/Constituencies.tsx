import { useState } from 'react';
import { useElection } from '../context/ElectionContext';
import { useShellStatus } from '../context/ShellStatusContext';
import { CONSTITUENCY_PAGE_SIZE, useConstituencyManager } from '../hooks/useConstituencyManager';
import { useEntityRoute } from '../hooks/useEntityRoute';
import { shortElectionName } from '../components/shell/ElectionPicker';
import { EntityPage } from '../components/entity/EntityPage';
import { NoElection } from '../components/entity/NoElection';
import { ConstituencyPanel } from '../components/entity/constituencies/ConstituencyPanel';
import { BULK_TAGS, tagLabel } from '../components/entity/constituencies/tags';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput, Toolbar } from '../components/ui/Toolbar';
import { Select } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import type { Constituency } from '../types';

/** PAGE: Constituencies — seats of the global election, 100 per page; panel at /constituencies/:id. */
export default function Constituencies() {
  const { electionId, election, loading: electionsLoading, error } = useElection();
  const { editorDirty } = useShellStatus();
  const route = useEntityRoute('/constituencies', editorDirty);
  const m = useConstituencyManager(electionId);
  const sel = m.selection;
  const [confirmCompute, setConfirmCompute] = useState(false);

  if (!electionId) {
    return (
      <EntityPage
        header={<PageHeader title="Constituencies" />}
        table={electionsLoading ? <p className="p-10 text-center text-sm text-muted">Loading elections…</p> : <NoElection error={error} />}
      />
    );
  }

  const columns: Column<Constituency>[] = [
    {
      key: 'select',
      header: <input type="checkbox" aria-label="Select all on this page" checked={sel.isAllSelected} onChange={sel.selectAll} />,
      headerClassName: 'w-10',
      cell: (c) => (
        <input type="checkbox" aria-label={`Select ${c.name}`} checked={sel.selectedIds.has(c.id)} onChange={() => sel.toggle(c.id)} onClick={(e) => e.stopPropagation()} />
      ),
    },
    { key: 'no', header: 'No.', className: 'w-14 font-mono text-xs text-muted', cell: (c) => c.const_no },
    { key: 'name', header: 'Seat', cell: (c) => <div><div className="font-medium text-ink">{c.name}</div><div className="text-[11px] text-muted">{c.type}</div></div> },
    {
      key: 'district',
      header: 'District / region',
      cell: (c) => <div><div className="text-ink-2">{c.district?.name || '–'}</div><div className="text-[11px] text-muted">{c.region?.name || '–'}</div></div>,
    },
    {
      key: 'tags',
      header: 'Tags',
      cell: (c) => {
        const tags = (c.metadata?.tags as string[] | undefined) ?? [];
        return (
          <div className="flex flex-wrap items-center gap-1">
            {tags.slice(0, 3).map((t) => <Badge key={t} tone="muted">{tagLabel(t)}</Badge>)}
            {tags.length > 3 && <span className="text-[11px] text-muted">+{tags.length - 3}</span>}
          </div>
        );
      },
    },
  ];
  const filtered = !!(m.districtFilter || m.tagFilter);

  return (
    <EntityPage
      header={
        <PageHeader
          title="Constituencies"
          count={m.total}
          subtitle={election ? shortElectionName(election.name, election.type, election.year) : undefined}
          actions={<Button variant="outline" disabled={m.computing} onClick={() => setConfirmCompute(true)}>{m.computing ? 'Computing…' : 'Compute all analysis'}</Button>}
        />
      }
      toolbar={
        <Toolbar>
          <SearchInput label="Search seats" placeholder="Search by name or number…" value={m.search} onChange={m.setSearch} />
          <Select aria-label="District (this page)" className="w-52" value={m.districtFilter} onChange={(e) => m.setDistrictFilter(e.target.value)}>
            <option value="">All districts (this page)</option>
            {m.allDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Select aria-label="Tag (this page)" className="w-48" value={m.tagFilter} onChange={(e) => m.setTagFilter(e.target.value)}>
            <option value="">All tags (this page)</option>
            {m.allTags.map((t) => <option key={t} value={t}>{tagLabel(t)}</option>)}
          </Select>
          {sel.count > 0 && (
            <div className="ml-auto flex items-center gap-2 rounded-control bg-accent-soft px-2.5 py-1">
              <span className="text-xs font-medium text-accent">{sel.count} selected</span>
              <Select aria-label="Add tag to selected" className="h-8 w-44" value="" onChange={(e) => { if (e.target.value) void m.bulkAddTag(e.target.value); }}>
                <option value="">Add tag…</option>
                {BULK_TAGS.map((t) => <option key={t} value={t}>{tagLabel(t)}</option>)}
              </Select>
              <Button size="sm" variant="ghost" onClick={sel.clear}>Clear</Button>
            </div>
          )}
        </Toolbar>
      }
      table={
        <DataTable
          label="Constituencies"
          columns={columns}
          rows={m.constituencies}
          rowKey={(c) => c.id}
          selectedKey={route.id}
          onRowClick={(c) => route.open(c.id)}
          loading={m.loading}
          empty={<EmptyState title="No seats match" description={filtered ? 'The district and tag filters only look at this page.' : 'Try a different name or number.'} />}
          footer={
            <Pager
              page={m.page} totalPages={m.totalPages} total={m.total} pageSize={CONSTITUENCY_PAGE_SIZE} noun="seats" onPage={m.loadPage}
              note={filtered ? 'district and tag filters apply to this page' : undefined}
            />
          }
        />
      }
      panel={
        <>
          {route.id ? <ConstituencyPanel key={route.id} id={route.id} onClose={() => route.close()} onSaved={m.refresh} /> : null}
          <ConfirmDialog
            open={confirmCompute}
            title="Compute all analysis?"
            description="This queues analysis for every seat in the selected election, which is heavy work. Existing analysis is replaced."
            confirmLabel="Compute all"
            tone="primary"
            busy={m.computing}
            onCancel={() => setConfirmCompute(false)}
            onConfirm={async () => { await m.computeAnalysis(); setConfirmCompute(false); }}
          />
        </>
      }
    />
  );
}
