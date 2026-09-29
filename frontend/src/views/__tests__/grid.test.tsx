// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, within, cleanup } from '@testing-library/react';
import '../../i18n';
import { MemoryRouter } from 'react-router-dom';
import { MobileCardRail } from '../dashboard/MobileCardRail';
import { TopBar } from '../dashboard/TopBar';
import type { TopBarVM } from '../../viewmodels/tiles/useTopBarVM';
import type { SearchVM } from '../../viewmodels/tiles/useSearchVM';

describe('MobileCardRail', () => {
  it('renders one snap card per tile with page dots and one button each', () => {
    const onOpen = vi.fn();
    const { container } = render(<MobileCardRail cards={[
      { id: 'insight', title: 'Swing', node: <span>a</span>, onOpen },
      { id: 'standings', title: 'Parties', node: <button type="button">inner</button>, onOpen: () => {} },
    ]} />);
    expect(container.querySelectorAll('[data-rail-card]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-rail-dot]')).toHaveLength(2);
    const cards = container.querySelectorAll('[data-rail-card]');
    cards.forEach(c => expect(c.querySelectorAll(':scope > button')).toHaveLength(1));
    expect(container.querySelectorAll('button button')).toHaveLength(0);
    fireEvent.click(cards[0].querySelector(':scope > button')!);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

const vm: TopBarVM = {
  electionType: 'VS', electionId: 'e1', states: [{ id: 4, name: 'Bihar' }], stateId: 4, years: [{ id: 'e1', year: 2025 }, { id: 'e0', year: 2020 }], lsElections: [{ id: 'l1', name: 'LS 2024' }],
  electionLabel: 'VS · Bihar 2025',
  statusLabel: { kind: 'final', declared: 1, total: 1 }, shareText: 'Share me', lang: 'en', langs: ['en', 'hi'],
  onType: vi.fn(), onState: vi.fn(), onElection: vi.fn(), onLang: vi.fn(), onSearchSeat: vi.fn(),
  theme: 'dark', onTheme: vi.fn(), onToggleTheme: vi.fn(),
};
const search: SearchVM = { query: '', open: false, seats: [], candidates: [], onQuery: () => {}, onOpen: () => {}, onPick: () => {} };
const future = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
const bar = () => render(<MemoryRouter future={future}><TopBar vm={vm} search={search} compact /></MemoryRouter>);

describe('TopBar compact (one row)', () => {
  afterEach(cleanup);
  it('shows title, election chip, search and more buttons in a single row, with the controls hidden in sheets', () => {
    const { container } = bar();
    const header = container.querySelector('header')!;
    expect(header.className).not.toContain('flex-wrap');
    expect(within(header).getByText('VS · Bihar 2025')).toBeTruthy();
    expect(within(header).getByRole('button', { name: /Choose election/ })).toBeTruthy();
    expect(within(header).getByRole('button', { name: 'Search' })).toBeTruthy();
    expect(within(header).getByRole('button', { name: 'More' })).toBeTruthy();
    expect(container.querySelector('input[type="search"]')).toBeNull();
    expect(container.querySelector('a[href^="https://wa.me"]')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Election type' })).toBeNull();
  });
  it('the chip and title keep 44px touch targets and the chip can shrink', () => {
    const { container } = bar();
    const link = container.querySelector('header a')!;
    expect(link.className).toContain('h-11');
    expect(link.className).toContain('max-[369px]:hidden');
    const chip = screen.getByRole('button', { name: /Choose election/ });
    expect(chip.className).toContain('h-11');
    expect(chip.className).toContain('min-w-0');
    expect(chip.getAttribute('aria-label')).toBe('Choose election: VS · Bihar 2025');
  });
  it('switching the election type closes the election sheet', () => {
    bar();
    fireEvent.click(screen.getByRole('button', { name: /Choose election/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: /Lok Sabha/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('the election chip opens a sheet with the LS/VS toggle and the state and year pickers', () => {
    bar();
    fireEvent.click(screen.getByRole('button', { name: /Choose election/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: /Lok Sabha/i })).toBeTruthy();
    expect(within(dialog).getByRole('radio', { name: /Vidhan Sabha/i })).toBeTruthy();
    expect(within(dialog).getByRole('combobox', { name: 'Select State' })).toBeTruthy();
    expect(within(dialog).getByRole('combobox', { name: 'Year' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Lok Sabha/i }));
    expect(vm.onType).toHaveBeenCalledWith('LS');
  });
  it('the search button opens a sheet with a focused search box', () => {
    bar();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    const input = within(screen.getByRole('dialog')).getByRole('searchbox');
    expect(document.activeElement).toBe(input);
  });
  it('the more button opens a sheet with WhatsApp / X share links and the language picker', () => {
    bar();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelectorAll('a[href^="https://wa.me"], a[href^="https://twitter.com"]')).toHaveLength(2);
    expect(within(dialog).getByRole('combobox', { name: 'Language' })).toBeTruthy();
  });
});

describe('theme controls', () => {
  afterEach(cleanup);
  const full = (over: Partial<TopBarVM> = {}) => render(<MemoryRouter future={future}><TopBar vm={{ ...vm, ...over }} search={search} /></MemoryRouter>);
  it('desktop: a 36px icon button next to Share offers the other theme and toggles', () => {
    const onToggleTheme = vi.fn();
    full({ theme: 'dark', onToggleTheme });
    const btn = screen.getByRole('button', { name: 'Switch to light theme' });
    expect(btn.className).toContain('h-9');
    expect(btn.hasAttribute('aria-pressed')).toBe(false);
    fireEvent.click(btn);
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });
  it('desktop: in light the button offers dark', () => {
    full({ theme: 'light' });
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeTruthy();
  });
  it('mobile: the more sheet has a Theme row with a Dark / Light toggle', () => {
    const onTheme = vi.fn();
    render(<MemoryRouter future={future}><TopBar vm={{ ...vm, theme: 'dark', onTheme }} search={search} compact /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const dialog = screen.getByRole('dialog');
    const group = within(dialog).getByRole('radiogroup', { name: 'Theme' });
    expect(within(group).getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');
    const light = within(group).getByRole('radio', { name: 'Light' });
    expect(light.className).toContain('min-h-11');
    fireEvent.click(light);
    expect(onTheme).toHaveBeenCalledWith('light');
  });
  it('mobile: a 44px logo mark links home and is only shown when the title is hidden', () => {
    const { container } = bar();
    const mark = container.querySelector('a[data-logo-mark]')!;
    expect(mark.getAttribute('href')).toBe('/');
    expect(mark.getAttribute('aria-label')).toBe('Election Tracker');
    expect(mark.className).toContain('h-11');
    expect(mark.className).toContain('w-11');
    expect(mark.className).toContain('hidden');
    expect(mark.className).toContain('max-[369px]:grid');
  });
});
