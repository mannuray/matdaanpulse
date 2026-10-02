import { useSearchParams } from 'react-router-dom';
import { useShellStatus } from '../context/ShellStatusContext';
import { useResourceList } from '../hooks/useResourceList';
import { useEntityRoute } from '../hooks/useEntityRoute';
import { getPersons, type ContestsFilter } from '../services/person.api';
import { genderLabel } from '../utils/person-format';
import { EntityPage } from '../components/entity/EntityPage';
import { PersonRecord } from '../components/entity/persons/PersonRecord';
import { PageHeader } from '../components/ui/PageHeader';
import { ChipGroup, SearchInput, Toolbar } from '../components/ui/Toolbar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/ui/EmptyState';
import type { PersonWithStats } from '../types';

const PAGE_SIZE = 50;

/** The Contests filter: '' is All. Kept in the list state (and remembered like the other list filters). */
type PersonFilters = { contests: '' | ContestsFilter };
const NO_FILTERS: PersonFilters = { contests: '' };
const CONTEST_OPTIONS: { value: PersonFilters['contests']; label: string }[] = [
  { value: '', label: 'All' },
  { value: '1', label: '1 contest' },
  { value: '2plus', label: '2 or more' },
  // Persons made on their own (no contest moved away, so no trigger removed them): open one to merge it.
  { value: '0', label: 'None' },
];

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

/**
 * PAGE: Persons — full-width master registry table; a row opens the person's record page at /persons/:id, which
 * replaces the list. The list hooks stay mounted under `persons/*`, so its search and page survive the round trip.
 * `?q=` seeds the search. There is no create flow: persons come from the data import.
 */
export default function Persons() {
  const [params] = useSearchParams();
  const { editorDirty } = useShellStatus();
  const route = useEntityRoute('/persons', editorDirty);
  const list = useResourceList<PersonFilters>({
    key: 'persons',
    pageSize: PAGE_SIZE,
    initialFilters: NO_FILTERS,
    initialSearch: params.get('q'),
    // A stored value that is no longer an option falls back to All.
    sanitizeFilters: (f) => ({ contests: CONTEST_OPTIONS.some((o) => o.value === f.contests) ? f.contests : '' }),
    onLoad: async (page, search, f) => {
      const res = await getPersons(page, PAGE_SIZE, search || undefined, f.contests ? { contests: f.contests } : {});
      return { data: res.data || [], total: res.pagination?.total || 0 };
    },
  });

  if (route.id) {
    return <PersonRecord key={route.id} id={route.id} onBack={() => route.close()} onSaved={list.refresh} onOpenPerson={(pid) => route.open(pid)} />;
  }

  return (
    <EntityPage
      header={<PageHeader title="Persons" count={list.total} subtitle="One record per politician, across elections" />}
      toolbar={
        <Toolbar>
          <SearchInput label="Search persons" placeholder="Search by name…" value={list.search} onChange={list.handleSearch} />
          <ChipGroup<PersonFilters['contests']>
            label="Contests"
            value={list.filters.contests}
            onChange={(contests) => list.updateFilters({ contests })}
            options={CONTEST_OPTIONS}
          />
        </Toolbar>
      }
      table={
        <DataTable
          label="Persons"
          columns={COLUMNS}
          rows={list.items as PersonWithStats[]}
          rowKey={(p) => p.id}
          onRowClick={(p) => route.open(p.id)}
          loading={list.loading}
          empty={list.error
            ? <EmptyState title="Could not load persons" description={list.error} />
            : <EmptyState title="No persons match" description="Try a different name or contests filter." />}
          footer={<Pager page={list.page} totalPages={list.totalPages} total={list.total} pageSize={PAGE_SIZE} noun="persons" onPage={list.loadPage} />}
        />
      }
    />
  );
}
