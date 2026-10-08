// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import { SeatDialog } from '../seat/SeatDialog';
import type { SeatDialogVM } from '../../viewmodels/tiles/useSeatDialogVM';

beforeAll(() => { window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never; });
afterEach(cleanup);

const vm = (over: Partial<SeatDialogVM> = {}): SeatDialogVM => ({
  seatId: 'S', name: 'Patliputra', constNo: 30, type: 'SC', place: 'Patna · Bihar', live: { kind: 'counting', round: { current: 12, total: 24 } },
  electors: 2014532, turnout: 59.4, phase: 7,
  view: { totalVotes: 1000, margin: 200, others: { count: 4, votes: 20, share: 2 }, candidates: [
    { key: 'a', name: 'Ram Kripal Yadav', partyId: 'BJP', partyLabel: 'BJP', mark: '/l.svg', color: '#f80', votes: 600, share: 60, pill: 'LEADING', incumbent: true, photo: null, personId: 'p1', nota: false, affidavit: null },
    { key: 'b', name: 'Misa Bharti', partyId: 'RJD', partyLabel: 'RJD', mark: null, color: '#0a0', votes: 380, share: 38, pill: null, incumbent: false, photo: null, personId: null, nota: false, affidavit: null },
  ] },
  history: [{ year: 2020, party: 'BJP', candidate: 'X', margin: 1, vote_share: 50.5 }], notes: [{ kind: 'threeWay', thirdName: 'C', thirdVotes: 300, margin: 200 }],
  partyMeta: new Map(), detailState: 'ready', fullPageHref: '/election/e/constituency/S', tracked: false,
  liveSeat: null, upsets: [], trend: [], narrowed: null,
  onToggleTrack: vi.fn(), onClose: vi.fn(), onOpenParty: vi.fn(), personHref: id => `/person/${id}`, ...over,
});

const renderIt = (v: SeatDialogVM) => render(<MemoryRouter><SeatDialog vm={v} /></MemoryRouter>);

describe('SeatDialog live block', () => {
  const liveSeat = { call: 'too_close', momentum: 'narrowing' } as unknown as NonNullable<SeatDialogVM['liveSeat']>;
  const trend = [1, 2, 3, 4].map(x => ({ seq: x, x, y: 400 - x * 50, party: x < 3 ? 'BJP' : 'RJD', switched: x === 3 }));
  it('shows the call and momentum badges, the margin trend, upset badges and the narrowed line', () => {
    renderIt(vm({ liveSeat, trend, upsets: [{ kind: 'sitting_trailing', name: 'Asha Devi', party: 'BJP', margin: 200 }, { kind: 'stronghold_trailing', party: 'BJP', since: 2005 }],
      narrowed: { kind: 'narrowed', from: 2890, to: 342, rounds: 3 } }));
    expect(screen.getByText('Too close')).toBeTruthy();
    expect(screen.getByText('Narrowing')).toBeTruthy();
    expect(document.querySelector('svg[data-margin-trend]')).toBeTruthy();
    expect([...document.querySelectorAll('svg[data-margin-trend] text')].map(e => e.textContent)).toEqual(['Lead switch R3']);
    expect(screen.getByText('Sitting MLA trailing · Asha Devi (BJP) −200')).toBeTruthy();
    expect(screen.getByText('Stronghold at risk · held by BJP since 2005')).toBeTruthy();
    expect(screen.getByText('Lead narrowed from 2,890 to 342 over the last 3 rounds')).toBeTruthy();
  });
  it('a countermanded or adjourned seat shows its state, not a call or momentum badge (live e2e C3)', () => {
    renderIt(vm({ live: { kind: 'countermanded' }, liveSeat: { call: 'not_started', momentum: 'switched' } as unknown as NonNullable<SeatDialogVM['liveSeat']> }));
    expect(screen.getByText('Countermanded')).toBeTruthy();
    expect(screen.queryByText('Not started')).toBeNull();
    expect(screen.queryByText('Switched')).toBeNull();
  });
  it('labels only the latest lead switch (neighbouring switches do not stack labels); every switch keeps a marker', () => {
    const many = [1, 2, 3, 4, 5].map(x => ({ seq: x, x, y: 300, party: x % 2 ? 'BJP' : 'RJD', switched: x > 1 }));
    renderIt(vm({ liveSeat, trend: many }));
    expect([...document.querySelectorAll('svg[data-margin-trend] text')].map(e => e.textContent)).toEqual(['Lead switch R5']);
    expect(document.querySelectorAll('svg[data-margin-trend] circle[data-switch]')).toHaveLength(4);
  });
  it('upset badges without names read plainly (no empty brackets)', () => {
    renderIt(vm({ liveSeat, upsets: [{ kind: 'sitting_trailing', margin: null }, { kind: 'stronghold_trailing', party: null }, { kind: 'heavyweight_trailing' }] }));
    expect(screen.getByText('Sitting MLA trailing')).toBeTruthy();
    expect(screen.getByText('Stronghold at risk')).toBeTruthy();
    expect(screen.getByText('Heavyweight trailing')).toBeTruthy();
  });
  it('no chart with fewer than 2 points; nothing live for a non-live seat', () => {
    renderIt(vm({ liveSeat, trend: trend.slice(0, 1) }));
    expect(screen.getByText('Too close')).toBeTruthy();
    expect(document.querySelector('svg[data-margin-trend]')).toBeNull();
    cleanup();
    renderIt(vm());
    expect(screen.queryByText('Too close')).toBeNull();
  });
});

