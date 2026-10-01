// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DataTable, type Column } from './DataTable';
import { Pager } from './Pager';
import { ChipGroup } from './Toolbar';
import { PageHeader } from './PageHeader';
import { EmptyState } from './EmptyState';

afterEach(cleanup);

type Row = { id: string; name: string };
const COLS: Column<Row>[] = [{ key: 'name', header: 'Name', cell: (r) => r.name }];

describe('DataTable', () => {
  it('renders sentence-case headers and rows, clicks and Enter open a row, the selected row is marked', () => {
    const onRowClick = vi.fn();
    render(<DataTable label="Parties" columns={COLS} rows={[{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }]} rowKey={(r) => r.id} selectedKey="b" onRowClick={onRowClick} />);
    const table = screen.getByRole('table', { name: 'Parties' });
    expect(within(table).getByRole('columnheader', { name: 'Name' })).toBeTruthy();
    fireEvent.click(screen.getByText('Alpha'));
    expect(onRowClick).toHaveBeenCalledWith({ id: 'a', name: 'Alpha' });
    const beta = screen.getByText('Beta').closest('tr')!;
    expect(beta.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(beta, { key: 'Enter' });
    expect(onRowClick).toHaveBeenLastCalledWith({ id: 'b', name: 'Beta' });
  });

  it('shows the empty state when there are no rows', () => {
    render(<DataTable label="Parties" columns={COLS} rows={[]} rowKey={(r) => r.id} empty={<EmptyState title="No parties match" />} />);
    expect(screen.getByText('No parties match')).toBeTruthy();
  });
});

describe('Pager', () => {
  it('shows the range and disables Previous on page 1', () => {
    const onPage = vi.fn();
    render(<Pager page={1} totalPages={13} total={312} pageSize={25} noun="parties" onPage={onPage} />);
    expect(screen.getByText('Showing 1–25 of 312 parties')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});

describe('ChipGroup and PageHeader', () => {
  it('marks the active chip and reports changes', () => {
    const onChange = vi.fn();
    render(<ChipGroup label="Person link" value="all" onChange={onChange} options={[{ value: 'all', label: 'All', count: 3 }, { value: 'linked', label: 'Linked', count: 1 }]} />);
    expect(screen.getByRole('button', { name: /^All/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^Linked/ }));
    expect(onChange).toHaveBeenCalledWith('linked');
  });

  it('PageHeader shows the title and an en-IN count', () => {
    render(<PageHeader title="Candidates" count={1204} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Candidates' })).toBeTruthy();
    expect(screen.getByText('1,204')).toBeTruthy();
  });
});
