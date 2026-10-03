// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { ConstituencyPageView } from '../constituency/ConstituencyPageView';
import type { ConstituencyPageVM } from '../../viewmodels/pages/useConstituencyPageVM';

afterEach(cleanup);

const cand = (o: Record<string, unknown> & { name: string }) => ({ key: String(o.name), partyId: 'BJP', partyLabel: 'BJP', mark: null, color: '#f80', votes: 0, share: 0, pill: null, incumbent: false, photo: null, personId: null, nota: false, affidavit: null, ...o });
const vm = (over: Partial<ConstituencyPageVM> = {}): ConstituencyPageVM => ({
  status: 'ready', electionName: 'Bihar Vidhan Sabha 2025', electionHref: '/election/e1', stateName: 'Bihar', districtName: 'Patna',
  name: 'Patliputra', constNo: 30, type: 'SC', live: { kind: 'declared' },
  facts: { electors: 2000, votesPolled: 1000, turnout: 59.4, phase: 7, region: 'Magadh', district: 'Patna', progress: null },
  view: { totalVotes: 1000, margin: 220, others: null, candidates: [
    cand({ name: 'A', votes: 600, share: 60, pill: 'WON', personId: 'p1', affidavit: { age: 64, assets: 48000000, liabilities: 3200000, criminalCases: 5 } }),
    cand({ name: 'B', partyId: 'RJD', partyLabel: 'RJD', votes: 380, share: 38 }),
    cand({ name: 'NOTA', partyId: null, partyLabel: '', nota: true, votes: 20, share: 2 }),
  ] },
  history: [{ year: 2020, party: 'BJP', candidate: 'A', margin: 5, vote_share: 50.5, runner_up: 'B', runner_up_party: 'RJD' }], dominance: 'swing', notes: [], insights: [], redrawnTo: null,
  partyMeta: new Map(), locator: null, tracked: false, onToggleTrack: vi.fn(), shareText: 'x', personHref: id => `/person/${id}`, partyHref: id => `/election/e1?party=${id}`, election: null, ...over,
});
const renderIt = (v: ConstituencyPageVM) => render(<MemoryRouter><ConstituencyPageView vm={v} /></MemoryRouter>);

