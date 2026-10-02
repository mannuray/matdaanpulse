// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

const data = vi.hoisted(() => {
  const C = (id: string, no: number, name: string, district: string, tags: string[] = []) => ({
    id, election_id: 'e1', name, const_no: no, type: 'GEN', state_id: 1, district_id: 1,
    district: { id: 1, name: district, code: 'x' }, region_id: null, region: null, voter_turnout: null, metadata: { tags },
  });
  return {
    C,
    page1: [C('a', 1, 'Patna Sahib', 'Patna', ['urban']), C('b', 2, 'Bankipur', 'Patna'), C('c', 3, 'Gaya Town', 'Gaya')],
    elections: [{ id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', year: 2025, status: 'Live', state_id: 1, tentative_next_date: null, manifest_url: null }],
  };
});
const svc = vi.hoisted(() => ({
  getAdminConstituencies: vi.fn(),
  bulkTagConstituencies: vi.fn(async () => []),
  computeConstituencyAnalysis: vi.fn(async () => ({ computed: 0 })),
  getAdminConstituencyDetail: vi.fn(),
  getConstituencyHistory: vi.fn(),
  updateConstituency: vi.fn(async () => ({})),
}));
vi.mock('../services/constituency.service', () => svc);
vi.mock('../services/geo.service', () => ({ getDistricts: vi.fn(async () => [{ id: 1, name: 'Patna', code: 'x' }]), getRegions: vi.fn(async () => []) }));
vi.mock('../context/ElectionContext', () => ({
  useElection: () => ({ elections: data.elections, electionId: 'e1', election: data.elections[0], setElectionId: vi.fn(), loading: false, error: null, reload: vi.fn() }),
}));
import Constituencies from './Constituencies';
import { renderEntityPage } from '../test-utils/entity-harness';

beforeEach(() => {
  svc.getAdminConstituencies.mockImplementation(async (_e: string, page: number) => ({
    success: true, data: page === 1 ? data.page1 : [data.C('z', 101, 'Page Two Seat', 'Gaya')], pagination: { page, limit: 100, total: 243, totalPages: 3 },
  }));
  svc.getAdminConstituencyDetail.mockImplementation(async (id: string) => ({
    ...[...data.page1, data.C('z', 101, 'Page Two Seat', 'Gaya')].find((c) => c.id === id)!, metadata: { population: 1000, tags: ['urban'] }, analysis: null,
  }));
  svc.getConstituencyHistory.mockResolvedValue({ volatility: { elections: 0, changes: 0 }, rows: [] });
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/constituencies') => renderEntityPage('/constituencies', <Constituencies />, at);
const table = () => screen.getByRole('table', { name: 'Constituencies' });
/** The record page, once its title (the seat name) shows. */
const record = async (name = 'Patna Sahib') => {
  await screen.findByRole('heading', { level: 1, name });
  return document.body;
};
const card = (title: string) => screen.getByRole('heading', { name: title }).closest('section')!;

describe('Constituencies page', () => {
  it('pages past the first 100 seats; a new search goes back to page 1', async () => {
    renderAt();
    await within(table()).findByText('Patna Sahib');
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await within(table()).findByText('Page Two Seat')).toBeTruthy();
    expect(svc.getAdminConstituencies).toHaveBeenLastCalledWith('e1', 2, 100, undefined);
    fireEvent.change(screen.getByLabelText('Search seats'), { target: { value: 'pat' } });
    await waitFor(() => expect(svc.getAdminConstituencies).toHaveBeenLastCalledWith('e1', 1, 100, 'pat'));
  });

  it('with a district filter, select all and bulk tag touch only the visible rows', async () => {
    renderAt();
    await within(table()).findByText('Patna Sahib');
    fireEvent.change(screen.getByLabelText('District (this page)'), { target: { value: 'Patna' } });
    expect(within(table()).queryByText('Gaya Town')).toBeNull();
    expect(screen.getByText(/district and tag filters apply to this page/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Select all on this page'));
    expect(screen.getByText('2 selected')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Add tag to selected'), { target: { value: 'rural' } });
    await waitFor(() => expect(svc.bulkTagConstituencies).toHaveBeenCalledWith(['a', 'b'], ['rural'], []));
  });

  it('a row checkbox selects without opening the record', async () => {
    renderAt();
    fireEvent.click(await screen.findByLabelText('Select Bankipur'));
    expect(screen.getByText('1 selected')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/constituencies');
  });

  it('the record saves 0 as 0 and shows an invalid seat number inline without sending it', async () => {
    renderAt('/constituencies/a');
    const panel = await record();
    fireEvent.change(await within(panel).findByLabelText('Urban share'), { target: { value: '0' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(svc.updateConstituency).toHaveBeenCalledWith('a', expect.objectContaining({
      const_no: 1, metadata: { urban_pct: 0 },
    })));
    await waitFor(() => expect(within(panel).getByText('No changes')).toBeTruthy());
    fireEvent.change(within(panel).getByLabelText('Constituency number'), { target: { value: 'abc' } });
    expect(await within(panel).findByText('Enter a whole number, 1 or more')).toBeTruthy();
    expect((within(panel).getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
    expect(svc.updateConstituency).toHaveBeenCalledTimes(1);
  });

  it('tags are added with Enter and removed on the record', async () => {
    renderAt('/constituencies/a');
    const panel = await record();
    const input = await within(panel).findByLabelText('Add a tag');
    fireEvent.change(input, { target: { value: 'flood_prone' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(within(panel).getByText('Flood prone')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Remove tag Urban' }));
    expect(within(panel).queryByText('Urban')).toBeNull();
    expect(within(panel).getByText('Unsaved changes')).toBeTruthy();
  });

  it('Compute all analysis asks first, then queues it for the election', async () => {
    renderAt();
    await within(table()).findByText('Patna Sahib');
    fireEvent.click(screen.getByRole('button', { name: 'Compute all analysis' }));
    expect(svc.computeConstituencyAnalysis).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Compute all' }));
    await waitFor(() => expect(svc.computeConstituencyAnalysis).toHaveBeenCalledWith('e1', []));
  });

  it('a percent over 100 shows inline and blocks Save', async () => {
    renderAt('/constituencies/a');
    const panel = await record();
    fireEvent.change(await within(panel).findByLabelText('Literacy rate'), { target: { value: '101' } });
    expect(await within(panel).findByText(/from 0 to 100/)).toBeTruthy();
    expect((within(panel).getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a 404 or an unparseable id (400) says not found, with no toast and no retry', async () => {
    const { ApiError } = await import('../services/api-client');
    svc.getAdminConstituencyDetail.mockRejectedValueOnce(new ApiError('gone', 404));
    renderAt('/constituencies/a');
    expect(await screen.findByText('Constituency not found')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('Failed to load constituency details')).toBeNull();
    expect(screen.queryByText('gone')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    cleanup();
    svc.getAdminConstituencyDetail.mockRejectedValueOnce(new ApiError('bad id', 400));
    renderAt('/constituencies/a');
    expect(await screen.findByText('Constituency not found')).toBeTruthy();
    expect(screen.queryByText('Could not load constituency')).toBeNull();
  });

  it('a 404 says not found; another failure offers Try again', async () => {
    const { ApiError } = await import('../services/api-client');
    svc.getAdminConstituencyDetail.mockRejectedValueOnce(new ApiError('gone', 404));
    renderAt('/constituencies/a');
    expect(await screen.findByText('Constituency not found')).toBeTruthy();
    cleanup();
    svc.getAdminConstituencyDetail.mockRejectedValueOnce(new Error('network'));
    renderAt('/constituencies/a');
    expect(await screen.findByText('Could not load constituency')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('a district filter picked on page 1 is gone on page 2, and the selection clears', async () => {
    renderAt();
    await within(table()).findByText('Patna Sahib');
    fireEvent.change(screen.getByLabelText('District (this page)'), { target: { value: 'Patna' } });
    fireEvent.click(screen.getByLabelText('Select Bankipur'));
    expect(screen.getByText('1 selected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await within(table()).findByText('Page Two Seat')).toBeTruthy();
    expect((screen.getByLabelText('District (this page)') as HTMLSelectElement).value).toBe('');
    expect(screen.queryByText('1 selected')).toBeNull();
  });

  it('searches by name only', async () => {
    renderAt();
    expect(await screen.findByPlaceholderText('Search by name…')).toBeTruthy();
  });

  it('a row opens the record in place of the list; back returns to the same page', async () => {
    renderAt();
    await within(table()).findByText('Patna Sahib');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(await within(table()).findByText('Page Two Seat'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Page Two Seat' })).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Constituencies' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Constituencies' }));
    expect(await within(table()).findByText('Page Two Seat')).toBeTruthy();
    expect(screen.getByText('Page 2 of 3')).toBeTruthy();
  });

  it('phase saves to the column, not metadata', async () => {
    renderAt('/constituencies/a');
    const panel = await record();
    fireEvent.change(await within(panel).findByLabelText('Polling phase'), { target: { value: '3' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(svc.updateConstituency).toHaveBeenCalled());
    const call = svc.updateConstituency.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(call[1]).toMatchObject({ phase: 3, metadata: {} });
  });

  it('reservation is a select that saves type, and the header tag shows it', async () => {
    renderAt('/constituencies/a');
    const panel = await record();
    expect(within(panel).getByText('GEN')).toBeTruthy();
    fireEvent.change(await within(panel).findByLabelText('Reservation'), { target: { value: 'SC' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(svc.updateConstituency).toHaveBeenCalledWith('a', expect.objectContaining({ type: 'SC' })));
  });

  it('seat history lists winners newest first, marks this election and shows the volatility line', async () => {
    svc.getConstituencyHistory.mockResolvedValue({
      volatility: { elections: 3, changes: 2 },
      rows: [
        { election_id: 'e1', year: 2025, type: 'VS', winner: 'Ravi Prasad', party_id: 'BJP', margin: 12309, turnout: 58.4, is_current: true },
        { election_id: 'e0', year: 2020, type: 'VS', winner: 'Anil Kumar', party_id: 'JDU', margin: 2700, turnout: null, is_current: false },
        { election_id: 'e9', year: 2015, type: 'VS', winner: 'Sita Devi', party_id: 'BJP', margin: null, turnout: 55, is_current: false },
      ],
    });
    renderAt('/constituencies/a');
    await record();
    const history = card('Seat history');
    expect(await within(history).findByText('Party changed 2 times in 3 elections')).toBeTruthy();
    const rows = within(history).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('2025'), expect.stringContaining('2020'), expect.stringContaining('2015'),
    ]);
    expect(within(rows[0]).getByText('This election')).toBeTruthy();
    expect(within(rows[0]).getByText('+12,309')).toBeTruthy();
    expect(within(history).queryByText('No earlier elections for this seat')).toBeNull();
  });

  it('a seat with no earlier elections says so (history empty, or only this election)', async () => {
    renderAt('/constituencies/a');
    await record();
    expect(await within(card('Seat history')).findByText('No earlier elections for this seat')).toBeTruthy();
    cleanup();
    svc.getConstituencyHistory.mockResolvedValue({
      volatility: { elections: 1, changes: 0 },
      rows: [{ election_id: 'e1', year: 2025, type: 'VS', winner: 'Ravi Prasad', party_id: 'BJP', margin: 10, turnout: null, is_current: true }],
    });
    renderAt('/constituencies/a');
    await record();
    expect(await within(card('Seat history')).findByText('No earlier elections for this seat')).toBeTruthy();
    expect(within(card('Seat history')).queryByText(/Party changed/)).toBeNull();
  });

  it('analysis shows "Not computed yet" with the hint, or the computed values', async () => {
    renderAt('/constituencies/a');
    await record();
    expect(within(card('Analysis')).getByText('Not computed yet')).toBeTruthy();
    expect(within(card('Analysis')).getByText(/Compute all analysis/)).toBeTruthy();
    cleanup();
    svc.getAdminConstituencyDetail.mockImplementation(async (id: string) => ({
      ...data.page1.find((c) => c.id === id)!, metadata: {}, voter_turnout: 58.4, state: { id: 1, code: 'BR', name: 'Bihar' },
      analysis: {
        id: 'x', const_id: id, election_id: 'e1', dominance: 'STRONG', dominance_party: 'JDU',
        incumbency: { incumbent_name: 'Hari Singh', incumbent_party: 'JDU', re_contesting: true }, notes: 'Held since 2010',
        updated_at: '2026-10-02T06:30:00.000Z',
      },
    }));
    renderAt('/constituencies/a');
    await record();
    const analysis = card('Analysis');
    expect(within(analysis).getByText('Computed 2 Oct 2026')).toBeTruthy();
    expect(within(analysis).getByText('Hari Singh (JDU)')).toBeTruthy();
    expect(within(analysis).getByText('Held since 2010')).toBeTruthy();
    const rec = card('Record');
    expect(within(rec).getByText('BR')).toBeTruthy();
    expect(within(rec).getByText('58.4%')).toBeTruthy();
  });

  it('"Candidates in this seat" links to the Candidates page with the seat and election', async () => {
    renderAt('/constituencies/a');
    const panel = await record();
    const link = within(panel).getByRole('link', { name: /Candidates in this seat/ });
    expect(link.getAttribute('href')).toBe('/candidates?seat=a&election=e1');
    fireEvent.click(link);
    expect(screen.getByTestId('where').textContent).toBe('/candidates?seat=a&election=e1');
  });

  it('a failed seats load says "Could not load seats" and Try again reloads them', async () => {
    svc.getAdminConstituencies.mockRejectedValueOnce(new Error('boom'));
    renderAt();
    expect(await screen.findByText('Could not load seats')).toBeTruthy();
    expect(screen.queryByText('No seats match')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await within(table()).findByText('Patna Sahib')).toBeTruthy();
    expect(svc.getAdminConstituencies).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Could not load seats')).toBeNull();
  });
});
