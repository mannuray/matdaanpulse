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
    ...data.page1.find((c) => c.id === id)!, metadata: { population: 1000, tags: ['urban'] }, analysis: null,
  }));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/constituencies') => renderEntityPage('/constituencies', <Constituencies />, at);
const table = () => screen.getByRole('table', { name: 'Constituencies' });

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

  it('a row checkbox selects without opening the panel', async () => {
    renderAt();
    fireEvent.click(await screen.findByLabelText('Select Bankipur'));
    expect(screen.getByText('1 selected')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/constituencies');
  });

  it('the panel saves 0 as 0 and shows an invalid seat number inline without sending it', async () => {
    renderAt('/constituencies/a');
    const panel = await screen.findByRole('dialog', { name: 'Patna Sahib' });
    fireEvent.change(await within(panel).findByLabelText('Urban %'), { target: { value: '0' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(svc.updateConstituency).toHaveBeenCalledWith('a', expect.objectContaining({
      const_no: 1, metadata: expect.objectContaining({ urban_pct: 0, population: 1000 }),
    })));
    await waitFor(() => expect(within(panel).getByText('No changes')).toBeTruthy());
    fireEvent.change(within(panel).getByLabelText('Seat number'), { target: { value: 'abc' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(await within(panel).findByText('Enter a whole number, 1 or more')).toBeTruthy();
    expect(svc.updateConstituency).toHaveBeenCalledTimes(1);
  });

  it('tags are added with Enter and removed in the panel', async () => {
    renderAt('/constituencies/a');
    const panel = await screen.findByRole('dialog', { name: 'Patna Sahib' });
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
    const panel = await screen.findByRole('dialog', { name: 'Patna Sahib' });
    fireEvent.change(await within(panel).findByLabelText('Literacy %'), { target: { value: '101' } });
    expect(await within(panel).findByText(/from 0 to 100/)).toBeTruthy();
    expect((within(panel).getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
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

  it('bulk tagging the open (clean) record reloads its panel; an unrelated save does not send tags', async () => {
    renderAt('/constituencies/a');
    const panel = await screen.findByRole('dialog', { name: 'Patna Sahib' });
    await within(panel).findByLabelText('Add a tag');
    svc.getAdminConstituencyDetail.mockImplementation(async (id: string) => ({
      ...data.page1.find((c) => c.id === id)!, metadata: { population: 1000, tags: ['urban', 'rural'] }, analysis: null,
    }));
    fireEvent.click(screen.getByLabelText('Select Patna Sahib'));
    fireEvent.change(screen.getByLabelText('Add tag to selected'), { target: { value: 'rural' } });
    expect(await within(panel).findByText('Rural')).toBeTruthy();
    fireEvent.change(within(panel).getByLabelText('Phase'), { target: { value: '3' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(svc.updateConstituency).toHaveBeenCalled());
    const call = svc.updateConstituency.mock.calls[0] as unknown as [string, { metadata: Record<string, unknown> }];
    expect(call[1].metadata).not.toHaveProperty('tags');
    expect(call[1].metadata).toMatchObject({ phase: '3', population: 1000 });
  });
});