describe('SeatDialog', () => {
  it('shows header facts, stats, ranked candidates and the full-page link', () => {
    renderIt(vm());
    const dlg = screen.getByRole('dialog', { name: 'Patliputra' });
    expect(within(dlg).getByText('No. 30 · SC')).toBeTruthy();
    expect(within(dlg).getByText('Patna · Bihar')).toBeTruthy();
    expect(within(dlg).getByText('20,14,532')).toBeTruthy();
    expect(within(dlg).getByText(/Round 12\/24/)).toBeTruthy();
    expect(within(dlg).getAllByText('Leading')).toHaveLength(1);
    expect(within(dlg).getByText('+4 others')).toBeTruthy();
    expect(within(dlg).getByRole('link', { name: /Full constituency page/ }).getAttribute('href')).toBe('/election/e/constituency/S');
    expect(within(dlg).getByText(/3-way contest/)).toBeTruthy();
  });

  it('while the detail loads: skeletons for the stats, the No./place chips and past winners; live rows render at once', () => {
    renderIt(vm({ detailState: 'loading', constNo: null, type: null, place: null, electors: null, turnout: null, phase: null, history: [] }));
    const dlg = screen.getByRole('dialog', { name: 'Patliputra' });
    const skels = dlg.querySelectorAll('[data-skeleton]');
    expect(skels.length).toBe(2 + 4 + 3);
    skels.forEach(el => expect(el.className).toContain('animate-pulse'));
    expect(within(dlg).queryByText('Electors')).toBeNull();
    expect(within(dlg).getByText('Ram Kripal Yadav')).toBeTruthy();
    expect(within(dlg).getByText('Misa Bharti')).toBeTruthy();
  });

  it('no skeletons once the detail is ready', () => {
    renderIt(vm());
    expect(screen.getByRole('dialog', { name: 'Patliputra' }).querySelectorAll('[data-skeleton]')).toHaveLength(0);
  });

  it('footer order: past winners, then notes, then the full-page link last; spoiler shows the abbreviation; one other is singular', () => {
    renderIt(vm({ partyMeta: new Map([['JDU', { id: 'JDU', name: 'Janata Dal (United)', abbreviation: 'JD(U)', color: '#1a7', mark: null, eciRecognition: null }]]),
      notes: [{ kind: 'spoiler', party: 'JDU', votes: 900, margin: 200 }], view: { ...vm().view, others: { count: 1, votes: 5, share: 0.5 } } }));
    const dlg = screen.getByRole('dialog', { name: 'Patliputra' });
    const past = within(dlg).getByText('Past winners');
    const note = within(dlg).getByText(/JD\(U\) polled 900 votes/);
    const link = within(dlg).getByRole('link', { name: /Full constituency page/ });
    expect(past.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(note.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(dlg).getByText('+1 other')).toBeTruthy();
  });

  it('links a candidate with a person, opens the party dialog from the party cell', () => {
    const v = vm();
    renderIt(v);
    expect(screen.getByRole('link', { name: 'Ram Kripal Yadav' }).getAttribute('href')).toBe('/person/p1');
    expect(screen.queryByRole('link', { name: 'Misa Bharti' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /BJP/ }));
    expect(v.onOpenParty).toHaveBeenCalledWith('BJP');
  });

  it('Track toggles the watchlist and reflects the tracked state', () => {
    const v = vm();
    renderIt(v);
    const btn = screen.getByRole('button', { name: /Track/ });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn);
    expect(v.onToggleTrack).toHaveBeenCalled();
    cleanup();
    renderIt(vm({ tracked: true }));
    expect(screen.getByRole('button', { name: /Tracked/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('hides unknown stats and shows the unavailable line on error', () => {
    renderIt(vm({ electors: null, turnout: null, phase: null, detailState: 'error' }));
    expect(screen.queryByText('Electors')).toBeNull();
    expect(screen.getByText('Details unavailable')).toBeTruthy();
  });
});
