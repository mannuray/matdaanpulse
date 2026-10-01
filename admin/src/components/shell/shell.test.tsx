// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { ElectionPicker } from './ElectionPicker';

const auth = { user: { id: 'u', name: 'Mannu K', role: 'EDITOR', email: 'x' }, logout: vi.fn(), hasRole: (r: string) => r === 'EDITOR' };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
const shell = vi.hoisted(() => ({ editorDirty: false }));
vi.mock('../../context/ShellStatusContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../context/ShellStatusContext')>()),
  useShellStatus: () => ({ live: 'idle', setLive: () => {}, editorDirty: shell.editorDirty, setEditorDirty: () => {} }),
}));
const election = vi.hoisted(() => ({ setElectionId: vi.fn() }));
vi.mock('../../context/ElectionContext', () => ({
  useElection: () => ({
    elections: [
      { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', year: 2025, status: 'Live' },
      { id: 'e2', name: 'Kerala Vidhan Sabha 2021', type: 'VS', year: 2021, status: 'Completed' },
    ],
    electionId: 'e1', setElectionId: election.setElectionId,
  }),
}));
// Radix Select needs pointer capture / scrollIntoView in jsdom; a native <select> exercises the same onValueChange.
vi.mock('@radix-ui/react-select', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Root: ({ value, onValueChange, children }: { value: string; onValueChange(v: string): void; children: ReactNode }) => (
      <select aria-label="Election" value={value} onChange={(e) => onValueChange(e.target.value)}>{children}</select>
    ),
    Trigger: () => null, Value: Pass, Icon: Pass, Portal: Pass, Content: Pass, Viewport: Pass, ItemIndicator: () => null,
    Item: ({ value }: { value: string }) => <option value={value}>{value}</option>,
    ItemText: Pass,
  };
});
function Where() { return <output data-testid="where">{useLocation().pathname}</output>; }
afterEach(() => { cleanup(); shell.editorDirty = false; election.setElectionId.mockClear(); vi.restoreAllMocks(); });

describe('Sidebar', () => {
  it('groups items under sentence-case headings and hides SUPER_ADMIN items for editors', () => {
    render(<MemoryRouter initialEntries={['/overrides']}><Sidebar /></MemoryRouter>);
    expect(screen.getByText('Counting')).toBeTruthy();
    expect(screen.getByText('Data')).toBeTruthy();
    expect(screen.queryByText('Users')).toBeNull();
    expect(screen.queryByText('Audit logs')).toBeNull();
    expect(screen.getByRole('link', { name: /Live console/ }).getAttribute('aria-current')).toBe('page');
  });

  it('with unsaved seat edits, a sidebar link asks first and cancel stays on the page', () => {
    shell.editorDirty = true;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter initialEntries={['/overrides']}><Sidebar /><Routes><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: /Elections/ }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(screen.getByTestId('where').textContent).toBe('/overrides');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('link', { name: /Elections/ }));
    expect(screen.getByTestId('where').textContent).toBe('/elections');
  });

  it('a sidebar link navigates without asking when nothing is unsaved', () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<MemoryRouter initialEntries={['/overrides']}><Sidebar /><Routes><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: /Elections/ }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/elections');
  });

  it('with unsaved edits, the link to the current section asks too (it would close the open record)', () => {
    shell.editorDirty = true;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter initialEntries={['/parties/BJP']}><Sidebar /><Routes><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: /Parties/ }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(screen.getByTestId('where').textContent).toBe('/parties/BJP');
  });
});

describe('ElectionPicker', () => {
  it('with unsaved seat edits, switching election asks first and cancel keeps the election', () => {
    shell.editorDirty = true;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ElectionPicker />);
    fireEvent.change(screen.getByLabelText('Election'), { target: { value: 'e2' } });
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(election.setElectionId).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.change(screen.getByLabelText('Election'), { target: { value: 'e2' } });
    expect(election.setElectionId).toHaveBeenCalledWith('e2');
  });

  it('switches straight away when nothing is unsaved', () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<ElectionPicker />);
    fireEvent.change(screen.getByLabelText('Election'), { target: { value: 'e2' } });
    expect(confirm).not.toHaveBeenCalled();
    expect(election.setElectionId).toHaveBeenCalledWith('e2');
  });
});