describe('ConstituencyPageView', () => {
  it('renders header, head-to-head, facts, the full table with affidavit columns and history', () => {
    renderIt(vm());
    expect(screen.getByRole('heading', { level: 1, name: 'Patliputra' })).toBeTruthy();
    expect(screen.getByText('No. 30 · SC')).toBeTruthy();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(4); // header + 3
    expect(within(table).getByText('₹4.8 Cr')).toBeTruthy();
    expect(within(table).getByText('5 cases')).toBeTruthy();
    expect(screen.getByText(/Runner-up: B/)).toBeTruthy();
    expect(within(table).getByRole('link', { name: 'A' }).getAttribute('href')).toBe('/person/p1');
  });

  it('below lg renders the same candidates as stacked rows with a one-line affidavit summary', () => {
    renderIt(vm({ view: { ...vm().view, candidates: [
      ...vm().view.candidates.slice(0, 2),
      cand({ name: 'C', partyId: 'JSP', partyLabel: 'JSP', votes: 5, share: 0.5, affidavit: { age: 40, assets: null, liabilities: null, criminalCases: 0 } }),
      vm().view.candidates[2],
    ] } }));
    const table = screen.getByRole('table');
    const list = within(screen.getByRole('region', { name: 'All candidates' })).getByRole('list');
    // Each layout is hidden at the other breakpoint.
    expect(list.className).toContain('lg:hidden');
    expect(list.className).toContain('list-none');
    expect(table.parentElement!.className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'lg:block']));
    const tableNames = within(table).getAllByRole('row').slice(1).map(r => r.querySelectorAll('td')[1].textContent);
    const items = within(list).getAllByRole('listitem');
    expect(items.map(li => li.textContent)).toHaveLength(tableNames.length);
    items.forEach((li, i) => expect(li.textContent).toContain(tableNames[i]!));
    expect(within(items[0]).getByRole('link', { name: 'A' }).getAttribute('href')).toBe('/person/p1');
    // Affidavit line: only the parts with data; criminal cases amber when above zero.
    const line = items[0].querySelector('[data-affidavit]')!;
    expect(line.textContent).toBe('Age 64 · Assets ₹4.8 Cr · Liabilities ₹32 L · Criminal cases 5');
    expect(within(line as HTMLElement).getByText('Criminal cases 5').className).toContain('text-warn-text');
    const lineC = items[2].querySelector('[data-affidavit]')!;
    expect(lineC.textContent).toBe('Age 40 · Criminal cases 0');
    expect(within(lineC as HTMLElement).getByText('Criminal cases 0').className).not.toContain('text-warn-text');
    expect(items[1].querySelector('[data-affidavit]')).toBeNull();
    expect(within(items[0]).getByText('Won')).toBeTruthy();
  });

  it('a redrawn seat says so in the header; otherwise nothing', () => {
    const { rerender } = render(<MemoryRouter><ConstituencyPageView vm={vm({ redrawnTo: '2023' })} /></MemoryRouter>);
    expect(screen.getByText('Boundaries redrawn in 2023')).toBeTruthy();
    rerender(<MemoryRouter><ConstituencyPageView vm={vm()} /></MemoryRouter>);
    expect(screen.queryByText(/Boundaries redrawn/)).toBeNull();
  });

  it('party names link to the election dashboard party dialog (not NOTA)', () => {
    renderIt(vm());
    const table = screen.getByRole('table');
    expect(within(table).getByRole('link', { name: /RJD/ }).getAttribute('href')).toBe('/election/e1?party=RJD');
    const h2h = screen.getByRole('region', { name: 'Head-to-head' });
    expect(within(h2h).getByRole('link', { name: /BJP/ }).getAttribute('href')).toBe('/election/e1?party=BJP');
    expect(within(table).getAllByRole('link').filter(a => a.getAttribute('href')?.includes('?party='))).toHaveLength(2);
  });

  it('classification chip uses the singular page label; the history list has no markers; the spoiler names the abbreviation', () => {
    renderIt(vm({ partyMeta: new Map([['JDU', { id: 'JDU', name: 'Janata Dal (United)', abbreviation: 'JD(U)', color: '#1a7', mark: null, eciRecognition: null }]]),
      notes: [{ kind: 'spoiler', party: 'JDU', votes: 900, margin: 220 }], insights: [{ kind: 'spoiler', party: 'JDU', votes: 900, margin: 220 }] }));
    expect(screen.getByText('Swing seat')).toBeTruthy();
    const ol = screen.getByText('Seat history').closest('article')!.querySelector('ol')!;
    expect(ol.className.split(' ')).toEqual(expect.arrayContaining(['list-none', 'pl-0']));
    expect(screen.getByText(/JD\(U\) polled 900 votes/)).toBeTruthy();
    cleanup();
    // No classification → no chip; a party missing from the party list falls back to its id.
    renderIt(vm({ dominance: null, notes: [{ kind: 'spoiler', party: 'XYZ', votes: 5, margin: 1 }], insights: [{ kind: 'spoiler', party: 'XYZ', votes: 5, margin: 1 }] }));
    expect(screen.getByText(/XYZ polled 5 votes/)).toBeTruthy();
    expect(screen.queryByText('Swing seat')).toBeNull();
  });

  it('shows the not-found state', () => {
    renderIt(vm({ status: 'notFound' }));
    expect(screen.getByText('Constituency not found')).toBeTruthy();
  });

  it('hides empty tiles (no history, no notes, no locator)', () => {
    renderIt(vm({ history: [], notes: [], insights: [], locator: null }));
    expect(screen.queryByText('Seat history')).toBeNull();
    expect(screen.queryByText('Insights')).toBeNull();
    expect(screen.queryByText('Locator')).toBeNull();
  });
  it('renders each insight kind as a card with its numbers', () => {
    renderIt(vm({ insights: [
      { kind: 'flip', from: 'RJD', to: 'BJP', fromYear: 2020 },
      { kind: 'photoFinish', pct: 0.5, margin: 981 },
      { kind: 'nota', nota: 3635, margin: 981 },
      { kind: 'incumbent', name: 'B', won: false },
    ] }));
    const box = screen.getByText('Insights').closest('article')!;
    expect(within(box as HTMLElement).getByText('Seat changed hands')).toBeTruthy();
    expect(within(box as HTMLElement).getByText(/BJP took it from RJD, the 2020 winner/)).toBeTruthy();
    expect(within(box as HTMLElement).getByText(/Decided by 981 votes, 0.5%/)).toBeTruthy();
    expect(within(box as HTMLElement).getByText(/NOTA polled 3,635 votes/)).toBeTruthy();
    expect(within(box as HTMLElement).getByText('Incumbent behind')).toBeTruthy();
  });
});
