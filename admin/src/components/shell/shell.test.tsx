// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { ElectionPicker, shortElectionName } from './ElectionPicker';
import { TopBar } from './TopBar';
import { HealthDot } from './HealthDot';
import { notifyFeedbackChanged } from '../../utils/feedback';

const auth = { user: { id: 'u', name: 'Mannu K', role: 'EDITOR', email: 'x' }, logout: vi.fn(), hasRole: (r: string) => r === auth.user.role };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
const shell = vi.hoisted(() => ({ editorDirty: false, live: 'idle' as 'idle' | 'connecting' | 'open' | 'reconnecting' | 'offline' }));
vi.mock('../../context/ShellStatusContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../context/ShellStatusContext')>()),
  useShellStatus: () => ({ live: shell.live, setLive: () => {}, editorDirty: shell.editorDirty, markDirty: () => {} }),
}));
const election = vi.hoisted(() => ({
  setElectionId: vi.fn(),
  // Stable identity: CommandPalette's search effect depends on `elections`, so a fresh array per render would loop.
  elections: [
    { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', year: 2025, status: 'Live' },
    { id: 'e2', name: 'Kerala Vidhan Sabha 2021', type: 'VS', year: 2021, status: 'Completed' },
  ],
}));
vi.mock('../../context/ElectionContext', () => ({
  useElection: () => ({ elections: election.elections, electionId: 'e1', setElectionId: election.setElectionId }),
}));
vi.mock('@radix-ui/react-dropdown-menu', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Root: Pass, Portal: Pass, Content: Pass,
    Trigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Item: ({ children, onSelect }: { children?: ReactNode; onSelect?: (e: Event) => void }) => (
      <button type="button" onClick={() => onSelect?.(new Event('select', { cancelable: true }))}>{children}</button>
    ),
  };
});
function Where() { return <output data-testid="where">{useLocation().pathname}</output>; }
afterEach(() => {
  cleanup();
  shell.editorDirty = false;
  shell.live = 'idle';
  election.setElectionId.mockClear();
  auth.user.role = 'EDITOR';
  auth.logout.mockClear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Election' }));

  it('shows the current election with its status, and lists elections as a state × year grid', () => {
    render(<ElectionPicker />);
    expect(screen.getByRole('button', { name: 'Election' }).textContent).toContain('Bihar · Vidhan Sabha 2025 · Live');
    open();
    expect(screen.getByText('Live & upcoming')).toBeTruthy();
    expect(screen.getByText('Kerala')).toBeTruthy();
    expect(screen.getByRole('option', { name: '2021' })).toBeTruthy();
  });

  it('typing filters and Enter picks the first match', () => {
    render(<ElectionPicker />);
    open();
    const input = screen.getByLabelText('Search elections');
    fireEvent.change(input, { target: { value: 'ker' } });
    expect(within(screen.getByRole('listbox')).queryByText('Bihar')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(election.setElectionId).toHaveBeenCalledWith('e2');
  });

  it('a search with no result says so', () => {
    render(<ElectionPicker />);
    open();
    fireEvent.change(screen.getByLabelText('Search elections'), { target: { value: 'assam' } });
    expect(screen.getByText(/No election matches/)).toBeTruthy();
  });

  it('E opens it from anywhere, but not while typing in a field', () => {
    render(<><input aria-label="other" /><ElectionPicker /></>);
    fireEvent.keyDown(screen.getByLabelText('other'), { key: 'e' });
    expect(screen.queryByLabelText('Search elections')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'e' });
    expect(screen.getByLabelText('Search elections')).toBeTruthy();
  });

  it('E does nothing while a menu or a popover is open', () => {
    const { rerender } = render(<><div role="menu"><div role="menuitem" tabIndex={-1}>Edit</div></div><ElectionPicker /></>);
    fireEvent.keyDown(screen.getByRole('menuitem'), { key: 'e' });
    fireEvent.keyDown(document.body, { key: 'e' });
    expect(screen.queryByLabelText('Search elections')).toBeNull();
    rerender(<><div data-radix-popper-content-wrapper=""><p>Popover</p></div><ElectionPicker /></>);
    fireEvent.keyDown(document.body, { key: 'e' });
    expect(screen.queryByLabelText('Search elections')).toBeNull();
    rerender(<ElectionPicker />);
    fireEvent.keyDown(document.body, { key: 'e' });
    expect(screen.getByLabelText('Search elections')).toBeTruthy();
  });

  it('with unsaved seat edits, switching election asks first and cancel keeps the election', () => {
    shell.editorDirty = true;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ElectionPicker />);
    open();
    fireEvent.click(screen.getByRole('option', { name: '2021' }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(election.setElectionId).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('option', { name: '2021' }));
    expect(election.setElectionId).toHaveBeenCalledWith('e2');
  });

  it('switches straight away when nothing is unsaved; re-picking the current one does nothing', () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<ElectionPicker />);
    open();
    fireEvent.click(screen.getByRole('option', { name: '2021' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(election.setElectionId).toHaveBeenCalledWith('e2');
    election.setElectionId.mockClear();
    open();
    fireEvent.click(screen.getAllByRole('option', { name: /2025/ })[0]);
    expect(election.setElectionId).not.toHaveBeenCalled();
  });
});

describe('shortElectionName', () => {
  it('national Lok Sabha becomes "Lok Sabha <year>"', () => {
    expect(shortElectionName('Lok Sabha General Election 2029', 'LS', 2029)).toBe('Lok Sabha 2029');
  });
  it('state assemblies keep the state and the type', () => {
    expect(shortElectionName('Bihar Vidhan Sabha 2025', 'VS', 2025)).toBe('Bihar VS 2025');
  });
});

describe('TopBar', () => {
  it('with unsaved edits, Log out asks first; cancel keeps the session, confirm logs out', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    shell.editorDirty = true;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(auth.logout).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('Log out does not ask when nothing is unsaved', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    const confirm = vi.spyOn(window, 'confirm');
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('the live pill reads "Live updates offline" in rose when the stream is offline', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    shell.live = 'offline';
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    const pill = screen.getByText('Live updates offline');
    expect(pill.className).toContain('bg-bad-soft');
    expect(pill.className).toContain('text-bad-text');
  });
});

describe('Feedback bell', () => {
  const stubTotal = (total: number) => {
    const fetchMock = vi.fn(async (url: string) => (String(url).includes('/admin/feedback')
      ? { ok: true, status: 200, json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 1, total, totalPages: total } }) }
      : { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('shows the count of new reports, capped at 99+, and asks for status=new&limit=1', async () => {
    const f = stubTotal(7);
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: 'Feedback, 7 new' })).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(f.mock.calls.some(([u]) => String(u).includes('/admin/feedback?') && String(u).includes('status=new') && String(u).includes('limit=1'))).toBe(true);
    cleanup();
    stubTotal(250);
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    expect(await screen.findByText('99+')).toBeTruthy();
  });

  it('hides the badge at zero', async () => {
    const f = stubTotal(0);
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes('/admin/feedback'))).toBe(true));
    expect(await screen.findByRole('link', { name: 'Feedback, 0 new' })).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('is absent for viewers and makes no feedback request', async () => {
    auth.user.role = 'VIEWER';
    const f = stubTotal(3);
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    await Promise.resolve();
    expect(screen.queryByRole('link', { name: /Feedback/ })).toBeNull();
    expect(f.mock.calls.some(([u]) => String(u).includes('/admin/feedback'))).toBe(false);
  });

  it('hides the badge when the request fails', async () => {
    const f = vi.fn(async (url: string) => { if (String(url).includes('/admin/feedback')) throw new Error('down'); return { ok: true }; });
    vi.stubGlobal('fetch', f);
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes('/admin/feedback'))).toBe(true));
    expect(screen.getByRole('link', { name: 'Feedback, 0 new' })).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('with unsaved edits, the bell asks first and cancel stays put', async () => {
    stubTotal(2);
    shell.editorDirty = true;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter initialEntries={['/parties/BJP']}><TopBar /><Routes><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole('link', { name: 'Feedback, 2 new' }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(screen.getByTestId('where').textContent).toBe('/parties/BJP');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('link', { name: 'Feedback, 2 new' }));
    expect(screen.getByTestId('where').textContent).toBe('/feedback');
  });

  it('recounts when the Feedback page reports a status change', async () => {
    const f = stubTotal(4);
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    await screen.findByRole('link', { name: 'Feedback, 4 new' });
    const before = f.mock.calls.length;
    stubTotal(3);
    notifyFeedbackChanged();
    expect(await screen.findByRole('link', { name: 'Feedback, 3 new' })).toBeTruthy();
    expect(before).toBeGreaterThan(0);
  });
});

describe('HealthDot', () => {
  // The health request never settles here, so the label stays "Checking systems…" for the whole test.
  it('with unsaved edits, the link to System status asks first and cancel stays put', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    shell.editorDirty = true;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter initialEntries={['/parties/BJP']}><HealthDot canOpenStatus /><Routes><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: 'Checking systems…' }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(screen.getByTestId('where').textContent).toBe('/parties/BJP');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('link', { name: 'Checking systems…' }));
    expect(screen.getByTestId('where').textContent).toBe('/status');
  });

  it('without the status role it is a labelled dot, not a link', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<MemoryRouter><HealthDot canOpenStatus={false} /></MemoryRouter>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('img', { name: 'Checking systems…' })).toBeTruthy();
  });
});
