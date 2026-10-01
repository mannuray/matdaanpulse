// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityPage } from './EntityPage';
import { PanelFooter } from './PanelFooter';
import { NoElection } from './NoElection';

const election = vi.hoisted(() => ({ reload: vi.fn(async () => {}) }));
vi.mock('../../context/ElectionContext', () => ({
  useElection: () => ({ elections: [], electionId: '', election: null, setElectionId: vi.fn(), loading: false, error: 'boom', reload: election.reload }),
}));

afterEach(cleanup);

describe('entity scaffold', () => {
  it('EntityPage puts tw-ui on the header and list column, not on the root', () => {
    const { container } = render(<EntityPage header={<h1>Parties</h1>} toolbar={<div>tools</div>} table={<div>table</div>} panel={<aside>panel</aside>} />);
    expect((container.firstElementChild as HTMLElement).className).not.toContain('tw-ui');
    expect(screen.getByRole('heading', { name: 'Parties' }).closest('.tw-ui')).not.toBeNull();
    expect(screen.getByText('table').closest('.tw-ui')).not.toBeNull();
    expect(screen.getByText('panel').closest('.tw-ui')).toBeNull();
  });

  it('PanelFooter shows unsaved state and only enables actions when dirty', () => {
    const onSave = vi.fn();
    const { rerender } = render(<PanelFooter dirty={false} saving={false} onCancel={vi.fn()} onSave={onSave} />);
    expect(screen.getByText('No changes')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<PanelFooter dirty saving={false} onCancel={vi.fn()} onSave={onSave} />);
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalled();
    rerender(<PanelFooter dirty saving={false} canSave={false} onCancel={vi.fn()} onSave={onSave} />);
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('NoElection links to creating an election', () => {
    render(<MemoryRouter><NoElection /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Create an election' }).getAttribute('href')).toBe('/elections/new');
  });

  it('NoElection after a failed elections load offers Try again, which reloads the elections', () => {
    render(<MemoryRouter><NoElection error="boom" /></MemoryRouter>);
    expect(screen.getByText('Could not load elections')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(election.reload).toHaveBeenCalledTimes(1);
  });
});
