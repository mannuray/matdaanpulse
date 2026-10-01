import { useSearchParams } from 'react-router-dom';
import { useShellStatus } from '../context/ShellStatusContext';
import { useResourceList } from '../hooks/useResourceList';
import { useEntityRoute } from '../hooks/useEntityRoute';
import { getPersons } from '../services/person.api';
import { genderLabel } from '../utils/person-format';
import { EntityPage } from '../components/entity/EntityPage';
import { PersonPanel } from '../components/entity/persons/PersonPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput, Toolbar } from '../components/ui/Toolbar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/ui/EmptyState';
import type { PersonWithStats } from '../types';

const PAGE_SIZE = 50;

const COLUMNS: Column<PersonWithStats>[] = [
  {
    key: 'person',
    header: 'Person',
    cell: (p) => (
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line bg-subtle text-xs font-semibold text-ink-2">
          {p.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> : p.name.charAt(0)}
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{p.name}</div>
          <div className="font-mono text-[11px] text-muted">{p.id.split('-')[0]}</div>
        </div>
      </div>
    ),
  },
  { key: 'education', header: 'Education', className: 'text-ink-2', cell: (p) => p.education || '–' },
  { key: 'gender', header: 'Gender', className: 'text-ink-2', cell: (p) => genderLabel(p.gender) },
  { key: 'contests', header: 'Contests', className: 'tabular-nums text-ink-2', cell: (p) => p.candidate_count },
];

/** PAGE: Persons — master registry table + person panel at /persons/:id. `?q=` seeds the search. */
export default function Persons() {
  const [params] = useSearchParams();
  const { editorDirty } = useShellStatus();
  const route = useEntityRoute('/persons', editorDirty);
  const list = useResourceList<Record<string, never>>({
    key: 'persons',
    pageSize: PAGE_SIZE,
    initialFilters: {},
    initialSearch: params.get('q'),
    onLoad: async (page, search) => {
      const res = await getPersons(page, PAGE_SIZE, search || undefined);
      return { data: res.data || [], total: res.pagination?.total || 0 };
    },
  });

  return (
    <EntityPage
      header={<PageHeader title="Persons" count={list.total} subtitle="One record per politician, across elections" />}
      toolbar={
        <Toolbar>
          <SearchInput label="Search persons" placeholder="Search by name…" value={list.search} onChange={list.handleSearch} />
        </Toolbar>
      }
      table={
        <DataTable
          label="Persons"
          columns={COLUMNS}
          rows={list.items as PersonWithStats[]}
          rowKey={(p) => p.id}
          selectedKey={route.id}
          onRowClick={(p) => route.open(p.id)}
          loading={list.loading}
          empty={list.error
            ? <EmptyState title="Could not load persons" description={list.error} />
            : <EmptyState title="No persons match" description="Try a different name." />}
          footer={<Pager page={list.page} totalPages={list.totalPages} total={list.total} pageSize={PAGE_SIZE} noun="persons" onPage={list.loadPage} />}
        />
      }
      panel={route.id ? <PersonPanel key={route.id} id={route.id} onClose={() => route.close()} onChanged={list.refresh} /> : null}
    />
  );
}
