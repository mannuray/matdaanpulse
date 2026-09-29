// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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
  electionType: 'LS', electionId: 'e1', states: [], stateId: null, years: [], lsElections: [{ id: 'e1', name: 'LS 2024' }],
  statusLabel: { kind: 'final', declared: 1, total: 1 }, shareText: 'Share me', lang: 'en', langs: ['en', 'hi'],
  onType: () => {}, onState: () => {}, onElection: () => {}, onLang: () => {}, onSearchSeat: () => {},
};
const search: SearchVM = { query: '', open: false, seats: [], candidates: [], onQuery: () => {}, onOpen: () => {}, onPick: () => {} };
const future = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

describe('TopBar compact', () => {
  it('keeps share and language reachable and puts search on its own row', () => {
    const { container } = render(<MemoryRouter future={future}><TopBar vm={vm} search={search} compact /></MemoryRouter>);
    const header = container.querySelector('header')!;
    expect(header.className).toContain('flex-wrap');
    expect(header.className).not.toContain('h-12');
    expect(container.querySelectorAll('a[href^="https://wa.me"], a[href^="https://twitter.com"]')).toHaveLength(2);
    expect(container.querySelector('[aria-label="Language"], [aria-label]:not(input)')).toBeTruthy();
    const input = container.querySelector('input[type="search"]')!;
    expect(input.parentElement!.className).toContain('basis-full');
    expect(input.parentElement!.className).toContain('order-last');
  });
});
